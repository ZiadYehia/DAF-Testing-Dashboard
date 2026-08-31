/**
 * EPTTS_API_06 — Shipping (44 cases) and EPTTS_API_07 — Receiving (42 cases).
 *
 * Shipping: `ObjectEvent`, `action: OBSERVE`, `bizStep: shipping`,
 *           `disposition: in_transit`, plus `sourceList`, `destinationList` and a
 *           `bizTransactionList` invoice reference.
 * Receiving: same event with `bizStep: receiving`, `disposition: in_progress`, and
 *            `sourceList` naming the shipper.
 *
 * THE ASSERTION THAT MATTERS
 *
 * `pack.currentGln` does NOT change at shipping — it stays with the sender and only moves
 * when the receiver posts its receiving event. Status goes `active` → `in_transit` →
 * `active` again. So:
 *   - a shipping case asserts `status: in_transit` and that custody has NOT moved
 *   - a receiving case asserts `status: active` AND `currentGln` is now the receiver
 * A case that asserts custody moved at shipping fails, correctly.
 *
 * TC_SHIP_025..044 were empty reserved ID slots in the source spreadsheet; they were
 * authored during extraction (see scripts/eptts-web-api-overrides.json) and are
 * implemented here.
 */
import { expect } from '@playwright/test'
import {
  submitAndPoll, sendEpcis, packOf, describeMsgStatus, bodyOf,
  epcisDocument, shippingEvent, receivingEvent,
  freshSgtin, freshSscc, sglnOf, glnFor, uniqueInstanceId,
  type EpcisDocument, type Role,
  uniqueBizTransaction,
} from '../eptts-api'
import type { ApiCase } from './index'
import { commissioned, packed, inTransitToBranch, receivedAtBranch, atPharmacy } from './fixtures'
import { fieldCases, expectAccepted, expectRejected, type MutationName } from './field-mutations'

const SHIP = 'api-shipping'
const RECV = 'api-receiving'
const MFG = () => glnFor('manufacturer')
const BRANCH = () => glnFor('branch')
const PHARMACY = () => glnFor('pharmacy')

function shipDoc(
  epcList: string[],
  from: Role,
  to: Role,
  opts: { invoice?: string; disposition?: 'in_transit' | 'returned' } = {},
): EpcisDocument {
  return epcisDocument(
    [shippingEvent({
      epcList,
      sourceSgln: sglnOf(from),
      destinationSgln: sglnOf(to),
      bizTransaction: opts.invoice ?? uniqueBizTransaction(),
      disposition: opts.disposition,
      readPointSgln: sglnOf(from),
    })],
    { senderGln: glnFor(from), receiverGln: glnFor(to) },
  )
}

function recvDoc(epcList: string[], at: Role, from: Role): EpcisDocument {
  return epcisDocument(
    [receivingEvent({ epcList, sourceSgln: sglnOf(from), readPointSgln: sglnOf(at) })],
    { senderGln: glnFor(at), receiverGln: glnFor(from) },
  )
}

// ─── shipping ────────────────────────────────────────────────────────────────

const shippingBusiness: ApiCase[] = [
  {
    id: 'TC_SHIP_001', feature: SHIP, slow: true,
    title: 'ship from manufacturer to branch',
    run: async () => {
      const p = await packed(1)
      await expectAccepted('manufacturer', shipDoc([p.sscc], 'manufacturer', 'branch'), 'ship to the branch')
      const v = await packOf('manufacturer', p.sgtins[0])
      expect(v.pack?.status, 'the child pack goes in transit').toBe('in_transit')
      // Custody moves on RECEIPT, not despatch — asserting otherwise would be wrong.
      expect(v.pack?.currentGln, 'custody is still the sender until the branch receives').toBe(MFG())
    },
  },
  {
    id: 'TC_SHIP_002', feature: SHIP, slow: true,
    title: 'ship from branch to branch',
    // devsim has one distributor tenant, so a second branch identity does not exist.
    skip: 'needs a second branch/distributor tenant; devsim has only distributor@devsim.local',
    run: async () => { /* unreachable while skipped */ },
  },
  {
    id: 'TC_SHIP_003', feature: SHIP, slow: true,
    title: 'ship from branch to pharmacy',
    run: async () => {
      const r = await receivedAtBranch(1)
      await expectAccepted('branch', shipDoc([r.sscc], 'branch', 'pharmacy'), 'branch ships onward')
      const v = await packOf('branch', r.sgtins[0])
      expect(v.pack?.status, 'in transit to the pharmacy').toBe('in_transit')
      expect(v.pack?.currentGln, 'custody still the branch until the pharmacy receives').toBe(BRANCH())
    },
  },
  {
    id: 'TC_SHIP_004', feature: SHIP, slow: true,
    title: 'ship a mix of SSCCs and loose SGTINs',
    run: async () => {
      const p = await packed(1)                 // an SSCC
      const loose = await commissioned(1)       // a bare SGTIN
      await expectAccepted('manufacturer',
        shipDoc([p.sscc, loose.sgtins[0]], 'manufacturer', 'branch'), 'ship SSCC + SGTIN')
      for (const s of [p.sgtins[0], loose.sgtins[0]]) {
        const v = await packOf('manufacturer', s)
        expect(v.pack?.status, `${s} in transit`).toBe('in_transit')
      }
    },
  },
  {
    id: 'TC_SHIP_005', feature: SHIP, slow: true,
    title: 'shipping a disaggregated (emptied) SSCC is refused',
    run: async () => {
      const p = await packed(1)
      // Unpack it, leaving an SSCC with no children.
      const { aggregationEvent } = await import('../eptts-api')
      await expectAccepted('manufacturer', epcisDocument(
        [aggregationEvent({ parentID: p.sscc, childEPCs: p.sgtins, action: 'DELETE', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      ), 'unpack the SSCC')
      await expectRejected('manufacturer', shipDoc([p.sscc], 'manufacturer', 'branch'), 'ship an emptied SSCC')
    },
  },
  {
    id: 'TC_SHIP_006', feature: SHIP, slow: true,
    title: 'shipping manufacturer directly to pharmacy is refused',
    run: async () => {
      // The supply chain is manufacturer → branch → pharmacy; skipping the branch breaks
      // the custody trail the whole system exists to record.
      const p = await packed(1)
      await expectRejected('manufacturer', shipDoc([p.sscc], 'manufacturer', 'pharmacy'), 'manufacturer → pharmacy')
    },
  },
  {
    id: 'TC_SHIP_011', feature: SHIP, slow: true,
    title: 'shipping with the same source and destination is refused',
    run: async () => {
      const p = await packed(1)
      await expectRejected('manufacturer', shipDoc([p.sscc], 'manufacturer', 'manufacturer'), 'source == destination')
    },
  },
  {
    id: 'TC_SHIP_012', feature: SHIP, slow: true,
    title: 'shipping with a source GLN that is not the authenticated entity is refused',
    run: async () => {
      const p = await packed(1)
      const doc = shipDoc([p.sscc], 'manufacturer', 'branch')
      doc.sbdh.sender.identifier = BRANCH()   // authenticated as manufacturer, claiming branch
      await expectRejected('manufacturer', doc, 'sender GLN does not match the key')
    },
  },
  {
    id: 'TC_SHIP_013', feature: SHIP, slow: true,
    title: 'shipping a non-existent SSCC is refused',
    run: async () => {
      await expectRejected('manufacturer', shipDoc([freshSscc()], 'manufacturer', 'branch'), 'unknown SSCC')
    },
  },
  {
    id: 'TC_SHIP_014', feature: SHIP, slow: true,
    title: 'shipping an SSCC not owned by the sender is refused',
    run: async () => {
      const p = await packed(1)
      // The branch does not own this SSCC; it is still with the manufacturer.
      await expectRejected('branch', shipDoc([p.sscc], 'branch', 'pharmacy'), 'branch shipping a manufacturer SSCC')
    },
  },
  {
    id: 'TC_SHIP_015', feature: SHIP, slow: true,
    title: 'shipping an SSCC that is already in transit is refused',
    run: async () => {
      const t = await inTransitToBranch(1)
      await expectRejected('manufacturer', shipDoc([t.sscc], 'manufacturer', 'branch'), 'double shipment')
    },
  },
  {
    id: 'TC_SHIP_016', feature: SHIP, slow: true,
    title: 'shipping an open (never-packed) SSCC is refused',
    run: async () => {
      // An SSCC identifier that was never the parent of an aggregation event.
      await expectRejected('manufacturer', shipDoc([freshSscc()], 'manufacturer', 'branch'), 'SSCC with no aggregation')
    },
  },
  {
    id: 'TC_SHIP_017', feature: SHIP, slow: true,
    title: 'shipping an expired SGTIN is refused',
    skip: 'commissioning with a past expiry is itself refused, so expired stock cannot be created through the API',
    run: async () => { /* unreachable while skipped */ },
  },
  {
    id: 'TC_SHIP_018', feature: SHIP, slow: true,
    title: 'shipping a non-existent SGTIN is refused',
    run: async () => {
      await expectRejected('manufacturer', shipDoc([freshSgtin()], 'manufacturer', 'branch'), 'never-commissioned SGTIN')
    },
  },
  {
    id: 'TC_SHIP_019', feature: SHIP, slow: true,
    title: 'shipping an SGTIN already in another shipment is refused',
    run: async () => {
      const t = await inTransitToBranch(1)
      await expectRejected('manufacturer',
        shipDoc([t.sgtins[0]], 'manufacturer', 'branch'), 'child already in an open shipment')
    },
  },
  {
    id: 'TC_SHIP_036', feature: SHIP, slow: true,
    title: 'shipping to an unregistered destination GLN is refused',
    run: async () => {
      const p = await packed(1)
      const doc = shipDoc([p.sscc], 'manufacturer', 'branch')
      doc.sbdh.receiver.identifier = '1111111111116'
      await expectRejected('manufacturer', doc, 'unregistered destination')
    },
  },
  {
    id: 'TC_SHIP_041', feature: SHIP, slow: true,
    title: 'a pharmacy cannot post a manufacturer-to-branch shipping event',
    run: async () => {
      const p = await packed(1)
      const doc = shipDoc([p.sscc], 'manufacturer', 'branch')
      await expectRejected('pharmacy', doc, 'pharmacy acting as the manufacturer')
    },
  },
  {
    id: 'TC_SHIP_042', feature: SHIP, slow: true,
    title: 're-using an instanceIdentifier does not create a second shipment',
    run: async () => {
      const p1 = await packed(1)
      const iid = uniqueInstanceId()
      const first = shipDoc([p1.sscc], 'manufacturer', 'branch')
      first.sbdh.documentIdentification.instanceIdentifier = iid
      await expectAccepted('manufacturer', first, 'first submission')

      const p2 = await packed(1)
      const replay = shipDoc([p2.sscc], 'manufacturer', 'branch')
      replay.sbdh.documentIdentification.instanceIdentifier = iid   // same identifier
      const { submitStatus, msg } = await submitAndPoll('manufacturer', replay)
      console.log(`[ship] replayed instanceIdentifier -> ${submitStatus} ${describeMsgStatus(msg)}`)

      // Either the duplicate is refused, or it is treated as idempotent — but the SECOND
      // SSCC must not have shipped on the back of a re-used identifier.
      const v = await packOf('manufacturer', p2.sgtins[0])
      expect(v.pack?.status, 'the second SSCC did not ship under a re-used identifier')
        .not.toBe('in_transit')
    },
  },
  {
    id: 'TC_SHIP_043', feature: SHIP, slow: true,
    title: 'a Content-Type that does not match the body is refused',
    run: async () => {
      const p = await packed(1)
      // JSON body declared as XML.
      const res = await sendEpcis('manufacturer', shipDoc([p.sscc], 'manufacturer', 'branch'), {
        contentType: 'application/xml',
      })
      const body = await bodyOf(res)
      console.log(`[ship] content-type mismatch -> ${res.status()} ${JSON.stringify(body).slice(0, 200)}`)
      expect(res.status(), 'mismatched Content-Type is refused (400 or 415)').toBeGreaterThanOrEqual(400)
    },
  },
  {
    id: 'TC_SHIP_044', feature: SHIP, slow: true,
    title: 'injection payloads in the invoice number are handled safely',
    run: async () => {
      const p = await packed(1)
      const doc = shipDoc([p.sscc], 'manufacturer', 'branch', { invoice: "' OR 1=1 --" })
      const { submitStatus, submitBody, msg } = await submitAndPoll('manufacturer', doc)
      const all = JSON.stringify(submitBody) + JSON.stringify(msg.body)
      console.log(`[ship] SQL injection invoice -> ${submitStatus} ${describeMsgStatus(msg)}`)
      // Either refused by validation or stored inert; what must not happen is a database
      // error surfacing.
      expect(all, 'no SQL internals leak')
        .not.toMatch(/syntax error|sqlstate|constraint|relation .* does not exist/i)
    },
  },
]

async function shipBase(): Promise<EpcisDocument> {
  const p = await packed(1)
  return shipDoc([p.sscc], 'manufacturer', 'branch')
}

const SHIP_FIELDS: Partial<Record<string, MutationName>> = {
  TC_SHIP_007: 'emptySourceList',
  TC_SHIP_008: 'malformedSource',
  TC_SHIP_009: 'emptyDestinationList',
  TC_SHIP_010: 'malformedDestination',
  TC_SHIP_020: 'emptyEpcList',
  TC_SHIP_021: 'emptyBizTransactionList',
  TC_SHIP_022: 'emptyInvoice',
  TC_SHIP_023: 'emptySourceType',
  TC_SHIP_024: 'emptyDestinationType',
  TC_SHIP_025: 'emptyEventTime',
  TC_SHIP_026: 'emptyOffset',
  TC_SHIP_027: 'invalidAction',
  TC_SHIP_028: 'emptyBizStep',
  TC_SHIP_029: 'invalidDisposition',
  TC_SHIP_030: 'emptyReadPoint',
  TC_SHIP_031: 'emptyBizLocation',
  TC_SHIP_032: 'emptySender',
  TC_SHIP_033: 'emptyReceiver',
  TC_SHIP_034: 'emptyInstanceId',
  TC_SHIP_035: 'badCheckDigitSender',
  TC_SHIP_037: 'malformedEpc',
  TC_SHIP_038: 'malformedSscc',
  TC_SHIP_039: 'invalidEventTime',
  TC_SHIP_040: 'malformedSource',
}

export const SHIPPING_CASES: ApiCase[] = [
  ...shippingBusiness,
  ...fieldCases({ feature: SHIP, role: 'manufacturer', verb: 'shipping', baseDoc: shipBase, map: SHIP_FIELDS }),
]

// ─── receiving ───────────────────────────────────────────────────────────────

const receivingBusiness: ApiCase[] = [
  {
    id: 'TS_RECV_001', feature: RECV, slow: true,
    title: 'a branch receives a complete shipment from the manufacturer',
    run: async () => {
      // Recorded as FAILING against DW-878 in the source spreadsheet. Walked end to end on
      // 2026-08-31 it succeeds — this case is the standing check on that.
      const t = await inTransitToBranch(1)
      await expectAccepted('branch', recvDoc([t.sscc], 'branch', 'manufacturer'), 'receive at the branch')
      const v = await packOf('branch', t.sgtins[0])
      expect(v.pack?.status, 'back to active once received').toBe('active')
      expect(v.pack?.currentGln, 'custody transfers to the branch').toBe(BRANCH())
    },
  },
  {
    id: 'TS_RECV_003', feature: RECV, slow: true,
    title: 'a branch receives multiple SGTINs in one request',
    run: async () => {
      const t = await inTransitToBranch(3)
      await expectAccepted('branch', recvDoc([t.sscc], 'branch', 'manufacturer'), 'receive three children')
      for (const s of t.sgtins) {
        const v = await packOf('branch', s)
        expect(v.pack?.currentGln, `${s} custody is the branch`).toBe(BRANCH())
      }
    },
  },
  {
    id: 'TS_RECV_010', feature: RECV, slow: true,
    title: 'receiving by a party other than the shipment destination is refused',
    run: async () => {
      const t = await inTransitToBranch(1)
      // Addressed to the branch; the pharmacy must not be able to claim it.
      await expectRejected('pharmacy', recvDoc([t.sscc], 'pharmacy', 'manufacturer'), 'wrong destination receiving')
    },
  },
  {
    id: 'TS_RECV_011', feature: RECV, slow: true,
    title: 'receiving a non-existent SSCC is refused',
    run: async () => {
      await expectRejected('branch', recvDoc([freshSscc()], 'branch', 'manufacturer'), 'unknown SSCC')
    },
  },
  {
    id: 'TS_RECV_012', feature: RECV, slow: true,
    title: 'receiving a non-existent SGTIN is refused',
    run: async () => {
      await expectRejected('branch', recvDoc([freshSgtin()], 'branch', 'manufacturer'), 'unknown SGTIN')
    },
  },
  {
    id: 'TS_RECV_015', feature: RECV, slow: true,
    title: 'receiving with duplicate EPCs is refused',
    run: async () => {
      const t = await inTransitToBranch(1)
      await expectRejected('branch', recvDoc([t.sscc, t.sscc], 'branch', 'manufacturer'), 'duplicate EPCs')
    },
  },
  {
    id: 'TS_RECV_019', feature: RECV, slow: true,
    title: 'receiving an SSCC that was never shipped is refused',
    run: async () => {
      const p = await packed(1)   // packed but not shipped
      await expectRejected('branch', recvDoc([p.sscc], 'branch', 'manufacturer'), 'never-shipped SSCC')
    },
  },
  {
    id: 'TS_RECV_021', feature: RECV, slow: true,
    title: 'receiving an already-received SSCC is refused',
    run: async () => {
      const r = await receivedAtBranch(1)
      await expectRejected('branch', recvDoc([r.sscc], 'branch', 'manufacturer'), 'second receive')
    },
  },
  {
    id: 'TS_RECV_036', feature: RECV, slow: true,
    title: 'a duplicate receiving request is refused',
    run: async () => {
      const t = await inTransitToBranch(1)
      await expectAccepted('branch', recvDoc([t.sscc], 'branch', 'manufacturer'), 'first receive')
      await expectRejected('branch', recvDoc([t.sscc], 'branch', 'manufacturer'), 'identical second receive')
    },
  },
  {
    id: 'TS_RECV_040', feature: RECV, slow: true,
    title: 'a branch receives a shipment from a manufacturer',
    run: async () => {
      const t = await inTransitToBranch(1)
      await expectAccepted('branch', recvDoc([t.sscc], 'branch', 'manufacturer'), 'branch ← manufacturer')
      const v = await packOf('branch', t.sgtins[0])
      expect(v.pack?.currentGln, 'custody is the branch').toBe(BRANCH())
    },
  },
  {
    id: 'TS_RECV_041', feature: RECV, slow: true,
    title: 'a branch receives a shipment from another branch',
    skip: 'needs a second branch/distributor tenant; devsim has only distributor@devsim.local',
    run: async () => { /* unreachable while skipped */ },
  },
  {
    id: 'TS_RECV_042', feature: RECV, slow: true,
    title: 'a pharmacy receives a shipment from a branch',
    run: async () => {
      const a = await atPharmacy(1)     // the fixture performs exactly this receive
      const v = await packOf('pharmacy', a.sgtins[0])
      expect(v.pack?.status, 'active at the pharmacy').toBe('active')
      expect(v.pack?.currentGln, 'custody is the pharmacy').toBe(PHARMACY())
    },
  },
]

/** Cases needing a partial-receive concept the contract has not yet been shown to support. */
const receivingUnclear: ApiCase[] = [
  { id: 'TS_RECV_002', title: 'receive multiple SSCCs in one request' },
  { id: 'TS_RECV_004', title: 'receive a mix of SSCCs and SGTINs in one request' },
  { id: 'TS_RECV_005', title: 'partially receive a shipment' },
  { id: 'TS_RECV_006', title: 'receive the remaining items after a partial receive' },
  { id: 'TS_RECV_016', title: 'a request mixing valid and invalid EPCs is refused as a whole' },
  { id: 'TS_RECV_017', title: 'all EPCs valid except one invalid SSCC' },
  { id: 'TS_RECV_018', title: 'all EPCs valid except one invalid SGTIN' },
  { id: 'TS_RECV_020', title: 'receiving an SGTIN that was never shipped is refused' },
  { id: 'TS_RECV_022', title: 'receiving an already-received SGTIN is refused' },
  { id: 'TS_RECV_023', title: 'receiving an SSCC belonging to another shipment is refused' },
  { id: 'TS_RECV_024', title: 'receiving an SGTIN belonging to another shipment is refused' },
].map(({ id, title }) => ({
  id, feature: RECV, slow: true, title,
  // These need either two concurrent shipments to the same branch, or a defined
  // partial-receive semantic. Neither has been established against the platform yet, and
  // guessing would produce a test that passes without verifying the intended rule.
  skip: 'needs multi-shipment or partial-receive semantics confirmed with the PO first — see the feature knowledge',
  run: async () => { /* unreachable while skipped */ },
}))

async function recvBase(): Promise<EpcisDocument> {
  const t = await inTransitToBranch(1)
  return recvDoc([t.sscc], 'branch', 'manufacturer')
}

const RECV_FIELDS: Partial<Record<string, MutationName>> = {
  TS_RECV_007: 'emptySourceList',
  TS_RECV_008: 'malformedSource',
  TS_RECV_009: 'malformedSource',
  TS_RECV_013: 'malformedSscc',
  TS_RECV_014: 'malformedEpc',
  TS_RECV_025: 'invalidType',
  TS_RECV_026: 'invalidAction',
  TS_RECV_027: 'invalidBizStep',
  TS_RECV_028: 'invalidDisposition',
  TS_RECV_029: 'invalidEventTime',
  TS_RECV_030: 'invalidOffset',
  TS_RECV_031: 'emptyReadPoint',
  TS_RECV_032: 'emptyBizLocation',
  TS_RECV_033: 'malformedReadPoint',
  TS_RECV_034: 'malformedBizLocation',
  TS_RECV_035: 'mismatchedLocations',
  TS_RECV_037: 'badSchemaVersion',
  TS_RECV_038: 'invalidSender',
  TS_RECV_039: 'invalidReceiver',
}

export const RECEIVING_CASES: ApiCase[] = [
  ...receivingBusiness,
  ...receivingUnclear,
  ...fieldCases({ feature: RECV, role: 'branch', verb: 'receiving', baseDoc: recvBase, map: RECV_FIELDS }),
]
