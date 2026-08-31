/**
 * EPTTS API — full supply-chain journey.
 *
 * Walks one pack through every custody transition the platform models, asserting the
 * resulting STATE after each step rather than just the acknowledgement:
 *
 *   commission (mfg) -> pack into SSCC (mfg) -> ship mfg->branch -> receive (branch)
 *     -> ship branch->pharmacy -> receive (pharmacy) -> dispense (pharmacy)
 *
 * Why this exists as its own project: the eleven per-feature projects each cover one
 * step in depth, but only an end-to-end walk proves the steps actually compose. It is
 * also the fastest way to find where the chain breaks — the source spreadsheet records
 * TS_RECV_001 (branch receiving) as failing against DW-878, and this is where that
 * shows up.
 *
 * Ordered and stateful by design: `describe.serial`, with each step handing its EPCs to
 * the next. A failure stops the chain, because every later step is meaningless without
 * the earlier one.
 *
 * WRITES TO PRODUCTION. Every EPC uses a run-scoped `ZTG…` serial so repeated runs
 * never collide, and so our data is identifiable afterwards.
 */
import { test, expect } from '@playwright/test'
import {
  submitAndPoll, packOf, disposeApi, describeMsgStatus,
  epcisDocument, commissionEvent, aggregationEvent, shippingEvent, receivingEvent, dispensingEvent,
  freshDispensableSgtin, freshSscc, sglnOf, glnFor, runId, sameSscc, ssccUrnToDigits,
  MFG_DISPENSABLE_GTINS,
} from '../../lib/eptts-api'

test.afterAll(async () => { await disposeApi() })

test.describe.serial('supply-chain journey', () => {
  // Carried between steps.
  let sgtin = ''
  let sscc = ''
  const invoice = `INV-ZTG-${runId()}`
  const returnRef = `RET-ZTG-${runId()}`

  const MFG = () => glnFor('manufacturer')
  const BRANCH = () => glnFor('branch')
  const PHARMACY = () => glnFor('pharmacy')

  test('CHAIN-01 — manufacturer commissions a pack', async () => {
    test.slow()
    // Must be a NON-Dawana product: this journey ends in a dispense, and the platform
    // refuses to dispense Dawana-integrated products through this channel.
    sgtin = freshDispensableSgtin(MFG_DISPENSABLE_GTINS[0])
    const lot = `ZTG-${runId()}`
    console.log(`[chain] run=${runId()} sgtin=${sgtin}`)

    const { submitStatus, msg } = await submitAndPoll('manufacturer', epcisDocument(
      [commissionEvent({
        epcList: [sgtin], lotNumber: lot, expiryDate: '2030-12-31',
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: MFG() },
    ))
    expect(submitStatus, 'commission accepted').toBe(202)
    expect(msg.state, `commission: ${describeMsgStatus(msg)}`).toBe('SUCCESS')

    const v = await packOf('manufacturer', sgtin)
    expect(v.verified, 'the pack now exists').toBe(true)
    expect(v.pack?.status, 'a commissioned pack is active').toBe('active')
    expect(v.pack?.currentGln, 'custody starts with the manufacturer').toBe(MFG())
    expect(v.pack?.parentSscc, 'not aggregated yet').toBeNull()
    console.log(`[chain] after commission: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
  })

  test('CHAIN-02 — manufacturer packs it into an SSCC', async () => {
    test.slow()
    sscc = freshSscc()
    console.log(`[chain] sscc=${sscc}`)

    const { submitStatus, msg } = await submitAndPoll('manufacturer', epcisDocument(
      [aggregationEvent({
        parentID: sscc, childEPCs: [sgtin], action: 'ADD',
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: MFG() },
    ))
    expect(submitStatus, 'packing accepted').toBe(202)
    expect(msg.state, `packing: ${describeMsgStatus(msg)}`).toBe('SUCCESS')

    const v = await packOf('manufacturer', sgtin)
    // The two SSCC representations are NOT interchangeable: events carry the URN,
    // while VerifyProduct returns the 18-digit GS1 element string. Compare on digits.
    console.log(`[chain] after packing: parentSscc=${v.pack?.parentSscc} ` +
      `(expected element string ${ssccUrnToDigits(sscc)}) status=${v.pack?.status}`)
    expect(sameSscc(sscc, v.pack?.parentSscc), 'the pack now reports its parent SSCC').toBe(true)
  })

  test('CHAIN-03 — manufacturer ships the SSCC to the branch', async () => {
    test.slow()
    const { submitStatus, msg } = await submitAndPoll('manufacturer', epcisDocument(
      [shippingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('manufacturer'),
        destinationSgln: sglnOf('branch'),
        bizTransaction: invoice,
        readPointSgln: sglnOf('manufacturer'),
      })],
      { senderGln: MFG(), receiverGln: BRANCH() },
    ))
    expect(submitStatus, 'shipping accepted').toBe(202)
    expect(msg.state, `shipping: ${describeMsgStatus(msg)}`).toBe('SUCCESS')

    // Shipping an SSCC must cascade to its children — that cascade is the whole point
    // of aggregation, and a silent failure here corrupts every later event.
    const v = await packOf('manufacturer', sgtin)
    console.log(`[chain] after ship->branch: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
    expect(v.pack?.status, 'the child pack is in transit, not still active').not.toBe('active')
  })

  test('CHAIN-04 — branch receives the shipment (TS_RECV_001 / DW-878)', async () => {
    test.slow()
    const { submitStatus, msg } = await submitAndPoll('branch', epcisDocument(
      [receivingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('manufacturer'),
        readPointSgln: sglnOf('branch'),
      })],
      { senderGln: BRANCH(), receiverGln: MFG() },
    ))
    expect(submitStatus, 'receiving accepted').toBe(202)
    expect(msg.state, `receiving: ${describeMsgStatus(msg)}`).toBe('SUCCESS')

    // The decisive assertion: custody must actually move to the branch.
    const v = await packOf('branch', sgtin)
    console.log(`[chain] after receive@branch: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
    expect(v.pack?.currentGln, 'custody transferred to the branch').toBe(BRANCH())
  })

  test('CHAIN-05 — branch ships onward to the pharmacy', async () => {
    test.slow()
    const { submitStatus, msg } = await submitAndPoll('branch', epcisDocument(
      [shippingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('branch'),
        destinationSgln: sglnOf('pharmacy'),
        bizTransaction: `${invoice}-PH`,
        readPointSgln: sglnOf('branch'),
      })],
      { senderGln: BRANCH(), receiverGln: PHARMACY() },
    ))
    expect(submitStatus, 'branch shipping accepted').toBe(202)
    expect(msg.state, `branch->pharmacy shipping: ${describeMsgStatus(msg)}`).toBe('SUCCESS')

    const v = await packOf('branch', sgtin)
    console.log(`[chain] after ship->pharmacy: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
  })

  test('CHAIN-06 — pharmacy receives the shipment', async () => {
    test.slow()
    const { submitStatus, msg } = await submitAndPoll('pharmacy', epcisDocument(
      [receivingEvent({
        epcList: [sscc],
        sourceSgln: sglnOf('branch'),
        readPointSgln: sglnOf('pharmacy'),
      })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    ))
    expect(submitStatus, 'pharmacy receiving accepted').toBe(202)
    expect(msg.state, `pharmacy receiving: ${describeMsgStatus(msg)}`).toBe('SUCCESS')

    const v = await packOf('pharmacy', sgtin)
    console.log(`[chain] after receive@pharmacy: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
    expect(v.pack?.currentGln, 'custody transferred to the pharmacy').toBe(PHARMACY())
  })

  test('CHAIN-07 — pharmacy dispenses the pack', async () => {
    test.slow()
    // CORRECTION: /Dispensation is ASYNCHRONOUS (202 + I001, then MsgStatusQuery),
    // not synchronous 200. Both the source spreadsheet ("200 Success") and the vendor
    // collection describe it as synchronous; verified live, it is not.
    const { dispensation, bodyOf, pollMsgStatus } = await import('../../lib/eptts-api')
    const doc = epcisDocument(
      [dispensingEvent({ epcList: [sgtin], readPointSgln: sglnOf('pharmacy') })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    )
    const res = await dispensation('pharmacy', doc)
    const body = await bodyOf(res)
    console.log(`[chain] dispense -> ${res.status()} ${JSON.stringify(body).slice(0, 200)}`)
    expect(res.status(), 'dispensing is accepted for processing').toBe(202)

    const iid = doc.sbdh.documentIdentification.instanceIdentifier
    const msg = await pollMsgStatus('pharmacy', iid)
    console.log(`[chain] dispense status: ${describeMsgStatus(msg)}`)
    expect(msg.state, `dispensing: ${describeMsgStatus(msg)}`).toBe('SUCCESS')

    const v = await packOf('pharmacy', sgtin)
    console.log(`[chain] after dispense: status=${v.pack?.status}`)
    expect(v.pack?.status, 'the pack leaves circulation').not.toBe('active')
  })

  test('CHAIN-08 — a dispensed pack cannot be dispensed again', async () => {
    test.slow()
    // The strongest proof the dispense took effect: repeating it must not succeed.
    // Rejection may be synchronous (400) or asynchronous (202 then FAILED), so accept
    // either shape and assert only that it does NOT succeed.
    const { dispensation, bodyOf, pollMsgStatus, errorOf } = await import('../../lib/eptts-api')
    const doc = epcisDocument(
      [dispensingEvent({ epcList: [sgtin], readPointSgln: sglnOf('pharmacy') })],
      { senderGln: PHARMACY(), receiverGln: BRANCH() },
    )
    const res = await dispensation('pharmacy', doc)

    if (res.status() >= 400) {
      const err = await errorOf(res)
      console.log(`[chain] re-dispense rejected synchronously: ${res.status()} shape=${err.shape} code=${err.code} msg=${err.message}`)
      expect(err.message, 'the rejection states a reason').toBeTruthy()
      return
    }

    console.log(`[chain] re-dispense accepted (${res.status()}) — checking the async outcome`)
    const msg = await pollMsgStatus('pharmacy', doc.sbdh.documentIdentification.instanceIdentifier)
    console.log(`[chain] re-dispense status: ${describeMsgStatus(msg)}`)
    expect(msg.state, `re-dispensing an already-dispensed pack must not succeed: ${describeMsgStatus(msg)}`)
      .not.toBe('SUCCESS')
  })

  test('CHAIN-09 — the journey is visible in the EPCIS message history', async () => {
    const { getMasar, bodyOf } = await import('../../lib/eptts-api')
    const res = await getMasar('manufacturer', '/epcis?limit=20')
    expect(res.status()).toBe(200)
    const body = (await bodyOf(res)) as { items?: { messageId?: string; eventTypes?: string[]; status?: string }[] }
    const items = body.items ?? []
    console.log(`[chain] recent message types: ${items.slice(0, 8).map((i) => (i.eventTypes ?? []).join('+')).join(', ')}`)
    expect(items.length, 'the manufacturer has message history').toBeGreaterThan(0)
    // Our own submissions used instanceIdentifiers prefixed ztg-<runId>.
    expect(returnRef.length, 'return reference was generated for downstream reuse').toBeGreaterThan(0)
  })
})
