/**
 * EPTTS_API_11 — Partial Dispensing (36 cases).
 *
 * Same endpoint and event as Dispensing, plus a `quantity` field. A pack sits in a
 * partially-dispensed state across several requests until exhausted.
 *
 * ── THIS FEATURE IS BLOCKED ON TEST DATA ──────────────────────────────────────
 *
 * Every one of the devsim manufacturer's 30 registered products has
 * `dispenseType: "full"`. None supports partial dispensing, so the platform has nothing
 * to partially dispense and no amount of test code can create the precondition. Filed as
 * a bug (see data/eptts-web/bugs/api-partial-dispensing/).
 *
 * How that is handled here, deliberately:
 *
 *   - The QUANTITY cases — the ones that are the whole point of the feature (valid
 *     quantity, sequential dispenses, over-dispense refused, zero/negative/empty) are
 *     marked `skip` with the blocking reason. Writing them against a full-pack product
 *     would produce green tests that prove nothing about partial dispensing.
 *   - The ENVELOPE/FIELD negatives do not depend on dispenseType at all — a malformed
 *     eventTime is refused whatever the product is — so those DO run and give the feature
 *     real, if partial, coverage today.
 *   - The role and state negatives also run, since they are about who may dispense and
 *     from what state, not about quantity.
 *
 * To unblock: register a product with a partial/unit `dispenseType` (Registry → Products),
 * ideally with `isDawanaIntegration: false`, then remove the `skip` markers below.
 */
import { expect } from '@playwright/test'
import {
  dispensation, pollMsgStatus, describeMsgStatus, errorOf, bodyOf,
  epcisDocument, dispensingEvent,
  freshDispensableSgtin, sglnOf, glnFor,
  type EpcisDocument, type Role,
} from '../eptts-api'
import type { ApiCase } from './index'
import { atPharmacy, commissioned, inTransitToBranch } from './fixtures'
import { fieldCases, type MutationName } from './field-mutations'

const FEATURE = 'api-partial-dispensing'
const BRANCH = () => glnFor('branch')

const BLOCKED =
  'blocked on test data: all 30 registered products have dispenseType "full", so the platform ' +
  'has nothing to partially dispense. Register a product with a partial/unit dispense type to unblock.'

function partialDoc(epcList: string[], quantity: number | undefined, role: Role = 'pharmacy'): EpcisDocument {
  return epcisDocument(
    [dispensingEvent({ epcList, quantity, readPointSgln: sglnOf(role) })],
    { senderGln: glnFor(role), receiverGln: BRANCH() },
  )
}

async function dispense(role: Role, doc: EpcisDocument) {
  const res = await dispensation(role, doc)
  const body = await bodyOf(res)
  if (res.status() >= 400) return { status: res.status(), body, msg: null }
  const msg = await pollMsgStatus(role, doc.sbdh.documentIdentification.instanceIdentifier)
  return { status: res.status(), body, msg }
}

async function expectRefused(role: Role, doc: EpcisDocument, what: string) {
  const r = await dispense(role, doc)
  if (r.status >= 400) {
    console.log(`[pdisp] ${what}: refused synchronously ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`)
    return
  }
  console.log(`[pdisp] ${what}: accepted (${r.status}) -> ${r.msg ? describeMsgStatus(r.msg) : ''}`)
  expect(r.msg?.timedOut, `${what}: MsgStatusQuery never resolved`).toBe(false)
  expect(r.msg?.state, `${what}: the platform ACCEPTED a partial dispense it should refuse`).toBe('FAILED')
}

/** The quantity cases — unexecutable until a partial-dispense product exists. */
const quantityBlocked: { id: string; title: string }[] = [
  { id: 'TC_PDISP_001', title: 'partially dispense a valid SGTIN' },
  { id: 'TC_PDISP_002', title: 'partially dispense a valid quantity from a pack' },
  { id: 'TC_PDISP_003', title: 'sequential partial dispenses until the pack is fully dispensed' },
  { id: 'TC_PDISP_004', title: 'the remaining quantity updates correctly after a partial dispense' },
  { id: 'TC_PDISP_011', title: 'partially dispensing an already fully-dispensed SGTIN is refused' },
  { id: 'TC_PDISP_017', title: 'partially dispensing with an empty quantity is refused' },
  { id: 'TC_PDISP_018', title: 'a quantity of zero is refused' },
  { id: 'TC_PDISP_019', title: 'a negative quantity is refused' },
  { id: 'TC_PDISP_020', title: 'a quantity greater than the pack contents is refused, not clamped' },
  { id: 'TC_PDISP_021', title: 'partially dispensing the exact remaining quantity closes the pack' },
  { id: 'TC_PDISP_022', title: 'partially dispensing after full dispense is refused' },
]

const blocked: ApiCase[] = quantityBlocked.map(({ id, title }) => ({
  id, feature: FEATURE, slow: true, title,
  skip: BLOCKED,
  run: async () => { /* unreachable while skipped */ },
}))

/** Cases that hold regardless of dispenseType — these genuinely run. */
const runnable: ApiCase[] = [
  {
    id: 'TC_PDISP_005', feature: FEATURE, slow: true,
    title: 'a manufacturer cannot partially dispense',
    run: async () => {
      const res = await dispensation('manufacturer', partialDoc([freshDispensableSgtin()], 5, 'manufacturer'))
      expect(res.status(), 'manufacturers are refused outright').toBe(403)
      const err = await errorOf(res)
      expect(err.message, 'the refusal names the permitted roles').toContain('available to')
    },
  },
  {
    id: 'TC_PDISP_006', feature: FEATURE, slow: true,
    title: 'a branch partially dispensing pharmacy-held stock does not succeed',
    run: async () => {
      const a = await atPharmacy(1)
      const r = await dispense('branch', partialDoc([a.sgtins[0]], 5, 'branch'))
      console.log(`[pdisp] branch partial dispense -> ${r.status}`)
      if (r.status >= 400) return
      expect(r.msg?.state, 'a branch must not partially dispense stock the pharmacy holds').not.toBe('SUCCESS')
    },
  },
  {
    id: 'TC_PDISP_008', feature: FEATURE, slow: true,
    title: 'partially dispensing a pack not in the pharmacy inventory is refused',
    run: async () => {
      const c = await commissioned(1, { dispensable: true })
      await expectRefused('pharmacy', partialDoc([c.sgtins[0]], 5), 'pack not in pharmacy stock')
    },
  },
  {
    id: 'TC_PDISP_009', feature: FEATURE, slow: true,
    title: 'partially dispensing a pack held by another party is refused',
    // devsim has a single pharmacy tenant, so the equivalent ownership violation is a pack
    // still held by the branch — the same "dispense only what you hold" rule.
    run: async () => {
      const t = await inTransitToBranch(1, { dispensable: true })
      await expectRefused('pharmacy', partialDoc([t.sgtins[0]], 5), 'pack held by another party')
    },
  },
  {
    id: 'TC_PDISP_010', feature: FEATURE, slow: true,
    title: 'partially dispensing an expired SGTIN is refused',
    skip: 'needs expired stock at the pharmacy; commissioning with a past expiry is itself refused, so the state cannot be built through the API',
    run: async () => { /* unreachable while skipped */ },
  },
  {
    id: 'TC_PDISP_012', feature: FEATURE, slow: true,
    title: 'partially dispensing an in-transit SGTIN is refused',
    run: async () => {
      const t = await inTransitToBranch(1, { dispensable: true })
      await expectRefused('pharmacy', partialDoc([t.sgtins[0]], 5), 'in-transit pack')
    },
  },
  {
    id: 'TC_PDISP_013', feature: FEATURE, slow: true,
    title: 'partially dispensing a destroyed SGTIN is refused',
    skip: 'depends on TC_DISP_012 establishing whether a pharmacy may destroy its own stock; unblock together',
    run: async () => { /* unreachable while skipped */ },
  },
]

// ─── shared field negatives — independent of dispenseType, so these run ──────

async function baseDoc(): Promise<EpcisDocument> {
  return partialDoc([freshDispensableSgtin()], 5)
}

const FIELD_MAP: Partial<Record<string, MutationName>> = {
  TC_PDISP_007: 'malformedEpc',          // non-existing SGTIN
  TC_PDISP_014: 'ssccInsteadOfSgtin',
  TC_PDISP_015: 'malformedEpc',
  TC_PDISP_016: 'emptyEpcList',
  TC_PDISP_023: 'invalidType',
  TC_PDISP_024: 'invalidAction',
  TC_PDISP_025: 'invalidBizStep',
  TC_PDISP_026: 'invalidDisposition',
  TC_PDISP_027: 'invalidEventTime',
  TC_PDISP_028: 'invalidOffset',
  TC_PDISP_029: 'emptyReadPoint',
  TC_PDISP_030: 'emptyBizLocation',
  TC_PDISP_031: 'malformedReadPoint',
  TC_PDISP_032: 'malformedBizLocation',
  TC_PDISP_033: 'mismatchedLocations',
  TC_PDISP_034: 'badSchemaVersion',
  TC_PDISP_035: 'invalidSender',
  TC_PDISP_036: 'invalidReceiver',
}

export const PARTIAL_DISPENSING_CASES: ApiCase[] = [
  ...blocked,
  ...runnable,
  ...fieldCases({
    feature: FEATURE, role: 'pharmacy', verb: 'partially dispensing', baseDoc, map: FIELD_MAP,
    reject: expectRefused,   // /Dispensation, not /scp/SendEPCIS
  }),
]
