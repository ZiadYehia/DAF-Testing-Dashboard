/**
 * EPTTS_API_08 — Return Shipping (42 cases) and EPTTS_API_09 — Return Receiving (40).
 *
 * Return shipping is structurally shipping with `disposition: returned` plus a return
 * reference in `bizTransactionList`. Return receiving is receiving with
 * `disposition: returned` and the matching reference.
 *
 * WHY THE PAIR MATTERS MORE THAN IT LOOKS
 *
 * Return receiving is the ONLY transition that moves packs out of a terminal-looking state
 * back into sellable inventory. A bug there silently resurrects stock that should not be
 * re-sold, which is why TS_RTRV_005 asserts what state the pack lands in — not merely that
 * the event succeeded.
 *
 * The business rule that distinguishes returns from ordinary shipping: a return must go
 * back to the partner that originally supplied the pack, not to an arbitrary GLN.
 */
import { expect } from '@playwright/test'
import {
  packOf, describeMsgStatus,
  epcisDocument, shippingEvent, receivingEvent,
  freshSgtin, freshSscc, sglnOf, glnFor,
  type EpcisDocument, type Role,
  uniqueBizTransaction,
} from '../eptts-api'
import type { ApiCase } from './index'
import { receivedAtBranch, packed, commissioned } from './fixtures'
import { fieldCases, expectAccepted, expectRejected, type MutationName } from './field-mutations'

const RTN = 'api-return'
const RTRV = 'api-return-receiving'
const MFG = () => glnFor('manufacturer')

function returnShipDoc(epcList: string[], from: Role, to: Role, ref?: string): EpcisDocument {
  return epcisDocument(
    [shippingEvent({
      epcList,
      sourceSgln: sglnOf(from),
      destinationSgln: sglnOf(to),
      bizTransaction: ref ?? uniqueBizTransaction('RET'),
      disposition: 'returned',
      readPointSgln: sglnOf(from),
    })],
    { senderGln: glnFor(from), receiverGln: glnFor(to) },
  )
}

function returnRecvDoc(epcList: string[], at: Role, from: Role, ref?: string): EpcisDocument {
  return epcisDocument(
    [receivingEvent({
      epcList,
      sourceSgln: sglnOf(from),
      bizTransaction: ref ?? uniqueBizTransaction('RET'),
      disposition: 'returned',
      readPointSgln: sglnOf(at),
    })],
    { senderGln: glnFor(at), receiverGln: glnFor(from) },
  )
}

/** Branch holds received stock, then returns it upstream. Returns the return reference. */
async function returnedToManufacturer(count = 1): Promise<{ sscc: string; sgtins: string[]; ref: string }> {
  const r = await receivedAtBranch(count)
  const ref = uniqueBizTransaction('RET')
  await expectAccepted('branch', returnShipDoc([r.sscc], 'branch', 'manufacturer', ref), 'fixture: return to the manufacturer')
  return { sscc: r.sscc, sgtins: r.sgtins, ref }
}

// ─── return shipping ─────────────────────────────────────────────────────────

const returnBusiness: ApiCase[] = [
  {
    id: 'TS_RTN_001', feature: RTN, slow: true,
    title: 'a branch returns a valid SSCC to the manufacturer',
    run: async () => {
      const r = await receivedAtBranch(1)
      await expectAccepted('branch', returnShipDoc([r.sscc], 'branch', 'manufacturer'), 'return the SSCC')
      const v = await packOf('branch', r.sgtins[0])
      console.log(`[rtn] after return: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
      // Whatever the platform calls it, the pack must no longer be plain sellable stock
      // sitting at the branch.
      expect(v.pack?.status, 'no longer ordinary branch stock').not.toBe('active')
    },
  },
  {
    id: 'TS_RTN_003', feature: RTN, slow: true,
    title: 'a branch returns a valid loose SGTIN to the manufacturer',
    run: async () => {
      const r = await receivedAtBranch(1)
      await expectAccepted('branch', returnShipDoc([r.sgtins[0]], 'branch', 'manufacturer'), 'return one SGTIN')
      const v = await packOf('branch', r.sgtins[0])
      expect(v.pack?.status, 'no longer ordinary branch stock').not.toBe('active')
    },
  },
  {
    id: 'TS_RTN_005', feature: RTN, slow: true,
    title: 'returning to another branch instead of the manufacturer is refused',
    skip: 'needs a second branch/distributor tenant; devsim has only distributor@devsim.local',
    run: async () => { /* unreachable while skipped */ },
  },
  {
    id: 'TS_RTN_006', feature: RTN, slow: true,
    title: 'returning to a pharmacy instead of the manufacturer is refused',
    run: async () => {
      // A return travels upstream. A pharmacy is downstream of a branch, so this is the
      // wrong direction and must be refused.
      const r = await receivedAtBranch(1)
      await expectRejected('branch', returnShipDoc([r.sscc], 'branch', 'pharmacy'), 'return downstream to a pharmacy')
    },
  },
  {
    id: 'TS_RTN_012', feature: RTN, slow: true,
    title: 'returning to a destination that is not the original manufacturer is refused',
    run: async () => {
      const r = await receivedAtBranch(1)
      const doc = returnShipDoc([r.sscc], 'branch', 'manufacturer')
      // Redirect the return to an unrelated registered GLN.
      doc.sbdh.receiver.identifier = glnFor('pharmacy')
      await expectRejected('branch', doc, 'return to a party that never supplied the pack')
    },
  },
  {
    id: 'TS_RTN_013', feature: RTN, slow: true,
    title: 'returning a non-existent SSCC is refused',
    run: async () => {
      await expectRejected('branch', returnShipDoc([freshSscc()], 'branch', 'manufacturer'), 'unknown SSCC')
    },
  },
  {
    id: 'TS_RTN_014', feature: RTN, slow: true,
    title: 'returning a non-existent SGTIN is refused',
    run: async () => {
      await expectRejected('branch', returnShipDoc([freshSgtin()], 'branch', 'manufacturer'), 'unknown SGTIN')
    },
  },
  {
    id: 'TS_RTN_015', feature: RTN, slow: true,
    title: 'returning an SSCC the branch does not hold is refused',
    run: async () => {
      const p = await packed(1)   // still with the manufacturer
      await expectRejected('branch', returnShipDoc([p.sscc], 'branch', 'manufacturer'), 'SSCC not held by the branch')
    },
  },
  {
    id: 'TS_RTN_016', feature: RTN, slow: true,
    title: 'returning an SGTIN the branch does not hold is refused',
    run: async () => {
      const c = await commissioned(1)
      await expectRejected('branch', returnShipDoc([c.sgtins[0]], 'branch', 'manufacturer'), 'SGTIN not held by the branch')
    },
  },
  {
    id: 'TS_RTN_017', feature: RTN, slow: true,
    title: 'returning an already-returned SSCC is refused',
    run: async () => {
      const r = await returnedToManufacturer(1)
      await expectRejected('branch', returnShipDoc([r.sscc], 'branch', 'manufacturer'), 'second return')
    },
  },
  {
    id: 'TS_RTN_021', feature: RTN, slow: true,
    title: 'returning with duplicate EPCs is refused',
    run: async () => {
      const r = await receivedAtBranch(1)
      await expectRejected('branch', returnShipDoc([r.sscc, r.sscc], 'branch', 'manufacturer'), 'duplicate EPCs')
    },
  },
  {
    id: 'TS_RTN_027', feature: RTN, slow: true,
    title: 'returning with a duplicate return reference is refused',
    run: async () => {
      const first = await returnedToManufacturer(1)
      const second = await receivedAtBranch(1)
      // Re-using a live return reference for different stock would make the reference
      // ambiguous, and the reference is how return receiving matches the shipment.
      await expectRejected('branch',
        returnShipDoc([second.sscc], 'branch', 'manufacturer', first.ref), 'reused return reference')
    },
  },
  {
    id: 'TS_RTN_039', feature: RTN, slow: true,
    title: 'a duplicate return shipping request is refused',
    run: async () => {
      const r = await receivedAtBranch(1)
      const ref = uniqueBizTransaction('RET')
      await expectAccepted('branch', returnShipDoc([r.sscc], 'branch', 'manufacturer', ref), 'first return')
      await expectRejected('branch', returnShipDoc([r.sscc], 'branch', 'manufacturer', ref), 'identical second return')
    },
  },
]

const returnUnclear: ApiCase[] = [
  { id: 'TS_RTN_002', title: 'returning multiple SSCCs in one request' },
  { id: 'TS_RTN_004', title: 'returning a mix of SSCCs and SGTINs in one request' },
  { id: 'TS_RTN_018', title: 'returning an already-returned SGTIN is refused' },
  { id: 'TS_RTN_022', title: 'a request mixing valid and invalid EPCs is refused as a whole' },
  { id: 'TS_RTN_023', title: 'all EPCs valid except one invalid SSCC' },
  { id: 'TS_RTN_024', title: 'all EPCs valid except one invalid SGTIN' },
].map(({ id, title }) => ({
  id, feature: RTN, slow: true, title,
  skip: 'needs two concurrent branch-held shipments, or a defined all-or-nothing semantic for mixed EPC lists — confirm with the PO first',
  run: async () => { /* unreachable while skipped */ },
}))

async function rtnBase(): Promise<EpcisDocument> {
  const r = await receivedAtBranch(1)
  return returnShipDoc([r.sscc], 'branch', 'manufacturer')
}

const RTN_FIELDS: Partial<Record<string, MutationName>> = {
  TS_RTN_007: 'emptySourceList',
  TS_RTN_008: 'malformedSource',
  TS_RTN_009: 'emptyDestinationList',
  TS_RTN_010: 'malformedDestination',
  TS_RTN_011: 'badCheckDigitSender',
  TS_RTN_019: 'malformedSscc',
  TS_RTN_020: 'malformedEpc',
  TS_RTN_025: 'emptyBizTransactionList',
  TS_RTN_026: 'emptyInvoice',
  TS_RTN_028: 'invalidType',
  TS_RTN_029: 'invalidAction',
  TS_RTN_030: 'invalidBizStep',
  TS_RTN_031: 'invalidDisposition',
  TS_RTN_032: 'invalidEventTime',
  TS_RTN_033: 'invalidOffset',
  TS_RTN_034: 'emptyReadPoint',
  TS_RTN_035: 'emptyBizLocation',
  TS_RTN_036: 'malformedReadPoint',
  TS_RTN_037: 'malformedBizLocation',
  TS_RTN_038: 'mismatchedLocations',
  TS_RTN_040: 'badSchemaVersion',
  TS_RTN_041: 'invalidSender',
  TS_RTN_042: 'invalidReceiver',
}

export const RETURN_CASES: ApiCase[] = [
  ...returnBusiness,
  ...returnUnclear,
  ...fieldCases({
    validates: ['TS_RTN_031'], feature: RTN, role: 'branch', verb: 'return shipping', baseDoc: rtnBase, map: RTN_FIELDS }),
]

// ─── return receiving ────────────────────────────────────────────────────────

const rtrvBusiness: ApiCase[] = [
  {
    id: 'TS_RTRV_001', feature: RTRV, slow: true,
    title: 'the manufacturer receives a valid returned SSCC',
    run: async () => {
      const r = await returnedToManufacturer(1)
      await expectAccepted('manufacturer',
        returnRecvDoc([r.sscc], 'manufacturer', 'branch', r.ref), 'return receiving')
      const v = await packOf('manufacturer', r.sgtins[0])
      console.log(`[rtrv] after return receiving: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
      expect(v.pack?.currentGln, 'custody returns to the manufacturer').toBe(MFG())
    },
  },
  {
    id: 'TS_RTRV_003', feature: RTRV, slow: true,
    title: 'the manufacturer receives a valid returned SGTIN',
    run: async () => {
      const r = await receivedAtBranch(1)
      const ref = uniqueBizTransaction('RET')
      await expectAccepted('branch', returnShipDoc([r.sgtins[0]], 'branch', 'manufacturer', ref), 'branch returns one SGTIN')
      await expectAccepted('manufacturer',
        returnRecvDoc([r.sgtins[0]], 'manufacturer', 'branch', ref), 'manufacturer receives it')
      const v = await packOf('manufacturer', r.sgtins[0])
      expect(v.pack?.currentGln, 'custody returns to the manufacturer').toBe(MFG())
    },
  },
  {
    id: 'TS_RTRV_005', feature: RTRV, slow: true,
    title: 'returned products become available again at the manufacturer',
    run: async () => {
      // The consequential one: this is the only transition that puts stock back into
      // sellable inventory, so what state it lands in decides whether it can be re-sold.
      const r = await returnedToManufacturer(1)
      await expectAccepted('manufacturer',
        returnRecvDoc([r.sscc], 'manufacturer', 'branch', r.ref), 'return receiving')

      const v = await packOf('manufacturer', r.sgtins[0])
      console.log(`[rtrv] final state: status=${v.pack?.status} gln=${v.pack?.currentGln}`)
      expect(v.pack?.currentGln, 'held by the manufacturer').toBe(MFG())

      // And the business question that follows: may it be shipped again? Record the answer
      // rather than assume it.
      const { submitAndPoll } = await import('../eptts-api')
      const reship = returnShipDoc([r.sscc], 'manufacturer', 'branch')
      const { submitStatus, msg } = await submitAndPoll('manufacturer', reship)
      console.log(`[rtrv] re-ship after return: ${submitStatus} ${describeMsgStatus(msg)} ` +
        '— confirm with the PO whether returned stock is intended to be re-sellable')
    },
  },
  {
    id: 'TS_RTRV_011', feature: RTRV, slow: true,
    title: 'return receiving a non-existent SSCC is refused',
    run: async () => {
      await expectRejected('manufacturer', returnRecvDoc([freshSscc()], 'manufacturer', 'branch'), 'unknown SSCC')
    },
  },
  {
    id: 'TS_RTRV_012', feature: RTRV, slow: true,
    title: 'return receiving a non-existent SGTIN is refused',
    run: async () => {
      await expectRejected('manufacturer', returnRecvDoc([freshSgtin()], 'manufacturer', 'branch'), 'unknown SGTIN')
    },
  },
  {
    id: 'TS_RTRV_019', feature: RTRV, slow: true,
    title: 'return receiving an SSCC the branch never returned is refused',
    run: async () => {
      const r = await receivedAtBranch(1)   // held by the branch, never returned
      await expectRejected('manufacturer',
        returnRecvDoc([r.sscc], 'manufacturer', 'branch'), 'SSCC never returned')
    },
  },
  {
    id: 'TS_RTRV_021', feature: RTRV, slow: true,
    title: 'return receiving an already-received SSCC is refused',
    run: async () => {
      const r = await returnedToManufacturer(1)
      await expectAccepted('manufacturer', returnRecvDoc([r.sscc], 'manufacturer', 'branch', r.ref), 'first receive')
      await expectRejected('manufacturer', returnRecvDoc([r.sscc], 'manufacturer', 'branch', r.ref), 'second receive')
    },
  },
  {
    id: 'TS_RTRV_015', feature: RTRV, slow: true,
    title: 'return receiving with duplicate EPCs',
    run: async () => {
      // The sheet marks this POSITIVE, which is surprising — a duplicated EPC in one list is
      // normally refused (as it is on every other feature here). Assert the sheet's
      // expectation and let a disagreement surface rather than silently changing it.
      const r = await returnedToManufacturer(1)
      await expectAccepted('manufacturer',
        returnRecvDoc([r.sscc, r.sscc], 'manufacturer', 'branch', r.ref), 'duplicate EPCs accepted per the sheet')
    },
  },
  {
    id: 'TS_RTRV_037', feature: RTRV, slow: true,
    title: 'a duplicate return receiving request is refused',
    run: async () => {
      const r = await returnedToManufacturer(1)
      await expectAccepted('manufacturer', returnRecvDoc([r.sscc], 'manufacturer', 'branch', r.ref), 'first request')
      await expectRejected('manufacturer', returnRecvDoc([r.sscc], 'manufacturer', 'branch', r.ref), 'identical second request')
    },
  },
  {
    id: 'TS_RTRV_024', feature: RTRV, slow: true,
    title: 'return receiving with an empty return reference is refused',
    run: async () => {
      const r = await returnedToManufacturer(1)
      const doc = returnRecvDoc([r.sscc], 'manufacturer', 'branch', r.ref)
      const list = doc.epcisBody.eventList[0].bizTransactionList as { bizTransaction: string }[]
      list[0].bizTransaction = ''
      await expectRejected('manufacturer', doc, 'empty return reference')
    },
  },
  {
    id: 'TS_RTRV_025', feature: RTRV, slow: true,
    title: 'return receiving against a return reference from a different return is refused',
    run: async () => {
      const a = await returnedToManufacturer(1)
      const b = await returnedToManufacturer(1)
      // b's stock claimed under a's reference.
      await expectRejected('manufacturer',
        returnRecvDoc([b.sscc], 'manufacturer', 'branch', a.ref), 'mismatched return reference')
    },
  },
]

const rtrvUnclear: ApiCase[] = [
  { id: 'TS_RTRV_002', title: 'receiving multiple returned SSCCs in one request' },
  { id: 'TS_RTRV_004', title: 'receiving a mix of returned SSCCs and SGTINs in one request' },
  { id: 'TS_RTRV_009', title: 'return receiving by a manufacturer other than the original owner is refused' },
  { id: 'TS_RTRV_016', title: 'a request mixing valid and invalid EPCs is refused as a whole' },
  { id: 'TS_RTRV_017', title: 'all EPCs valid except one invalid SSCC' },
  { id: 'TS_RTRV_018', title: 'all EPCs valid except one invalid SGTIN' },
  { id: 'TS_RTRV_020', title: 'return receiving an SGTIN the branch never returned is refused' },
  { id: 'TS_RTRV_022', title: 'return receiving an already-received SGTIN is refused' },
].map(({ id, title }) => ({
  id, feature: RTRV, slow: true, title,
  skip: 'needs a second manufacturer tenant or a defined all-or-nothing semantic for mixed EPC lists — confirm with the PO first',
  run: async () => { /* unreachable while skipped */ },
}))

async function rtrvBase(): Promise<EpcisDocument> {
  const r = await returnedToManufacturer(1)
  return returnRecvDoc([r.sscc], 'manufacturer', 'branch', r.ref)
}

const RTRV_FIELDS: Partial<Record<string, MutationName>> = {
  TS_RTRV_006: 'emptySourceList',
  TS_RTRV_007: 'malformedSource',
  TS_RTRV_008: 'badCheckDigitSender',
  TS_RTRV_010: 'emptyEpcList',
  TS_RTRV_013: 'malformedSscc',
  TS_RTRV_014: 'malformedEpc',
  TS_RTRV_023: 'emptyBizTransactionList',
  TS_RTRV_026: 'invalidType',
  TS_RTRV_027: 'invalidAction',
  TS_RTRV_028: 'invalidBizStep',
  TS_RTRV_029: 'invalidDisposition',
  TS_RTRV_030: 'invalidEventTime',
  TS_RTRV_031: 'invalidOffset',
  TS_RTRV_032: 'emptyReadPoint',
  TS_RTRV_033: 'emptyBizLocation',
  TS_RTRV_034: 'malformedReadPoint',
  TS_RTRV_035: 'malformedBizLocation',
  TS_RTRV_036: 'mismatchedLocations',
  TS_RTRV_038: 'badSchemaVersion',
  TS_RTRV_039: 'invalidSender',
  TS_RTRV_040: 'invalidReceiver',
}

export const RETURN_RECEIVING_CASES: ApiCase[] = [
  ...rtrvBusiness,
  ...rtrvUnclear,
    // TS_RTRV_010 and TC_COMM_004: the shared emptyEpcList gap no longer holds everywhere.
    // Measured on devsim 2026-09-08 — return receiving and commissioning both refuse a
    // zero-EPC event now. Opted out per feature rather than deleted from KNOWN_GAPS,
    // because a deployment where the gap survives must still fail rather than be excused.
  ...fieldCases({ validates: ['TS_RTRV_010'], feature: RTRV, role: 'manufacturer', verb: 'return receiving', baseDoc: rtrvBase, map: RTRV_FIELDS }),
]
