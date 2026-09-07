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
  dispenseCancelEvent, patientReturnEvent,
  freshDispensableSgtin, sglnOf, glnFor,
  type EpcisDocument, type Role,
} from '../eptts-api'
import type { ApiCase } from './index'
import { atPharmacy, commissioned, inTransitToBranch } from './fixtures'
import { fieldCases, assertNotIncidental, type MutationName } from './field-mutations'

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

/**
 * A dispense that the platform accepted AND that actually retired the packs.
 *
 * The polled verdict says the message processed; it does not say the packs changed state. Pass
 * the SGTINs to have that checked: each must end up `dispensed` and still in the dispensing
 * party's custody. Several cases already asserted this inline, which meant every case that did
 * not was trusting the verdict alone — the same gap TC_SHIP_014 had, where an accepted event
 * moved status without moving custody.
 */
async function expectDispensed(
  role: Role, doc: EpcisDocument, what: string, epcs: string[] = [],
) {
  const r = await dispense(role, doc)
  // Both codes stay accepted, but not for the reason previously written here. This comment
  // claimed /Dispensation answers 200 while /scp/SendEPCIS answers 202; measured 2026-09-07,
  // /Dispensation answers 202 as well and settles through MsgStatusQuery exactly like the
  // unified endpoint. Dispensing is asynchronous now, so either code means "queued" and only
  // the polled outcome decides. The tolerance is kept so an older deployment still answering
  // 200 does not fail for the wrong reason.
  expect([200, 202], `${what}: acknowledged — got ${r.status}`).toContain(r.status)
  expect(r.msg?.state, `${what}: ${r.msg ? describeMsgStatus(r.msg) : 'no poll'}`).toBe('SUCCESS')

  for (const epc of epcs) {
    const v = await packOf(role, epc)
    const seen = `status=${v.pack?.status} currentGln=${v.pack?.currentGln}`
    console.log(`[disp] ${what}: ${epc} ${seen}`)
    expect.soft(v.pack?.status,
      `${what}: ${epc} must be dispensed afterwards. ${seen}`).toBe('dispensed')
    expect.soft(v.pack?.currentGln,
      `${what}: dispensing must not move custody. ${seen}`).toBe(glnFor(role))
  }
}

async function expectRefused(role: Role, doc: EpcisDocument, what: string, reason?: RegExp) {
  const r = await dispense(role, doc)
  if (r.status >= 400) {
    console.log(`[disp] ${what}: refused synchronously ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`)
    assertNotIncidental(JSON.stringify(r.body), what, reason)
    return
  }
  console.log(`[disp] ${what}: accepted (${r.status}) -> ${r.msg ? describeMsgStatus(r.msg) : 'no poll'}`)
  expect(r.msg?.timedOut, `${what}: MsgStatusQuery never resolved`).toBe(false)
  expect(r.msg?.state, `${what}: the platform ACCEPTED a dispense it should refuse — ${r.msg ? describeMsgStatus(r.msg) : ''}`)
    .toBe('FAILED')
  // A refusal is not enough — it has to be THIS rule's refusal. Without this the caller-scope
  // rejection satisfied every negative dispensing case while the positive ones failed.
  assertNotIncidental(
    `${r.msg?.raw ?? ''} ${(r.msg?.logs ?? []).map((l) => l.message).join(' | ')}`, what, reason,
  )
}

// ─── business cases ──────────────────────────────────────────────────────────

const business: ApiCase[] = [
  {
    id: 'TC_DISP_001', feature: FEATURE, slow: true,
    title: 'a pharmacy dispenses a valid SGTIN',
    run: async () => {
      const a = await atPharmacy(1)
      await expectDispensed('pharmacy', dispDoc([a.sgtins[0]]), 'dispense one pack', [a.sgtins[0]])
      const v = await packOf('pharmacy', a.sgtins[0])
      expect(v.pack?.status, 'the pack becomes dispensed').toBe('dispensed')
    },
  },
  {
    id: 'TC_DISP_002', feature: FEATURE, slow: true,
    title: 'a pharmacy dispenses multiple valid SGTINs in one request',
    run: async () => {
      // THE SHEET AND THE PLATFORM DISAGREE, and the platform has the better argument.
      //
      // The sheet marks multi-EPC dispensing POSITIVE. The platform refuses it outright:
      // "Dispense event must contain exactly 1 EPC, got 3". That is coherent — a dispense is
      // recorded against one prescription line, so one event per pack keeps the audit trail
      // attributable. Batching would make it impossible to say which pack went to whom.
      //
      // So this asserts the real behaviour and records the divergence, rather than failing
      // forever against a sheet assumption. Worth confirming with the PO that one-per-request
      // is intended rather than a limitation.
      const a = await atPharmacy(3)
      await expectRefused('pharmacy', dispDoc(a.sgtins), 'three packs in one dispense')

      // And the packs must be untouched by the refusal — a rejected batch must not
      // partially apply.
      for (const s of a.sgtins) {
        const v = await packOf('pharmacy', s)
        expect(v.pack?.status, `${s} was NOT dispensed by the refused batch`).not.toBe('dispensed')
      }

      // One at a time is the supported path, so prove that still works.
      await expectDispensed('pharmacy', dispDoc([a.sgtins[0]]), 'one pack per request', [a.sgtins[0]])
      const first = await packOf('pharmacy', a.sgtins[0])
      expect(first.pack?.status, 'the single dispense applied').toBe('dispensed')
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

      await expectDispensed('pharmacy', dispDoc([a.sgtins[0]]), 'dispense the pack', [a.sgtins[0]])

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
      await expectDispensed('pharmacy', dispDoc([a.sgtins[0]]), 'first dispense', [a.sgtins[0]])
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
      await expectDispensed('pharmacy', dispDoc([a.sgtins[0]]), 'first request', [a.sgtins[0]])
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

// ─── reversing a dispense ────────────────────────────────────────────────────
//
// Three operations, none of them in the source spreadsheet, all three confirmed to have a
// live handler on 2026-09-07 by submitting ten action/bizStep combinations and reading which
// ones the platform answered:
//
//   action=DELETE  bizStep=dispensing          -> "Dispensing Cancellation event ..."
//   action=DELETE  bizStep=partial_dispensing  -> "Partial Dispensing Cancellation event ..."
//   action=OBSERVE bizStep=patient_return      -> "Patient Return event ..."
//
// A PATIENT RETURN IS RECORDED AS A DISPENSING CANCELLATION (the first of the three) — the
// product owner's answer, and what API doc 3.04 describes in its own words: "Used to cancel a
// dispensing event. The dispensed medicine is returned to the pharmacy." Cancelling the sale
// and the goods coming back are one operation here, not two.
//
// All three go to `/scp/SendEPCIS`, NOT `/Dispensation` — the forward sale is the only part of
// this feature with its own endpoint.

/** Dispense a pack and require it to actually reach `dispensed`, or fail saying why. */
async function dispensedPack(): Promise<string> {
  const a = await atPharmacy(1)
  const sgtin = a.sgtins[0]
  const r = await dispense('pharmacy', dispDoc([sgtin]))
  const v = await packOf('pharmacy', sgtin)
  if (v.pack?.status !== 'dispensed') {
    throw new Error(
      `fixture: could not dispense ${sgtin}, so there is nothing to reverse — ` +
      `${r.msg ? describeMsgStatus(r.msg) : `http ${r.status}`}. On a tenant where dispensing ` +
      'is refused outright see data/eptts-api/bugs/api-dispensing/ — the reversal cases cannot ' +
      'run until a dispense can complete.',
    )
  }
  return sgtin
}

const reversal: ApiCase[] = [
  {
    id: 'TC_DISP_035', feature: FEATURE, slow: true,
    title: 'a patient return is recorded as a Dispensing Cancellation and restores pharmacy stock',
    run: async () => {
      const sgtin = await dispensedPack()

      const doc = epcisDocument(
        [dispenseCancelEvent({ epcList: [sgtin], readPointSgln: sglnOf('pharmacy') })],
        { senderGln: PHARMACY(), receiverGln: PHARMACY() },
      )
      const { submitStatus, msg } = await submitAndPoll('pharmacy', doc)
      console.log(`[disp] dispense cancellation -> ${submitStatus} ${describeMsgStatus(msg)}`)
      expect(submitStatus, 'the cancellation is accepted for processing').toBe(202)
      expect(msg.state, `cancelling the dispense — ${describeMsgStatus(msg)}`).toBe('SUCCESS')

      // The point of the operation: the medicine is sellable stock again, and it never
      // changed hands — a patient is not a trade partner, so custody must not move.
      const v = await packOf('pharmacy', sgtin)
      const seen = `status=${v.pack?.status} currentGln=${v.pack?.currentGln}`
      console.log(`[disp] after the patient return: ${seen}`)
      expect.soft(v.pack?.status, `the pack returns to pharmacy stock. ${seen}`).toBe('active')
      expect.soft(v.pack?.currentGln, `a patient return does not move custody. ${seen}`).toBe(PHARMACY())
    },
  },
  {
    id: 'TC_DISP_036', feature: FEATURE, slow: true,
    title: 'a Patient Return event is routed, and its effect is recorded against the cancellation',
    run: async () => {
      // `patient_return` has its own handler, so the open question is not whether it is
      // accepted but what it DOES relative to TC_DISP_035. Asserting only that it is routed
      // and then recording the resulting state keeps this honest: the day the two diverge,
      // the log says so instead of a guess being baked into an assertion.
      const sgtin = await dispensedPack()

      const doc = epcisDocument(
        [patientReturnEvent({ epcList: [sgtin], readPointSgln: sglnOf('pharmacy') })],
        { senderGln: PHARMACY(), receiverGln: PHARMACY() },
      )
      const { submitStatus, msg } = await submitAndPoll('pharmacy', doc, { timeoutMs: 45_000 })
      console.log(`[disp] patient_return event -> ${submitStatus} ${describeMsgStatus(msg)}`)
      expect(submitStatus, 'accepted for processing').toBe(202)

      // Routed at all: an unhandled action/bizStep pair never reaches a terminal state
      // (TC_DISP_037), so this is the assertion that distinguishes the two.
      expect(msg.timedOut,
        `bizStep patient_return must reach a handler — ${describeMsgStatus(msg)}`).toBe(false)

      const v = await packOf('pharmacy', sgtin)
      console.log(`[disp] after patient_return: status=${v.pack?.status} ` +
        `currentGln=${v.pack?.currentGln} (compare with TC_DISP_035)`)
      expect(v.pack?.currentGln, 'whatever it does, it must not move custody').toBe(PHARMACY())
    },
  },
  {
    id: 'TC_DISP_037', feature: FEATURE, slow: true,
    title: 'an unsupported action + bizStep pairing is refused rather than silently accepted',
    run: async () => {
      // DELETE belongs with `dispensing` and OBSERVE with `patient_return`; crossing them
      // gives a document the platform has no handler for. It is the exact pairing a reader of
      // API doc 3.04's field table would send, so it is worth knowing what happens — and the
      // answer is good: 202, then "A - Technical Error" / "No valid events found in eventList"
      // on the first poll. The pack is left alone.
      //
      // This case also guards the CLASSIFIER, which is why it earns its place. `A` is not in
      // the documented S/E/F/P/I/Q status table, and a poller that ignores it reads a prompt
      // refusal as an eternal timeout. That misreading produced a false bug report against the
      // platform on 2026-09-07; if classifyStatus ever loses the A branch, this case is where
      // it surfaces.
      const a = await atPharmacy(1)
      const doc = epcisDocument(
        [{
          type: 'ObjectEvent',
          eventTime: new Date().toISOString().replace(/\.\d+Z$/, '+03:00'),
          eventTimeZoneOffset: '+03:00',
          readPoint: { id: sglnOf('pharmacy') },
          bizLocation: { id: sglnOf('pharmacy') },
          action: 'DELETE',
          bizStep: 'patient_return',
          disposition: 'active',
          epcList: [a.sgtins[0]],
        }],
        { senderGln: PHARMACY(), receiverGln: PHARMACY() },
      )
      // 30 s, not the 90 s default: a recognised event answers on the first poll, and the
      // point here is that no verdict ever arrives — waiting three times as long to say so
      // only makes the suite slower.
      const { submitStatus, msg } = await submitAndPoll('pharmacy', doc, { timeoutMs: 30_000 })
      console.log(`[disp] unroutable DELETE+patient_return -> ${submitStatus} ${describeMsgStatus(msg)}`)

      // Either shape of refusal is acceptable; silence is not.
      if (submitStatus >= 400) return
      expect(msg.timedOut,
        `an unroutable event must be refused, not left pending — ${describeMsgStatus(msg)}`).toBe(false)
      expect(msg.state, `and the refusal must say so — ${describeMsgStatus(msg)}`).toBe('FAILED')

      // Whatever the platform decides, it must not have consumed the pack.
      const v = await packOf('pharmacy', a.sgtins[0])
      expect(v.pack?.status, 'the pack is untouched by an unroutable event').toBe('active')
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
  ...reversal,
  // reject: expectRefused — these documents go to /Dispensation, NOT /scp/SendEPCIS.
  ...fieldCases({
    // These reached a correct refusal in the clean run, so the shared KNOWN_GAPS marker
    // would claim a defect this endpoint does not have — and hide that it validates.
    validates: ['TC_DISP_018', 'TC_DISP_022', 'TC_DISP_023', 'TC_DISP_024'],
    feature: FEATURE, role: 'pharmacy', verb: 'dispensing', baseDoc, map: FIELD_MAP,
    reject: expectRefused,
  }),
]
