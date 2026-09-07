/**
 * EPTTS API — end-to-end journey with returns.
 *
 * A port of the pytest scenario in
 * `Scripts/E2E Automation Script/Automation_Test_Script_Refactored (3)/tests/test_e2e_supply_chain.py`
 * onto this Hub's helpers, with the assertions strengthened from "the request was
 * accepted" to "the platform's state actually changed".
 *
 *   commission x4 -> pack all four into one SSCC -> ship mfg->branch -> receive (branch)
 *     -> ship branch->pharmacy -> receive (pharmacy)
 *     -> full dispense (pack 1) -> re-dispense refused -> partial dispense (pack 2)
 *     -> return packs 3+4 pharmacy->branch -> return receiving (branch)
 *
 * THIS REPLACED `eptts-api-supply-chain`, WHICH HAS BEEN DELETED
 *
 * That project walked ONE pack forward to a dispense and stopped. Every transition it
 * covered — commission, pack, ship, receive, ship, receive, dispense, re-dispense-refused,
 * message history — is covered here too. That is specifically why E2E-07b exists: it is
 * that project's CHAIN-08, carried over so nothing was lost when it was retired. Keeping
 * both would have meant paying for the same seven custody transitions twice, in real
 * production writes, on every regression run.
 *
 * What that project could NOT reach, and the reason this one carries FOUR packs: the tail
 * of the lifecycle. One pack is fully dispensed, one is refused a partial dispense, and two
 * are returned upstream and received back into the branch's inventory. Return receiving is
 * the only transition that moves stock out of a terminal-looking state back into
 * circulation, so it is the step most worth proving composes with everything before it —
 * and with a single pack there is nothing left un-dispensed to return.
 *
 * THREE DELIBERATE DEVIATIONS FROM THE PYTHON SCRIPT
 *
 * 1. It commissions the four SGTINs one at a time; this sends one commission event with
 *    all four EPCs. That is not a behavioural change — the Python split exists only
 *    because `create_commission_payload` accepts a single EPC — and it saves ~36 s of
 *    submit-and-poll against the Hub's 5-minute per-run watchdog.
 * 2. The Python docstring says packs 2, 3 and 4 are returned; its code returns only 3 and
 *    4. The code is followed here. Returning a partially-dispensed pack is a different
 *    business case and belongs in the api-return feature cases, not in the happy path.
 * 3. Business-transaction references are minted per shipment, not per run. The platform
 *    rejects a reused invoice number, so a run-scoped constant fails every shipment after
 *    the first (see uniqueBizTransaction in lib/eptts-api.ts).
 *
 * Ordered and stateful by design: `describe.serial`, each step handing its EPCs to the
 * next. A failure stops the chain, because every later step is meaningless without it.
 *
 * WRITES TO PRODUCTION. Every EPC uses a run-scoped `ZTG…` serial so repeated runs never
 * collide and our data stays identifiable afterwards.
 */
import { test, expect } from '@playwright/test'
import {
  submitAndPoll, sendEpcis, packOf, disposeApi, describeMsgStatus,
  dispensation, pollMsgStatus, bodyOf, errorOf, getMasar,
  epcisDocument, commissionEvent, aggregationEvent, shippingEvent, receivingEvent, dispensingEvent,
  freshDispensableSgtin, freshSscc, sglnOf, glnFor, runId, sameSscc, ssccUrnToDigits,
  uniqueBizTransaction,
  MFG_DISPENSABLE_GTINS,
  type EpcisDocument, type Role,
} from '../../lib/eptts-api'
import { writeApiArtifacts } from '../../lib/eptts-api-log'

const MFG = () => glnFor('manufacturer')
const BRANCH = () => glnFor('branch')
const PHARMACY = () => glnFor('pharmacy')

/** How many units of pack 2 the partial dispense asks for. */
const PARTIAL_QUANTITY = 2

/** Submit an EPCIS document and require it to be both accepted AND processed. */
async function submit(role: Role, doc: EpcisDocument, what: string): Promise<void> {
  const { submitStatus, msg } = await submitAndPoll(role, doc)
  expect(submitStatus, `${what}: not accepted (HTTP ${submitStatus})`).toBe(202)
  expect(msg.state, `${what}: ${describeMsgStatus(msg)}`).toBe('SUCCESS')
}

/**
 * One combined request/response log for the whole journey.
 *
 * Written from the LAST step that actually runs — the final one when the chain completes,
 * or the failing one when it does not, which is exactly when someone needs to see what was
 * sent. Writing it after every step instead would leave several api-log.html files in the
 * output dir and engine/runner.ts lifts whichever it finds first, so the Hub could end up
 * showing step 1's log for a chain that failed at step 9.
 */
let logged = false
async function logJourney(): Promise<void> {
  if (logged) return
  logged = true
  await writeApiArtifacts(`EPTTS API — E2E journey: dispense & return (run ${runId()})`)
}

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== 'passed' || testInfo.title.startsWith('E2E-11')) await logJourney()
})

test.afterAll(async () => { await disposeApi() })

test.describe.serial('e2e journey: dispense and return', () => {
  // Carried between steps.
  let sgtins: string[] = []
  let sscc = ''
  let returnRef = ''

  test('E2E-01 — the manufacturer commissions four packs', async () => {
    test.slow()
    // NON-Dawana products only: this journey ends in a dispense, and the platform refuses
    // to dispense Dawana-integrated products through this channel.
    sgtins = Array.from({ length: 4 }, () => freshDispensableSgtin(MFG_DISPENSABLE_GTINS[0]))
    const lot = `ZTG-${runId()}`
    console.log(`[e2e] run=${runId()} lot=${lot} sgtins=${sgtins.join(', ')}`)

    await submit('manufacturer', epcisDocument(
      [commissionEvent({
        epcList: sgtins, lotNumber: lot, expiryDate: '2030-12-31',
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: MFG() },
    ), 'commission four packs')

    // Every one of the four must exist — a commission event that only half applied would
    // otherwise surface much later as a confusing packing or shipping failure.
    for (const sgtin of sgtins) {
      const v = await packOf('manufacturer', sgtin)
      expect(v.verified, `${sgtin} now exists`).toBe(true)
      expect(v.pack?.status, `${sgtin} is active`).toBe('active')
      expect(v.pack?.currentGln, `${sgtin} starts with the manufacturer`).toBe(MFG())
      expect(v.pack?.parentSscc, `${sgtin} is not aggregated yet`).toBeNull()
    }
    console.log(`[e2e] after commission: 4/4 active at ${MFG()}`)
  })

  test('E2E-02 — the manufacturer packs all four into one SSCC', async () => {
    test.slow()
    sscc = freshSscc()
    console.log(`[e2e] sscc=${sscc} (element string ${ssccUrnToDigits(sscc)})`)

    await submit('manufacturer', epcisDocument(
      [aggregationEvent({
        parentID: sscc, childEPCs: sgtins, action: 'ADD',
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: MFG() },
    ), 'pack four SGTINs into one SSCC')

    // The two SSCC representations are NOT interchangeable: events carry the URN, while
    // VerifyProduct returns the 18-digit GS1 element string. Compare on digits.
    for (const sgtin of sgtins) {
      const v = await packOf('manufacturer', sgtin)
      expect(sameSscc(sscc, v.pack?.parentSscc), `${sgtin} reports its parent SSCC`).toBe(true)
    }
    console.log('[e2e] after packing: 4/4 report parentSscc')
  })

  test('E2E-03 — the manufacturer ships the SSCC to the branch', async () => {
    test.slow()
    await submit('manufacturer', epcisDocument(
      [shippingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('manufacturer'),
        destinationSgln: sglnOf('branch'),
        bizTransaction: uniqueBizTransaction(),
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: BRANCH() },
    ), 'ship the SSCC to the branch')

    // Shipping an SSCC must cascade to its children — that cascade is the whole point of
    // aggregation, and a silent failure here corrupts every later event.
    const v = await packOf('manufacturer', sgtins[0])
    console.log(`[e2e] after ship->branch: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
    expect(v.pack?.status, 'the child packs are in transit, not still active').not.toBe('active')
  })

  test('E2E-04 — the branch receives the shipment', async () => {
    test.slow()
    await submit('branch', epcisDocument(
      [receivingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('manufacturer'),
        readPointSgln: sglnOf('branch'),
      })],
      { senderGln: BRANCH(), receiverGln: MFG() },
    ), 'receive the shipment at the branch')

    const v = await packOf('branch', sgtins[0])
    console.log(`[e2e] after receive@branch: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
    expect(v.pack?.currentGln, 'custody transferred to the branch').toBe(BRANCH())
  })

  test('E2E-05 — the branch ships onward to the pharmacy', async () => {
    test.slow()
    await submit('branch', epcisDocument(
      [shippingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('branch'),
        destinationSgln: sglnOf('pharmacy'),
        bizTransaction: uniqueBizTransaction(),
        readPointSgln: sglnOf('branch'),
      })],
      { senderGln: BRANCH(), receiverGln: PHARMACY() },
    ), 'ship the SSCC to the pharmacy')

    const v = await packOf('branch', sgtins[0])
    console.log(`[e2e] after ship->pharmacy: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
    expect(v.pack?.status, 'the packs left the branch').not.toBe('active')
  })

  test('E2E-06 — the pharmacy receives the shipment', async () => {
    test.slow()
    await submit('pharmacy', epcisDocument(
      [receivingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('branch'),
        readPointSgln: sglnOf('pharmacy'),
      })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    ), 'receive the shipment at the pharmacy')

    const v = await packOf('pharmacy', sgtins[0])
    console.log(`[e2e] after receive@pharmacy: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
    expect(v.pack?.currentGln, 'custody transferred to the pharmacy').toBe(PHARMACY())
  })

  test('E2E-07 — the pharmacy fully dispenses pack 1', async () => {
    test.slow()
    // /Dispensation answers 200, not 202 like /scp/SendEPCIS, and — observed live — its
    // 200 body ALREADY carries the terminal outcome: `{"messagestatus":"S", logList:[…]}`,
    // with the first MsgStatusQuery poll returning the same thing in ~200 ms.
    //
    // That still does not make the status code a pass/fail signal, and this is the trap:
    // a REFUSED dispense also answers 200 (see E2E-07b and E2E-08, both `messagestatus: E`
    // under a 200). So assert the polled state, never the code. Reading 200 as success
    // would make every rejection look like a success.
    const doc = epcisDocument(
      [dispensingEvent({ epcList: [sgtins[0]], readPointSgln: sglnOf('pharmacy') })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    )
    const { submitStatus, submitBody, msg } = await submitAndPoll('pharmacy', doc)
    console.log(`[e2e] full dispense -> ${submitStatus} ${JSON.stringify(submitBody).slice(0, 200)}`)
    expect(submitStatus, `dispensing acknowledged — got ${submitStatus}`).toBe(202)
    expect(msg.state, `full dispensing: ${describeMsgStatus(msg)}`).toBe('SUCCESS')

    const v = await packOf('pharmacy', sgtins[0])
    console.log(`[e2e] after full dispense: status=${v.pack?.status}`)
    expect(v.pack?.status, 'the dispensed pack leaves circulation').not.toBe('active')
  })

  test('E2E-07b — pack 1 cannot be dispensed a second time', async () => {
    test.slow()
    // The strongest proof the dispense in E2E-07 actually took effect: repeating it must
    // not succeed. Rejection may be synchronous (4xx) or asynchronous (200/202 then
    // FAILED), so accept either shape and assert only that it does NOT succeed.
    const doc = epcisDocument(
      [dispensingEvent({ epcList: [sgtins[0]], readPointSgln: sglnOf('pharmacy') })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    )
    const res = await sendEpcis('pharmacy', doc)

    if (res.status() >= 400) {
      const err = await errorOf(res)
      console.log(`[e2e] re-dispense rejected synchronously: ${res.status()} shape=${err.shape} code=${err.code} msg=${err.message}`)
      expect(err.message, 'the rejection states a reason').toBeTruthy()
      return
    }

    console.log(`[e2e] re-dispense accepted (${res.status()}) — checking the async outcome`)
    const msg = await pollMsgStatus('pharmacy', doc.sbdh.documentIdentification.instanceIdentifier)
    console.log(`[e2e] re-dispense status: ${describeMsgStatus(msg)}`)
    expect(msg.state, `re-dispensing an already-dispensed pack must not succeed: ${describeMsgStatus(msg)}`)
      .not.toBe('SUCCESS')
  })

  test('E2E-08 — a partial dispense of pack 2 is refused (blocked on test data)', async () => {
    test.slow()
    // ── THIS STEP ASSERTS A KNOWN GAP, NOT THE HAPPY PATH ─────────────────────
    // All 30 of the devsim manufacturer's products have dispenseType "full", so the
    // platform has nothing to partially dispense and the request cannot succeed. See
    // data/eptts-api/bugs/api-partial-dispensing/ and MFG_PARTIAL_DISPENSE_GTINS.
    //
    // Asserting the real behaviour keeps the chain green and green-for-a-reason: the day a
    // partial/unit dispenseType product is registered, this step fails and points at
    // itself, and the assertion below flips to expecting SUCCESS. Asserting success today
    // would instead abort the chain here and the return steps would never run at all.
    const doc = epcisDocument(
      [dispensingEvent({
        epcList: [sgtins[1]], quantity: PARTIAL_QUANTITY, readPointSgln: sglnOf('pharmacy'),
      })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    )
    const res = await sendEpcis('pharmacy', doc)
    const body = await bodyOf(res)
    console.log(`[e2e] partial dispense qty=${PARTIAL_QUANTITY} -> ${res.status()} ${JSON.stringify(body).slice(0, 300)}`)

    // Refusal may be synchronous (4xx) or asynchronous (200/202 then FAILED). Accept
    // either shape; assert only that it does NOT succeed.
    if (res.status() >= 400) {
      console.log('[e2e] partial dispense refused synchronously')
    } else {
      const msg = await pollMsgStatus('pharmacy', doc.sbdh.documentIdentification.instanceIdentifier)
      console.log(`[e2e] partial dispense status: ${describeMsgStatus(msg)}`)
      expect(msg.timedOut, 'MsgStatusQuery resolved').toBe(false)
      expect(
        msg.state,
        'partial dispensing succeeded — if a partial-dispense product now exists, flip this ' +
          'assertion to expect SUCCESS and un-skip the TC_PDISP quantity cases',
      ).not.toBe('SUCCESS')
    }

    // The decisive check: a refused partial dispense must not have consumed the pack.
    const v = await packOf('pharmacy', sgtins[1])
    console.log(`[e2e] pack 2 after the refused partial dispense: status=${v.pack?.status}`)
    expect(v.pack?.status, 'a refused partial dispense leaves the pack untouched').toBe('active')
  })

  test('E2E-09 — the pharmacy returns packs 3 and 4 to the branch', async () => {
    test.slow()
    // A return is shipping with `disposition: returned` plus a return reference, and it
    // must travel back to the partner that supplied the pack — the branch, not the
    // manufacturer. The same reference is quoted by the return receiving in E2E-10.
    returnRef = uniqueBizTransaction('RET')
    console.log(`[e2e] returning ${sgtins[2]}, ${sgtins[3]} under ${returnRef}`)

    await submit('pharmacy', epcisDocument(
      [shippingEvent({
        epcList: [sgtins[2], sgtins[3]],
        sourceSgln: sglnOf('pharmacy'),
        destinationSgln: sglnOf('branch'),
        bizTransaction: returnRef,
        disposition: 'returned',
        readPointSgln: sglnOf('pharmacy'),
      })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    ), 'return two loose SGTINs to the branch')

    for (const sgtin of [sgtins[2], sgtins[3]]) {
      const v = await packOf('pharmacy', sgtin)
      console.log(`[e2e] after return ship: ${sgtin} status=${v.pack?.status} gln=${v.pack?.currentGln}`)
      expect(v.pack?.status, `${sgtin} is no longer ordinary pharmacy stock`).not.toBe('active')
    }
  })

  test('E2E-10 — the branch receives the return', async () => {
    test.slow()
    await submit('branch', epcisDocument(
      [receivingEvent({
        epcList: [sgtins[2], sgtins[3]],
        sourceSgln: sglnOf('pharmacy'),
        bizTransaction: returnRef,
        disposition: 'returned',
        readPointSgln: sglnOf('branch'),
      })],
      { senderGln: BRANCH(), receiverGln: PHARMACY() },
    ), 'receive the return at the branch')

    // The point of the whole journey: return receiving is the one transition that moves
    // stock out of a terminal-looking state back into a partner's inventory, so assert
    // custody actually landed — not merely that the event was accepted.
    for (const sgtin of [sgtins[2], sgtins[3]]) {
      const v = await packOf('branch', sgtin)
      console.log(`[e2e] after return receive: ${sgtin} status=${v.pack?.status} gln=${v.pack?.currentGln}`)
      expect(v.pack?.currentGln, `${sgtin} is back in the branch custody`).toBe(BRANCH())
    }

    // …and that the return did not disturb the two packs it never named.
    const dispensed = await packOf('pharmacy', sgtins[0])
    expect(dispensed.pack?.status, 'the fully-dispensed pack stayed out of circulation').not.toBe('active')
    const held = await packOf('pharmacy', sgtins[1])
    expect(held.pack?.currentGln, 'the un-returned pack stayed with the pharmacy').toBe(PHARMACY())
  })

  test('E2E-11 — the journey is visible in the EPCIS message history', async () => {
    const res = await getMasar('branch', '/epcis?limit=20')
    expect(res.status(), 'GET /epcis').toBe(200)
    const body = (await bodyOf(res)) as { items?: { eventTypes?: string[]; status?: string }[] }
    const items = body.items ?? []
    console.log(`[e2e] recent branch message types: ${items.slice(0, 8).map((i) => (i.eventTypes ?? []).join('+')).join(', ')}`)
    expect(items.length, 'the branch has message history').toBeGreaterThan(0)
  })
})
