/**
 * Shared state fixtures for the EPTTS API cases.
 *
 * Most cases need a pack in a specific lifecycle state — commissioned, packed,
 * in transit, received at a branch, sitting at a pharmacy. Building that state is
 * several chained async submissions, so it lives here once instead of in every case.
 *
 * TWO RULES THESE FOLLOW
 *
 * 1. **A fixture asserts its own steps.** If setup fails the error says so ("fixture:
 *    commission failed"), never leaving a case to fail with a misleading message about
 *    the behaviour it was actually testing.
 * 2. **Everything is freshly minted.** Serials and SSCCs are run-scoped (`ZTG…`), so no
 *    case depends on data another case left behind and repeated runs never collide.
 *
 * COST: each chained step is a submit plus a MsgStatusQuery poll, ~10-12 s. A fixture at
 * the pharmacy end of the chain therefore costs around a minute. That is inherent to an
 * asynchronous EPCIS API, not something the helper can optimise away — cases that need
 * deep state are marked `slow`.
 */
import { expect } from '@playwright/test'
import {
  submitAndPoll, describeMsgStatus,
  epcisDocument, commissionEvent, aggregationEvent, shippingEvent, receivingEvent,
  freshSgtin, freshDispensableSgtin, freshSscc, sglnOf, glnFor, runId,
  MFG_GTINS,
  type EpcisDocument, type Role,
  uniqueBizTransaction,
  assertEffectRecorded,
} from '../eptts-api'

const MFG = () => glnFor('manufacturer')
const BRANCH = () => glnFor('branch')
const PHARMACY = () => glnFor('pharmacy')

/** Submit a fixture step and fail loudly, naming the step, if it does not succeed. */
async function step(role: Role, doc: EpcisDocument, what: string): Promise<void> {
  const { submitStatus, msg } = await submitAndPoll(role, doc)
  expect(submitStatus, `fixture: ${what} was not accepted (HTTP ${submitStatus})`).toBe(202)
  expect(msg.state, `fixture: ${what} did not succeed — ${describeMsgStatus(msg)}`).toBe('SUCCESS')
  // A green verdict is not proof the stock exists. Every case downstream of this fixture
  // assumes the step really happened, so the claim is checked against the EPCIS history
  // before anything is built on top of it.
  await assertEffectRecorded(role, doc, `fixture: ${what}`)
}

// ─── commissioning ───────────────────────────────────────────────────────────

export interface Commissioned {
  sgtins: string[]
  lot: string
  expiry: string
}

/**
 * Commission `count` fresh SGTINs and return them.
 * `dispensable: true` picks a non-Dawana GTIN, needed by any chain ending in a dispense.
 */
export async function commissioned(
  count = 1,
  opts: { gtin?: string; dispensable?: boolean; expiry?: string } = {},
): Promise<Commissioned> {
  const expiry = opts.expiry ?? '2030-12-31'
  const lot = `ZTG-${runId()}`
  // An explicit gtin wins over `dispensable`. The partial-dispense product is BOTH specific
  // and dispensable, and the old precedence silently dropped the gtin whenever dispensable
  // was set — which would have quietly tested a full-pack product instead.
  const sgtins = Array.from({ length: count }, () => (
    opts.gtin
      ? freshSgtin(opts.gtin)
      : opts.dispensable ? freshDispensableSgtin() : freshSgtin(MFG_GTINS[0])
  ))

  await step('manufacturer', epcisDocument(
    [commissionEvent({ epcList: sgtins, lotNumber: lot, expiryDate: expiry, readPointSgln: sglnOf('manufacturer') })],
    { senderGln: MFG(), receiverGln: MFG() },
  ), `commission ${count} SGTIN(s)`)

  return { sgtins, lot, expiry }
}

/** Commission SGTINs of two different GTINs — for mixed-product packing cases. */
export async function commissionedMixed(): Promise<Commissioned> {
  const lot = `ZTG-${runId()}`
  const a = freshSgtin(MFG_GTINS[0])
  const b = freshSgtin(MFG_GTINS[1])
  await step('manufacturer', epcisDocument(
    [commissionEvent({ epcList: [a, b], lotNumber: lot, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
    { senderGln: MFG(), receiverGln: MFG() },
  ), 'commission two different GTINs')
  return { sgtins: [a, b], lot, expiry: '2030-12-31' }
}

// ─── aggregation ─────────────────────────────────────────────────────────────

export interface Packed extends Commissioned {
  sscc: string
}

/** Commission then pack into a fresh SSCC. */
export async function packed(
  count = 1,
  opts: { gtin?: string; dispensable?: boolean } = {},
): Promise<Packed> {
  const c = await commissioned(count, opts)
  const sscc = freshSscc()
  await step('manufacturer', epcisDocument(
    [aggregationEvent({ parentID: sscc, childEPCs: c.sgtins, action: 'ADD', readPointSgln: sglnOf('manufacturer') })],
    { senderGln: MFG(), receiverGln: MFG() },
  ), `pack ${count} SGTIN(s) into ${sscc}`)
  return { ...c, sscc }
}

// ─── custody transfer ────────────────────────────────────────────────────────

export interface InTransit extends Packed {
  invoice: string
}

/** Commission, pack, and ship to the branch — leaves the SSCC `in_transit`. */
export async function inTransitToBranch(
  count = 1,
  opts: { gtin?: string; dispensable?: boolean } = {},
): Promise<InTransit> {
  const p = await packed(count, opts)
  // Unique PER SHIPMENT — the platform refuses a reused invoice number, and runId() is
  // constant for the whole worker.
  const invoice = uniqueBizTransaction()
  await step('manufacturer', epcisDocument(
    [shippingEvent({
      epcList: [p.sscc], sourceSgln: sglnOf('manufacturer'), destinationSgln: sglnOf('branch'),
      bizTransaction: invoice, readPointSgln: sglnOf('manufacturer'),
    })],
    { senderGln: MFG(), receiverGln: BRANCH() },
  ), `ship ${p.sscc} to the branch`)
  return { ...p, invoice }
}

/** …and receive it at the branch — custody becomes the branch, status back to `active`. */
export async function receivedAtBranch(
  count = 1,
  opts: { gtin?: string; dispensable?: boolean } = {},
): Promise<InTransit> {
  const t = await inTransitToBranch(count, opts)
  await step('branch', epcisDocument(
    [receivingEvent({ epcList: [t.sscc], sourceSgln: sglnOf('manufacturer'), readPointSgln: sglnOf('branch') })],
    { senderGln: BRANCH(), receiverGln: MFG() },
  ), `receive ${t.sscc} at the branch`)
  return t
}

/**
 * Full chain to the pharmacy. Always uses a dispensable (non-Dawana) GTIN, because the
 * only reason to need stock at a pharmacy is to dispense it — and the platform refuses to
 * dispense Dawana-integrated products through this API.
 */
export async function atPharmacy(
  count = 1,
  opts: { gtin?: string; dispensable?: boolean } = {},
): Promise<InTransit> {
  // Defaults to dispensable, but a caller can force a Dawana-integrated product when the
  // point of the test IS the Dawana refusal — that rule can only be observed on a pack the
  // pharmacy actually holds, because the event-sequence check fires first.
  const r = await receivedAtBranch(count, { dispensable: opts.dispensable ?? true })
  await step('branch', epcisDocument(
    [shippingEvent({
      epcList: [r.sscc], sourceSgln: sglnOf('branch'), destinationSgln: sglnOf('pharmacy'),
      bizTransaction: uniqueBizTransaction(), readPointSgln: sglnOf('branch'),
    })],
    { senderGln: BRANCH(), receiverGln: PHARMACY() },
  ), `ship ${r.sscc} to the pharmacy`)

  await step('pharmacy', epcisDocument(
    [receivingEvent({ epcList: [r.sscc], sourceSgln: sglnOf('branch'), readPointSgln: sglnOf('pharmacy') })],
    { senderGln: PHARMACY(), receiverGln: BRANCH() },
  ), `receive ${r.sscc} at the pharmacy`)
  return r
}

// ─── convenience re-exports so case files import from one place ──────────────

export { MFG, BRANCH, PHARMACY, step }
