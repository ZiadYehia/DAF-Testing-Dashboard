/**
 * EPTTS API — the complete pharmaceutical supply-chain lifecycle, forward and reverse.
 *
 * ONE product, ONE SSCC, tracked from the moment it is brought into existence to the moment
 * it is destroyed, with the correct trade partner acting at every step:
 *
 *   MANUFACTURER   commission ─→ pack ─→ ship
 *   BRANCH                        receive ─→ ship
 *   PHARMACY                                 receive ─→ unpack ─→ dispense
 *   ── reverse ──────────────────────────────────────────────────────────────────
 *   PHARMACY       return-ship ─→
 *   BRANCH                        return-receive ─→ return-ship ─→
 *   MANUFACTURER                                    return-receive ─→ destroy
 *
 * HAPPY PATH ONLY. Every step here is a business operation that is supposed to succeed.
 * Negative and error scenarios live in the per-case projects (`eptts-api-<feature>-<id>`),
 * where each has its own id, its own report row and its own replay. Mixing them in would
 * make this journey's purpose ambiguous: it exists to prove the steps COMPOSE.
 *
 * ── WHAT MAKES THIS DIFFERENT FROM ACCEPTING A 202 ───────────────────────────────────────
 *
 * After EVERY transition the pack is read back through POST /VerifyProduct and its business
 * state asserted — status, custodian GLN, parent SSCC, and on the first step the batch and
 * expiry that were declared. That is not belt-and-braces. Measured on this platform, an
 * unauthorised shipment answered "S - Successful", left `currentGln` unchanged and still
 * flipped `status` to in_transit (see TC_SHIP_014): half-applied. A journey that trusted the
 * verdict would have called that a pass.
 *
 * VerifyProduct is the right instrument for it because it takes ONE SGTIN and returns that
 * pack's own record — no paging window, no guessing which row belongs to our submission,
 * which is exactly what a GET /epcis scan cannot offer (its filters are accepted and
 * ignored; see the note in lib/eptts-api.ts).
 *
 * ── WHY TWO PACKS AND NOT ONE ────────────────────────────────────────────────────────────
 *
 * A dispensed pack is consumed — it cannot then be returned upstream or destroyed, and it
 * should not be. So the SSCC carries two packs of the SAME product and the same lot:
 *
 *   PACK 1  is dispensed at the pharmacy       (the forward path's natural terminus)
 *   PACK 2  travels the whole reverse path back to the manufacturer and is destroyed
 *
 * Both are verified at every shared step, which also proves the SSCC cascade reaches every
 * child rather than just the first — and from the dispense onward each is verified
 * separately, which proves an operation touched only the pack it named.
 *
 * ── ASSERTED VS OBSERVED ─────────────────────────────────────────────────────────────────
 *
 * Every asserted claim is grounded either in the verified live contract
 * (`data/eptts-api/modules/eptts-apis/knowledge/verified-live-contract.md`) or in a
 * currently-green per-case test. Where the contract does not pin a value — the status a pack
 * lands in mid-return, for instance — the assertion names the set of states the business
 * rule permits and the row prints which one actually occurred, rather than silently
 * accepting anything. Anything genuinely unestablished is printed as an observation and
 * marked as such, never asserted.
 *
 * A mismatch on `currentGln` or `status` here is therefore a finding about the platform, not
 * a flaky test. The documented rule is: custody moves on RECEIPT, never on despatch.
 *
 * ── WRITES TO PRODUCTION ─────────────────────────────────────────────────────────────────
 *
 * Every EPC uses a run-scoped `ZTG…` serial so repeated runs never collide and our data
 * stays identifiable afterwards. Ordered and stateful by design (`describe.serial`): a
 * failure stops the chain, because every later step is meaningless without the one before.
 */
import { test, expect } from '@playwright/test'
import {
  submitAndPoll, dispensation, pollMsgStatus, describeMsgStatus, bodyOf, getMasar,
  authenticate, decodeClaims, platformRoleFor, productByGtin,
  epcisDocument, commissionEvent, aggregationEvent, shippingEvent, receivingEvent,
  dispensingEvent, destructionEvent,
  freshDispensableSgtin, freshSscc, sglnOf, glnFor, runId, ssccUrnToDigits,
  uniqueBizTransaction, disposeApi,
  MFG_DISPENSABLE_GTINS,
  type EpcisDocument, type Role, type MsgStatus,
} from '../../lib/eptts-api'
import { writeApiArtifacts } from '../../lib/eptts-api-log'
import {
  beginStep, recordSubmission, recordNoSubmission, verifyPack, verifyFact, printFinalSummary,
} from '../../lib/eptts-e2e-report'

const MFG = () => glnFor('manufacturer')
const BRANCH = () => glnFor('branch')
const PHARMACY = () => glnFor('pharmacy')

/**
 * The demo product. NON-Dawana on purpose: 27 of the manufacturer's 30 products carry
 * `isDawanaIntegration: true` and the platform refuses to dispense those through this
 * channel, so a journey ending in a dispense must pick from the dispensable list or it
 * fails for a reason that has nothing to do with the lifecycle.
 */
const DEMO_GTIN = MFG_DISPENSABLE_GTINS[0]
const EXPIRY = '2030-12-31'

/** Every pack in the SSCC. Index 0 is dispensed; index 1 makes the whole round trip. */
const PACK_COUNT = 2

/** The last step's id — the run's combined request/response log is written from it. */
const FINAL_STEP = '14'

// ─── shared journey state ────────────────────────────────────────────────────

let sgtins: string[] = []
/** The pack dispensed at the pharmacy. */
let sgtinDispensed = ''
/** The pack returned all the way to the manufacturer and destroyed. */
let sgtinReturned = ''
let sscc = ''
let lot = ''
/** Return reference for the pharmacy → branch leg, quoted again by the branch's receive. */
let returnRefToBranch = ''
/** Return reference for the branch → manufacturer leg. */
let returnRefToMfg = ''

// ─── submission helpers ──────────────────────────────────────────────────────

/**
 * Submit an EPCIS document and require it to be both accepted AND processed.
 *
 * The 202 is only "queued" — the outcome exists after MsgStatusQuery reaches a terminal
 * state. Stopping at the status code verifies almost nothing.
 */
async function submitStep(role: Role, doc: EpcisDocument, what: string): Promise<void> {
  const { submitStatus, msg } = await submitAndPoll(role, doc)
  recordSubmission(
    `POST /scp/SendEPCIS → HTTP ${submitStatus}  ·  MsgStatusQuery → "${msg.raw ?? '(no status)'}" ` +
    `(${msg.state}, ${msg.pollCount} poll${msg.pollCount === 1 ? '' : 's'})`,
  )
  // Record the platform's own verdict as a row BEFORE asserting on it. Without this a
  // refused transition left the step with zero read-backs, and the summary printed
  // "NO CHECK" — which reads as "the journey forgot to verify" when what actually
  // happened is "the platform refused, and here is its reason".
  noteVerdict(msg)
  expect(submitStatus, `${what}: not accepted for processing (HTTP ${submitStatus})`).toBe(202)
  expect(msg.state, `${what}: ${describeMsgStatus(msg)}`).toBe('SUCCESS')
}

/**
 * Turn the polled message status into a PASS/FAIL row, quoting the platform's per-event log
 * when it refused. On a refusal this is the most important line in the report.
 */
function noteVerdict(msg: MsgStatus): void {
  const reason = msg.logs.filter((l) => l.type !== 'I').map((l) => l.message).join(' | ')
  verifyFact(
    'transition processed',
    'MsgStatusQuery → SUCCESS',
    msg.state === 'SUCCESS' ? 'SUCCESS' : `${msg.state} — ${reason || msg.raw || 'no reason given'}`,
    msg.state === 'SUCCESS',
    'platform verdict on the event',
  )
}

/**
 * Submit a dispense.
 *
 * `/Dispensation` is asynchronous, and its acknowledgement code is NOT stable across
 * environments: devsim answers **200** where every other submission endpoint answers 202,
 * and the ngrok relay answers **202** for the same document (measured 2026-09-07). Both are
 * accepted here because the code is not the pass/fail signal — a REFUSED dispense is
 * acknowledged just as cheerfully. The polled status is the only verdict.
 */
async function dispenseStep(role: Role, doc: EpcisDocument, what: string): Promise<void> {
  const res = await dispensation(role, doc)
  const body = await bodyOf(res)
  expect([200, 202], `${what}: not acknowledged — HTTP ${res.status()} ${JSON.stringify(body).slice(0, 200)}`)
    .toContain(res.status())
  const msg = await pollMsgStatus(role, doc.sbdh.documentIdentification.instanceIdentifier)
  recordSubmission(
    `POST /Dispensation → HTTP ${res.status()}  ·  MsgStatusQuery → "${msg.raw ?? '(no status)'}" ` +
    `(${msg.state}, ${msg.pollCount} poll${msg.pollCount === 1 ? '' : 's'})`,
  )
  noteVerdict(msg)
  expect(msg.state, `${what}: ${describeMsgStatus(msg)}`).toBe('SUCCESS')
}

// ─── run artifacts ───────────────────────────────────────────────────────────

/**
 * One combined request/response log for the whole journey.
 *
 * Written from the LAST step that actually runs — the final one when the lifecycle
 * completes, or the failing one when it does not, which is when someone needs to see what
 * was sent. Writing after every step instead would leave several api-log.html files in the
 * output dir, and engine/runner.ts lifts whichever it finds first — so the Hub could show
 * step 1's log for a chain that failed at step 12.
 */
let logged = false
async function logJourney(): Promise<void> {
  if (logged) return
  logged = true
  await writeApiArtifacts(`EPTTS API — E2E lifecycle: commission → dispense → return → destroy (run ${runId()})`)
}

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== 'passed' || testInfo.title.includes(`STEP ${FINAL_STEP}`)) await logJourney()
})

test.afterAll(async () => {
  printFinalSummary(
    `EPTTS END-TO-END LIFECYCLE — RUN ${runId()}  ·  GTIN ${DEMO_GTIN}  ·  LOT ${lot || '(not reached)'}`,
  )
  await disposeApi()
})

// ─────────────────────────────────────────────────────────────────────────────

test.describe.serial('EPTTS end-to-end lifecycle: manufacturer → branch → pharmacy → back → destroyed', () => {
  test('STEP 00 — the three trade partners authenticate as themselves', async () => {
    test.slow()
    console.log('')
    console.log('EPTTS END-TO-END SUPPLY-CHAIN LIFECYCLE — HAPPY PATH')
    console.log(`  run id      ${runId()}   (every EPC below is scoped to it)`)
    console.log(`  product     GTIN ${DEMO_GTIN} (non-Dawana, dispensable through this API)`)
    console.log(`  partners    MANUFACTURER ${MFG()}  →  BRANCH ${BRANCH()}  →  PHARMACY ${PHARMACY()}`)
    console.log('  flow        commission → pack → ship → receive → ship → receive → unpack →')
    console.log('              dispense → return → return-receive → return → return-receive → destroy')

    beginStep({
      n: '00', title: 'identity & preconditions', role: 'manufacturer',
      operation: 'POST /auth (registry-service) as each of the three roles',
      expectedState: 'each B2B token names the right platform role and the right entity GLN',
      epcs: ['(no EPC — this step establishes who is acting)'],
    })
    recordNoSubmission('POST /auth → 200 with a 15-minute bearer token per role')

    // The journey's central claim is "the correct role at every step". A token that
    // silently belonged to another entity would make every later custody assertion
    // meaningless, so prove the identities before using them.
    for (const role of ['manufacturer', 'branch', 'pharmacy'] as const) {
      const claims = decodeClaims(await authenticate(role))
      verifyFact('token role', platformRoleFor(role), claims.role,
        claims.role === platformRoleFor(role), `${role.toUpperCase()} B2B token`)
      verifyFact('token entityGln', glnFor(role), claims.entityGln,
        claims.entityGln === glnFor(role), `${role.toUpperCase()} B2B token`)
    }

    /**
     * Master data, when it is readable.
     *
     * NOT asserted as a gate: GET /products on masar-service is absent from the verified
     * endpoint guard matrix, so a tenant where it 404s would fail this step for a reason
     * that has nothing to do with the lifecycle. Where it does answer, the three fields
     * that decide whether the flow below is even legal are worth showing. The claims they
     * cover are proved anyway by the operations themselves — a Dawana-integrated product
     * cannot reach step 08, and an unpriced one cannot be packed at step 02.
     */
    const product = await productByGtin('manufacturer', DEMO_GTIN)
    if (!product) {
      console.log(` OBSERVED   GET /products did not return ${DEMO_GTIN} — master-data preconditions ` +
        'not verified here (they are implied by steps 02 and 08 succeeding)')
    } else {
      verifyFact('isActive', 'true', String(product.isActive), product.isActive === true,
        `product ${DEMO_GTIN} master data`)
      verifyFact('isDawanaIntegration', 'false (dispensable via this API)',
        String(product.isDawanaIntegration), product.isDawanaIntegration === false,
        `product ${DEMO_GTIN} master data`)
      verifyFact('unitPriceCents', 'a registered price (not null)',
        String(product.unitPriceCents), product.unitPriceCents != null,
        `product ${DEMO_GTIN} master data`)
      console.log(` OBSERVED   name="${product.name}" dispenseType=${product.dispenseType} ` +
        `pricingReviewStatus=${product.pricingReviewStatus}`)
    }
  })

  test('STEP 01 — MANUFACTURER commissions the packs', async () => {
    test.slow()
    sgtins = Array.from({ length: PACK_COUNT }, () => freshDispensableSgtin(DEMO_GTIN))
    sgtinDispensed = sgtins[0]
    sgtinReturned = sgtins[1]
    lot = `ZTG-${runId()}`

    beginStep({
      n: '01', title: 'commission', role: 'manufacturer',
      operation: 'ObjectEvent · action=ADD · bizStep=commissioning · disposition=active',
      expectedState: `both packs exist, are active, held by the manufacturer, in no container, ` +
        `lot ${lot} expiring ${EXPIRY}`,
      epcs: sgtins,
    })

    await submitStep('manufacturer', epcisDocument(
      [commissionEvent({
        epcList: sgtins, lotNumber: lot, expiryDate: EXPIRY,
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: MFG() },
    ), 'commission both packs')

    // Every pack must exist. A commission that only half applied would otherwise surface
    // much later as a confusing packing or shipping failure.
    for (const [i, sgtin] of sgtins.entries()) {
      await verifyPack('manufacturer', sgtin, {
        verified: true,
        status: 'active',
        custodyGln: MFG(),
        parentSscc: null,
        gtin: DEMO_GTIN,
        batchNumber: lot,
        expiryDate: EXPIRY,
        isRecalled: false,
      }, `PACK ${i + 1} ${i === 0 ? '(to be dispensed)' : '(to make the round trip)'}`)
    }
  })

  test('STEP 02 — MANUFACTURER packs both into one SSCC', async () => {
    test.slow()
    sscc = freshSscc()

    beginStep({
      n: '02', title: 'pack (aggregate)', role: 'manufacturer',
      operation: 'AggregationEvent · action=ADD · bizStep=packing',
      expectedState: `both packs report SSCC ${ssccUrnToDigits(sscc)} as their parent, stay active, ` +
        'and do NOT change hands — packing is containment, not custody',
      epcs: [sscc, `  ↳ element string ${ssccUrnToDigits(sscc)}`, ...sgtins],
    })

    await submitStep('manufacturer', epcisDocument(
      [aggregationEvent({
        parentID: sscc, childEPCs: sgtins, action: 'ADD',
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: MFG() },
    ), 'pack both SGTINs into one SSCC')

    for (const [i, sgtin] of sgtins.entries()) {
      await verifyPack('manufacturer', sgtin, {
        status: 'active',        // packing does NOT change status
        custodyGln: MFG(),       // …and does NOT move custody
        parentSscc: sscc,        // what it DOES change
      }, `PACK ${i + 1}`)
    }
  })

  test('STEP 03 — MANUFACTURER ships the SSCC to the BRANCH', async () => {
    test.slow()
    // Unique PER SHIPMENT: the platform refuses a reused invoice number, because an invoice
    // number is how a shipment is identified.
    const invoice = uniqueBizTransaction()

    beginStep({
      n: '03', title: 'ship → branch', role: 'manufacturer',
      operation: `ObjectEvent · bizStep=shipping · disposition=in_transit · invoice ${invoice}`,
      expectedState: 'both children go in_transit; custody stays with the MANUFACTURER — ' +
        'custody moves on receipt, never on despatch',
      epcs: [sscc],
    })

    await submitStep('manufacturer', epcisDocument(
      [shippingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('manufacturer'),
        destinationSgln: sglnOf('branch'),
        bizTransaction: invoice,
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: BRANCH() },
    ), 'ship the SSCC to the branch')

    // Shipping an SSCC must cascade to its children — that cascade is the whole point of
    // aggregation, and a silent failure here corrupts every later event.
    for (const [i, sgtin] of sgtins.entries()) {
      await verifyPack('manufacturer', sgtin, {
        status: 'in_transit',
        custodyGln: MFG(),
        parentSscc: sscc,
      }, `PACK ${i + 1}`)
    }
  })

  test('STEP 04 — BRANCH receives the shipment', async () => {
    test.slow()
    beginStep({
      n: '04', title: 'receive at branch', role: 'branch',
      operation: 'ObjectEvent · bizStep=receiving · disposition=in_progress · source=manufacturer',
      expectedState: 'custody transfers to the BRANCH and the packs are active stock again ' +
        '(there is no distinct "received" status)',
      epcs: [sscc],
    })

    await submitStep('branch', epcisDocument(
      [receivingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('manufacturer'),
        readPointSgln: sglnOf('branch'),
      })],
      { senderGln: BRANCH(), receiverGln: MFG() },
    ), 'receive the shipment at the branch')

    for (const [i, sgtin] of sgtins.entries()) {
      await verifyPack('branch', sgtin, {
        status: 'active',
        custodyGln: BRANCH(),
        parentSscc: sscc,     // receiving must not disturb the container
      }, `PACK ${i + 1}`)
    }
  })

  test('STEP 05 — BRANCH ships onward to the PHARMACY', async () => {
    test.slow()
    const invoice = uniqueBizTransaction()

    beginStep({
      n: '05', title: 'ship → pharmacy', role: 'branch',
      operation: `ObjectEvent · bizStep=shipping · disposition=in_transit · invoice ${invoice}`,
      expectedState: 'both children go in_transit; custody stays with the BRANCH until the ' +
        'pharmacy receives',
      epcs: [sscc],
    })

    await submitStep('branch', epcisDocument(
      [shippingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('branch'),
        destinationSgln: sglnOf('pharmacy'),
        bizTransaction: invoice,
        readPointSgln: sglnOf('branch'),
      })],
      { senderGln: BRANCH(), receiverGln: PHARMACY() },
    ), 'ship the SSCC to the pharmacy')

    for (const [i, sgtin] of sgtins.entries()) {
      await verifyPack('branch', sgtin, {
        status: 'in_transit',
        custodyGln: BRANCH(),
        parentSscc: sscc,
      }, `PACK ${i + 1}`)
    }
  })

  test('STEP 06 — PHARMACY receives the shipment', async () => {
    test.slow()
    beginStep({
      n: '06', title: 'receive at pharmacy', role: 'pharmacy',
      operation: 'ObjectEvent · bizStep=receiving · disposition=in_progress · source=branch',
      expectedState: 'custody transfers to the PHARMACY and the packs are active stock',
      epcs: [sscc],
    })

    await submitStep('pharmacy', epcisDocument(
      [receivingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('branch'),
        readPointSgln: sglnOf('pharmacy'),
      })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    ), 'receive the shipment at the pharmacy')

    for (const [i, sgtin] of sgtins.entries()) {
      await verifyPack('pharmacy', sgtin, {
        status: 'active',
        custodyGln: PHARMACY(),
        parentSscc: sscc,
      }, `PACK ${i + 1}`)
    }
  })

  test('STEP 07 — PHARMACY unpacks the SSCC onto the shelf', async () => {
    test.slow()
    /**
     * ADDED TO THE JOURNEY, and it is not decoration.
     *
     * A pharmacy receives a shipper case and breaks it down into individual packs; nothing
     * downstream is realistic without it. It is also what makes the reverse path possible:
     * one pack is about to be consumed while the other must travel back on its own, and a
     * container cannot be half-dispensed. Disaggregating first is the correct business
     * operation for that, rather than returning a container whose contents no longer match.
     *
     * The holder is the party that may unpack (TS_UNPK_010 proves the equivalent at the
     * branch), so this is the PHARMACY's event, not the manufacturer's.
     */
    beginStep({
      n: '07', title: 'unpack (disaggregate)', role: 'pharmacy',
      operation: 'AggregationEvent · action=DELETE · bizStep=unpacking',
      expectedState: 'both packs lose their parent SSCC, stay active, and stay with the ' +
        'PHARMACY — unpacking is containment, not custody',
      epcs: [sscc, ...sgtins],
    })

    await submitStep('pharmacy', epcisDocument(
      [aggregationEvent({
        parentID: sscc, childEPCs: sgtins, action: 'DELETE',
        readPointSgln: sglnOf('pharmacy'),
      })],
      { senderGln: PHARMACY(), receiverGln: PHARMACY() },
    ), 'unpack both children at the pharmacy')

    for (const [i, sgtin] of sgtins.entries()) {
      await verifyPack('pharmacy', sgtin, {
        status: 'active',
        custodyGln: PHARMACY(),
        parentSscc: null,     // the point of the step
      }, `PACK ${i + 1}`)
    }
  })

  test('STEP 08 — PHARMACY dispenses PACK 1 to a patient', async () => {
    test.slow()
    beginStep({
      n: '08', title: 'dispense', role: 'pharmacy',
      operation: 'POST /Dispensation · ObjectEvent · bizStep=retail_selling · disposition=retail_sold',
      expectedState: 'PACK 1 becomes dispensed and stays with the PHARMACY (dispensing consumes, ' +
        'it does not transfer); PACK 2 is untouched',
      epcs: [sgtinDispensed],
    })

    // Exactly one EPC: the platform refuses a batched dispense ("Dispense event must contain
    // exactly 1 EPC"), which is coherent — a dispense is recorded against one prescription
    // line, so one event per pack keeps the audit trail attributable.
    await dispenseStep('pharmacy', epcisDocument(
      [dispensingEvent({ epcList: [sgtinDispensed], readPointSgln: sglnOf('pharmacy') })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    ), 'dispense PACK 1')

    await verifyPack('pharmacy', sgtinDispensed, {
      status: 'dispensed',
      custodyGln: PHARMACY(),
      parentSscc: null,
    }, 'PACK 1 (dispensed)')

    // The operation must have touched only the pack it named. This is the cheapest proof
    // that a per-EPC event is not quietly applying to the whole former container.
    await verifyPack('pharmacy', sgtinReturned, {
      status: 'active',
      custodyGln: PHARMACY(),
      parentSscc: null,
    }, 'PACK 2 (must be untouched)')
  })

  test('STEP 09 — PHARMACY returns PACK 2 upstream to the BRANCH', async () => {
    test.slow()
    /**
     * A return is shipping with `disposition: returned` plus a return reference, and it must
     * travel back to the partner that SUPPLIED the pack — the branch, not the manufacturer.
     * The same reference is quoted by the branch's return receiving in step 10; that is how
     * the platform matches the two halves.
     */
    returnRefToBranch = uniqueBizTransaction('RET')

    beginStep({
      n: '09', title: 'return-ship → branch', role: 'pharmacy',
      operation: `ObjectEvent · bizStep=shipping · disposition=returned · ref ${returnRefToBranch}`,
      expectedState: 'PACK 2 leaves pharmacy stock (in_transit/returned) while custody stays ' +
        'with the PHARMACY until the branch receives it',
      epcs: [sgtinReturned],
    })

    await submitStep('pharmacy', epcisDocument(
      [shippingEvent({
        epcList: [sgtinReturned],
        sourceSgln: sglnOf('pharmacy'),
        destinationSgln: sglnOf('branch'),
        bizTransaction: returnRefToBranch,
        disposition: 'returned',
        readPointSgln: sglnOf('pharmacy'),
      })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    ), 'return PACK 2 to the branch')

    await verifyPack('pharmacy', sgtinReturned, {
      // The contract pins "not ordinary stock any more" but not which of the two labels a
      // return in flight carries, so both are accepted and the row prints the real one.
      status: ['in_transit', 'returned'],
      custodyGln: PHARMACY(),
      parentSscc: null,
    }, 'PACK 2 (in return transit)')
  })

  test('STEP 10 — BRANCH return-receives PACK 2', async () => {
    test.slow()
    beginStep({
      n: '10', title: 'return-receive at branch', role: 'branch',
      operation: `ObjectEvent · bizStep=receiving · disposition=returned · ref ${returnRefToBranch}`,
      expectedState: 'custody returns to the BRANCH and PACK 2 is back in its inventory',
      epcs: [sgtinReturned],
    })

    await submitStep('branch', epcisDocument(
      [receivingEvent({
        epcList: [sgtinReturned],
        sourceSgln: sglnOf('pharmacy'),
        bizTransaction: returnRefToBranch,
        disposition: 'returned',
        readPointSgln: sglnOf('branch'),
      })],
      { senderGln: BRANCH(), receiverGln: PHARMACY() },
    ), 'receive the return at the branch')

    // Return receiving is the ONE transition that moves stock out of a terminal-looking
    // state back into a partner's inventory, so custody landing is the whole point.
    await verifyPack('branch', sgtinReturned, {
      status: ['active', 'returned'],
      custodyGln: BRANCH(),
      parentSscc: null,
    }, 'PACK 2 (back at the branch)')

    // …and the return must not have disturbed the pack it never named.
    await verifyPack('pharmacy', sgtinDispensed, {
      status: 'dispensed',
      custodyGln: PHARMACY(),
    }, 'PACK 1 (must stay dispensed)')
  })

  test('STEP 11 — BRANCH returns PACK 2 on to the MANUFACTURER', async () => {
    test.slow()
    /**
     * The second leg of the reverse chain, and the one that makes it a chain rather than a
     * single hop: a return travels upstream one partner at a time, so the branch returns to
     * the party that supplied IT — the manufacturer.
     *
     * THE LEAST-PROVEN STEP IN THIS JOURNEY, AND WORTH WATCHING ON THE FIRST LIVE RUN.
     * Both halves exist as green per-case tests — a branch returning to the manufacturer
     * (TS_RTN_001) and the manufacturer receiving it (TS_RTRV_001) — but in those the pack
     * reached the branch by an ordinary receive. Here it reached the branch by a RETURN, so
     * this is the same pack being returned a second time, one hop further up. TS_RTN_017
     * refuses re-returning stock the branch already returned, and TS_RTN_018 (the SGTIN
     * variant) is unwritten pending a PO decision, so whether a multi-hop return is allowed
     * is not established by any existing test.
     *
     * It has to be attempted, because a reverse supply chain that cannot pass goods beyond
     * the first partner upstream is not a reverse supply chain. If the platform refuses it,
     * this step fails with the platform's own reason and that IS the finding — not a defect
     * in the journey.
     */
    returnRefToMfg = uniqueBizTransaction('RET')

    beginStep({
      n: '11', title: 'return-ship → manufacturer', role: 'branch',
      operation: `ObjectEvent · bizStep=shipping · disposition=returned · ref ${returnRefToMfg}`,
      expectedState: 'PACK 2 leaves branch stock while custody stays with the BRANCH until the ' +
        'manufacturer receives it',
      epcs: [sgtinReturned],
    })

    await submitStep('branch', epcisDocument(
      [shippingEvent({
        epcList: [sgtinReturned],
        sourceSgln: sglnOf('branch'),
        destinationSgln: sglnOf('manufacturer'),
        bizTransaction: returnRefToMfg,
        disposition: 'returned',
        readPointSgln: sglnOf('branch'),
      })],
      { senderGln: BRANCH(), receiverGln: MFG() },
    ), 'return PACK 2 to the manufacturer')

    await verifyPack('branch', sgtinReturned, {
      status: ['in_transit', 'returned'],
      custodyGln: BRANCH(),
      parentSscc: null,
    }, 'PACK 2 (in return transit)')
  })

  test('STEP 12 — MANUFACTURER return-receives PACK 2 and has custody again', async () => {
    test.slow()
    beginStep({
      n: '12', title: 'return-receive at mfg', role: 'manufacturer',
      operation: `ObjectEvent · bizStep=receiving · disposition=returned · ref ${returnRefToMfg}`,
      expectedState: `custody returns to the MANUFACTURER (${MFG()}) — the round trip closes`,
      epcs: [sgtinReturned],
    })

    await submitStep('manufacturer', epcisDocument(
      [receivingEvent({
        epcList: [sgtinReturned],
        sourceSgln: sglnOf('branch'),
        bizTransaction: returnRefToMfg,
        disposition: 'returned',
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: BRANCH() },
    ), 'receive the return at the manufacturer')

    // The requirement this journey exists to demonstrate: the manufacturer holds it again.
    await verifyPack('manufacturer', sgtinReturned, {
      verified: true,
      status: ['active', 'returned'],
      custodyGln: MFG(),
      parentSscc: null,
      gtin: DEMO_GTIN,
      batchNumber: lot,      // still the same physical pack, same lot, after ten transitions
      isRecalled: false,
    }, 'PACK 2 (back with the manufacturer)')
  })

  test('STEP 13 — MANUFACTURER destroys PACK 2', async () => {
    test.slow()
    // Destroying is only for the party that holds the goods (a pack owned by another party
    // cannot be destroyed — TC_DEST_014), which is precisely why step 12 had to land first.
    beginStep({
      n: '13', title: 'destroy', role: 'manufacturer',
      operation: 'ObjectEvent · action=DELETE · bizStep=destroying · disposition=destroyed',
      expectedState: 'PACK 2 becomes destroyed and permanently leaves the supply chain',
      epcs: [sgtinReturned],
    })

    await submitStep('manufacturer', epcisDocument(
      [destructionEvent({ epcList: [sgtinReturned], readPointSgln: sglnOf('manufacturer') })],
      { senderGln: MFG(), receiverGln: MFG() },
    ), 'destroy PACK 2')

    await verifyPack('manufacturer', sgtinReturned, {
      status: 'destroyed',
      custodyGln: MFG(),
    }, 'PACK 2 (destroyed)')
  })

  test(`STEP ${FINAL_STEP} — the final state of both packs, and the audit trail`, async () => {
    test.slow()
    beginStep({
      n: FINAL_STEP, title: 'final state & audit', role: 'manufacturer',
      operation: 'POST /VerifyProduct on both packs · GET /epcis for the message history',
      expectedState: 'PACK 1 dispensed at the pharmacy, PACK 2 destroyed at the manufacturer, ' +
        'and the tenant has an EPCIS message history',
      epcs: sgtins,
    })
    recordNoSubmission('read-only — no business event is submitted by this step')

    // Read the terminal state of each pack back one final time, from the party that holds
    // it. Two different terminal states from one lot and one container.
    await verifyPack('pharmacy', sgtinDispensed, {
      verified: true,
      status: 'dispensed',
      custodyGln: PHARMACY(),
      gtin: DEMO_GTIN,
      batchNumber: lot,
    }, 'PACK 1 FINAL — dispensed to a patient')

    await verifyPack('manufacturer', sgtinReturned, {
      verified: true,
      status: 'destroyed',
      custodyGln: MFG(),
      gtin: DEMO_GTIN,
      batchNumber: lot,
    }, 'PACK 2 FINAL — returned and destroyed')

    /**
     * The message history, asserted for exactly what it can prove.
     *
     * GET /epcis accepts ?messageId=, ?instanceIdentifier= and ?limit= and IGNORES all of
     * them (measured 2026-09-07), so it cannot be aimed at this run's submissions. It is
     * therefore asserted as "the tenant has a readable EPCIS message history" and nothing
     * more — the per-pack claims above are what prove this journey's events landed.
     */
    const res = await getMasar('manufacturer', '/epcis?limit=20')
    const body = (await bodyOf(res)) as { items?: { eventTypes?: string[]; status?: string }[] } | null
    const items = body?.items ?? []
    verifyFact('GET /epcis', 'HTTP 200 with a readable message history',
      `HTTP ${res.status()}, ${items.length} message(s)`,
      res.status() === 200 && items.length > 0, 'EPCIS audit trail (tenant-wide, not filterable)')
    console.log(` OBSERVED   recent message types: ${
      items.slice(0, 8).map((i) => (i.eventTypes ?? []).join('+')).join(', ') || '(none)'}`)
  })
})
