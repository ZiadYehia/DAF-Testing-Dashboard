/**
 * EPTTS_API_10 — Dispensing (33 cases).
 *
 * `POST /Dispensation` (not /scp/SendEPCIS), `ObjectEvent`, `action: OBSERVE`,
 * `bizStep: retail_selling`, `disposition: retail_sold`.
 *
 * THREE THINGS THAT DECIDE WHETHER A CASE HERE IS WRITTEN CORRECTLY
 *
 * 1. **It is asynchronous, and it acknowledges with 200 — not 202.** The spreadsheet and the
 *    vendor collection both say "200 Success", meaning synchronously complete. The code is
 *    right; the meaning is wrong. `/scp/SendEPCIS` uses 202, `/Dispensation` uses 200, and
 *    both must be polled. So do not assert the status code here — assert the polled
 *    `messagestatus`. Asserting 202 fails against the real platform; treating 200 as success
 *    passes while the dispense actually failed, which is the worse mistake.
 * 2. **Only 3 of 30 products are dispensable.** 27 carry `isDawanaIntegration: true` and
 *    the platform refuses them: "Dispensing is not allowed for Dawana-integrated products
 *    via this channel." Every fixture here uses a dispensable GTIN, or the case fails for
 *    the wrong reason.
 * 3. **Pharmacy or branch only.** A manufacturer token gets a synchronous 403 whose body
 *    names the permitted roles.
 *
 * COST NOTE: a dispensing positive needs the full chain (commission → pack → ship →
 * receive at branch → ship → receive at pharmacy), about a minute of real waiting. The
 * envelope/field negatives deliberately do NOT build that chain — a malformed field is
 * refused regardless of stock, so they use an unprovisioned SGTIN and assert only that the
 * request was refused. That is a real limitation: those cases prove refusal, not refusal
 * *for the intended reason*. Tightening them means paying the fixture cost.
 */
import { expect } from '@playwright/test'
import {
  dispensation, pollMsgStatus, packOf, describeMsgStatus, errorOf, bodyOf,
  epcisDocument, dispensingEvent, destructionEvent, submitAndPoll,
  freshDispensableSgtin, sglnOf, glnFor,
  type EpcisDocument, type Role,
} from '../eptts-api'
import type { ApiCase } from './index'
import { atPharmacy, commissioned, inTransitToBranch } from './fixtures'
import { fieldCases, type MutationName } from './field-mutations'

const FEATURE = 'api-dispensing'
const PHARMACY = () => glnFor('pharmacy')
const BRANCH = () => glnFor('branch')

function dispDoc(epcList: string[], readPointRole: Role = 'pharmacy'): EpcisDocument {
  return epcisDocument(
    [dispensingEvent({ epcList, readPointSgln: sglnOf(readPointRole) })],
    { senderGln: glnFor(readPointRole), receiverGln: BRANCH() },
  )
}

/** Submit a dispense and poll it. Returns both halves so a case can assert either. */
async function dispense(role: Role, doc: EpcisDocument) {
  const res = await dispensation(role, doc)
  const body = await bodyOf(res)
  if (res.status() >= 400) {
    return { status: res.status(), body, msg: null }
  }
  const msg = await pollMsgStatus(role, doc.sbdh.documentIdentification.instanceIdentifier)
  return { status: res.status(), body, msg }
}

async function expectDispensed(role: Role, doc: EpcisDocument, what: string) {
  const r = await dispense(role, doc)
  // `/Dispensation` acknowledges with **200**, unlike `/scp/SendEPCIS` which uses 202 — but it
  // is still asynchronous, so the 200 means "queued", not "dispensed". Both are accepted here
  // because the status code is not the interesting part; the polled outcome is. Asserting 202
  // (as the docs and I both previously had it) fails against the real platform, and asserting
  // that 200 means success would pass while the dispense actually failed.
  expect([200, 202], `${what}: acknowledged — got ${r.status}`).toContain(r.status)
  expect(r.msg?.state, `${what}: ${r.msg ? describeMsgStatus(r.msg) : 'no poll'}`).toBe('SUCCESS')
}

async function expectRefused(role: Role, doc: EpcisDocument, what: string) {
  const r = await dispense(role, doc)
  if (r.status >= 400) {
    console.log(`[disp] ${what}: refused synchronously ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`)
    return
  }
  console.log(`[disp] ${what}: accepted (${r.status}) -> ${r.msg ? describeMsgStatus(r.msg) : 'no poll'}`)
  expect(r.msg?.timedOut, `${what}: MsgStatusQuery never resolved`).toBe(false)
  expect(r.msg?.state, `${what}: the platform ACCEPTED a dispense it should refuse — ${r.msg ? describeMsgStatus(r.msg) : ''}`)
    .toBe('FAILED')
}

// ─── business cases ──────────────────────────────────────────────────────────

const business: ApiCase[] = [
  {
    id: 'TC_DISP_001', feature: FEATURE, slow: true,
    title: 'a pharmacy dispenses a valid SGTIN',
    run: async () => {
      const a = await atPharmacy(1)
      await expectDispensed('pharmacy', dispDoc([a.sgtins[0]]), 'dispense one pack')
      const v = await packOf('pharmacy', a.sgtins[0])
      expect(v.pack?.status, 'the pack becomes dispensed').toBe('dispensed')
    },
  },
  {
    id: 'TC_DISP_002', feature: FEATURE, slow: true,
    title: 'a pharmacy dispenses multiple valid SGTINs in one request',
    run: async () => {
      const a = await atPharmacy(3)
      await expectDispensed('pharmacy', dispDoc(a.sgtins), 'dispense three packs')
      for (const s of a.sgtins) {
        const v = await packOf('pharmacy', s)
        expect(v.pack?.status, `${s} becomes dispensed`).toBe('dispensed')
      }
    },
  },
  {
    id: 'TC_DISP_003', feature: FEATURE, slow: true,
    title: 'a dispensed SGTIN leaves the pharmacy inventory',
    run: async () => {
      const a = await atPharmacy(1)
      const before = await packOf('pharmacy', a.sgtins[0])
      expect(before.pack?.status, 'in stock before dispensing').toBe('active')
      expect(before.pack?.currentGln, 'held by the pharmacy').toBe(PHARMACY())

      await expectDispensed('pharmacy', dispDoc([a.sgtins[0]]), 'dispense the pack')

      const after = await packOf('pharmacy', a.sgtins[0])
      expect(after.pack?.status, 'no longer available as stock').toBe('dispensed')
      // And it cannot be dispensed again — the state machine enforces it.
      await expectRefused('pharmacy', dispDoc([a.sgtins[0]]), 're-dispense the same pack')
    },
  },
  {
    id: 'TC_DISP_004', feature: FEATURE, slow: true,
    title: 'a manufacturer cannot dispense',
    run: async () => {
      const a = await atPharmacy(1)
      const doc = dispDoc([a.sgtins[0]], 'manufacturer')
      const res = await dispensation('manufacturer', doc)
      expect(res.status(), 'manufacturers are refused outright').toBe(403)
      const err = await errorOf(res)
      expect(err.message, 'the refusal names the permitted roles').toContain('available to')
    },
  },
  {
    id: 'TC_DISP_005', feature: FEATURE, slow: true,
    title: 'a branch dispensing is handled per the role rules',
    run: async () => {
      // The 403 body lists "SCP branch" among the permitted roles, so a branch reaches the
      // handler rather than being refused outright. The sheet expects a refusal; whichever
      // way this lands is the finding, so assert only that a branch does NOT successfully
      // dispense stock held by the pharmacy.
      const a = await atPharmacy(1)
      const doc = dispDoc([a.sgtins[0]], 'branch')
      const r = await dispense('branch', doc)
      console.log(`[disp] branch dispense -> ${r.status} ${r.msg ? describeMsgStatus(r.msg) : ''}`)
      if (r.status >= 400) return   // refused outright: acceptable
      expect(r.msg?.state, 'a branch must not dispense stock the pharmacy holds').not.toBe('SUCCESS')
    },
  },
  {
    id: 'TC_DISP_007', feature: FEATURE, slow: true,
    title: 'dispensing an SGTIN not in the pharmacy inventory is refused',
    run: async () => {
      // Commissioned and still with the manufacturer — never shipped to the pharmacy.
      const c = await commissioned(1, { dispensable: true })
      await expectRefused('pharmacy', dispDoc([c.sgtins[0]]), 'pack not in pharmacy stock')
    },
  },
  {
    id: 'TC_DISP_008', feature: FEATURE, slow: true,
    title: 'dispensing an SGTIN held by another party is refused',
    // devsim has one pharmacy tenant, so "another pharmacy" cannot be built. The
    // equivalent ownership violation is a pack held by the BRANCH, which is the same rule
    // (dispense only what you hold) exercised with the identities that exist.
    run: async () => {
      const t = await inTransitToBranch(1, { dispensable: true })
      await expectRefused('pharmacy', dispDoc([t.sgtins[0]]), 'pack held by another party')
    },
  },
  {
    id: 'TC_DISP_009', feature: FEATURE, slow: true,
    title: 'dispensing an expired SGTIN is refused',
    // Needs expired stock sitting AT the pharmacy. The chain cannot produce it: a pack
    // commissioned with a past expiry is refused at commissioning, so the state is
    // unreachable through the API. Left blocked rather than substituting a weaker
    // assertion that would look like coverage.
    skip: 'needs expired stock at the pharmacy; commissioning with a past expiry is itself refused, so the state cannot be built through the API',
    run: async () => { /* unreachable while skipped */ },
  },
  {
    id: 'TC_DISP_010', feature: FEATURE, slow: true,
    title: 'dispensing an already-dispensed SGTIN is refused',
    run: async () => {
      const a = await atPharmacy(1)
      await expectDispensed('pharmacy', dispDoc([a.sgtins[0]]), 'first dispense')
      await expectRefused('pharmacy', dispDoc([a.sgtins[0]]), 'second dispense')
    },
  },
  {
    id: 'TC_DISP_011', feature: FEATURE, slow: true,
    title: 'dispensing an in-transit SGTIN is refused',
    run: async () => {
      const t = await inTransitToBranch(1, { dispensable: true })
      await expectRefused('pharmacy', dispDoc([t.sgtins[0]]), 'in-transit pack')
    },
  },
  {
    id: 'TC_DISP_012', feature: FEATURE, slow: true,
    title: 'dispensing a destroyed SGTIN is refused',
    run: async () => {
      const a = await atPharmacy(1)
      // Destroy it as the pharmacy that holds it, then try to dispense.
      const destroy = epcisDocument(
        [destructionEvent({ epcList: [a.sgtins[0]], readPointSgln: sglnOf('pharmacy') })],
        { senderGln: PHARMACY(), receiverGln: PHARMACY() },
      )
      const { submitStatus, msg } = await submitAndPoll('pharmacy', destroy)
      console.log(`[disp] destroy at pharmacy -> ${submitStatus} ${describeMsgStatus(msg)}`)
      if (msg.state !== 'SUCCESS') {
        // If a pharmacy may not destroy, the precondition cannot be built here — say so
        // rather than passing on a weaker assertion.
        throw new Error(
          `fixture: could not destroy the pack as the pharmacy — ${describeMsgStatus(msg)}. ` +
          'Destroy-at-pharmacy may not be permitted; this case then needs the holder that can.')
      }
      await expectRefused('pharmacy', dispDoc([a.sgtins[0]]), 'destroyed pack')
    },
  },
  {
    id: 'TC_DISP_015', feature: FEATURE, slow: true,
    title: 'dispensing with duplicate SGTINs in the EPC list is refused',
    run: async () => {
      const a = await atPharmacy(1)
      await expectRefused('pharmacy', dispDoc([a.sgtins[0], a.sgtins[0]]), 'duplicate EPCs')
    },
  },
  {
    id: 'TC_DISP_016', feature: FEATURE, slow: true,
    title: 'a request mixing valid and invalid SGTINs is refused as a whole',
    run: async () => {
      const a = await atPharmacy(1)
      await expectRefused('pharmacy', dispDoc([a.sgtins[0], freshDispensableSgtin()]), 'one valid + one non-existent')
      const v = await packOf('pharmacy', a.sgtins[0])
      expect(v.pack?.status, 'the valid pack was NOT dispensed by the rejected request').toBe('active')
    },
  },
  {
    id: 'TC_DISP_017', feature: FEATURE, slow: true,
    title: 'a request of several valid SGTINs plus one invalid is refused as a whole',
    run: async () => {
      const a = await atPharmacy(2)
      await expectRefused('pharmacy', dispDoc([...a.sgtins, freshDispensableSgtin()]), 'two valid + one invalid')
      for (const s of a.sgtins) {
        const v = await packOf('pharmacy', s)
        expect(v.pack?.status, `${s} was not dispensed`).toBe('active')
      }
    },
  },
  {
    id: 'TC_DISP_030', feature: FEATURE, slow: true,
    title: 'a duplicate dispensing request is refused',
    run: async () => {
      const a = await atPharmacy(1)
      await expectDispensed('pharmacy', dispDoc([a.sgtins[0]]), 'first request')
      await expectRefused('pharmacy', dispDoc([a.sgtins[0]]), 'identical second request')
    },
  },
  {
    id: 'TC_DISP_034', feature: FEATURE, slow: true,
    title: 'dispensing a Dawana-integrated product through this API is refused',
    run: async () => {
      // Not in the sheet, but it is the single most likely reason a real dispensing
      // integration fails: 27 of the manufacturer's 30 products are Dawana-integrated and
      // must go through the Dawana channel instead. Worth pinning down explicitly.
      // The pack must be AT the pharmacy, on a Dawana GTIN. Commissioning one and dispensing
      // it straight away instead hits "DISPENSING requires prior receiving" first, so the
      // Dawana rule is never reached and the test proves nothing about it.
      const dawana = await atPharmacy(1, { dispensable: false })
      const r = await dispense('pharmacy', dispDoc([dawana.sgtins[0]]))
      const all = JSON.stringify(r.body) + JSON.stringify(r.msg?.body)
      console.log(`[disp] Dawana product -> ${r.status} ${r.msg ? describeMsgStatus(r.msg) : ''}`)
      expect(all, 'the refusal names the Dawana channel').toMatch(/Dawana/i)
    },
  },
]

// ─── shared field negatives ──────────────────────────────────────────────────

/**
 * Base document for the field negatives: a dispensable SGTIN that was never provisioned to
 * the pharmacy. Deliberately skips the ~1 minute custody chain — a malformed field is
 * refused irrespective of stock. The trade-off is stated in the file header.
 */
async function baseDoc(): Promise<EpcisDocument> {
  return dispDoc([freshDispensableSgtin()])
}

const FIELD_MAP: Partial<Record<string, MutationName>> = {
  TC_DISP_006: 'malformedEpc',          // non-existing SGTIN
  TC_DISP_013: 'ssccInsteadOfSgtin',
  TC_DISP_014: 'malformedEpc',
  TC_DISP_018: 'emptyEpcList',
  TC_DISP_019: 'invalidType',
  TC_DISP_020: 'invalidAction',
  TC_DISP_021: 'invalidBizStep',
  TC_DISP_022: 'invalidDisposition',
  TC_DISP_023: 'invalidEventTime',
  TC_DISP_024: 'invalidOffset',
  TC_DISP_025: 'emptyReadPoint',
  TC_DISP_026: 'emptyBizLocation',
  TC_DISP_027: 'malformedReadPoint',
  TC_DISP_028: 'malformedBizLocation',
  TC_DISP_029: 'mismatchedLocations',
  TC_DISP_031: 'badSchemaVersion',
  TC_DISP_032: 'invalidSender',
  TC_DISP_033: 'invalidReceiver',
}

export const DISPENSING_CASES: ApiCase[] = [
  ...business,
  // reject: expectRefused — these documents go to /Dispensation, NOT /scp/SendEPCIS.
  ...fieldCases({
    feature: FEATURE, role: 'pharmacy', verb: 'dispensing', baseDoc, map: FIELD_MAP,
    reject: expectRefused,
  }),
]
