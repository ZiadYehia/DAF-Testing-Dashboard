/**
 * EPTTS_API_02 — Commissioning. All 41 spreadsheet cases, one per Hub project.
 * (TC_COMM_022 does not exist — the source spreadsheet skips it.)
 *
 * Most cases are "take a valid commissioning document, break one field, expect it to be
 * refused", so they are declared as a mutation table rather than 38 near-identical bodies.
 *
 * A rejection can arrive two ways and both count:
 *   SYNCHRONOUS  4xx, nothing queued            (malformed document)
 *   ASYNCHRONOUS 202, then MsgStatusQuery FAILED (business-rule violation)
 * `expectRejected` accepts either and fails only when the platform ACCEPTS the input.
 *
 * Executed against production 2026-08-31:
 *   - Five cases the sheet recorded as Fail (TC_COMM_033/035/038/041/042) now reject
 *     correctly and carry no marker.
 *   - Nine cases the sheet recorded as Pass are in fact accepted when they should be
 *     refused, and carry `expectFail`.
 */
import { expect } from '@playwright/test'
import {
  submitAndPoll, sendEpcis, packOf, describeMsgStatus,
  epcisDocument, commissionEvent,
  freshSgtin, sglnOf, glnFor, uniqueSerial, runId, productByGtin, MFG_GTINS,
  type EpcisDocument, type Role,
} from '../eptts-api'
import { expectRejected as expectRejectedStrict } from './field-mutations'
import type { ApiCase } from './index'

const FEATURE = 'api-commission'
const MFG = () => glnFor('manufacturer')

/** A valid, commissionable document. Every mutation starts from this. */
function validDoc(epcs: string[] = [freshSgtin()]): EpcisDocument {
  return epcisDocument(
    [commissionEvent({
      epcList: epcs,
      lotNumber: `ZTG-${runId()}`,
      expiryDate: '2030-12-31',
      readPointSgln: sglnOf('manufacturer'),
    })],
    { senderGln: MFG(), receiverGln: MFG() },
  )
}

/** Reach into the single event so mutations read cleanly. */
function ev(doc: EpcisDocument): Record<string, unknown> {
  return doc.epcisBody.eventList[0]
}
function ilmd(doc: EpcisDocument): Record<string, unknown> {
  return ev(doc).ilmd as Record<string, unknown>
}

/**
 * Assert the platform refused a document, optionally for a stated reason.
 *
 * Delegates to the one in field-mutations.ts. There used to be three near-identical copies of
 * this — here, in packing.ts, and there — so hardening one left the other two accepting any
 * refusal at all. That is how TC_COMM_011 passed on "batch exceeds 20 characters".
 */
async function expectRejected(
  role: Role, doc: EpcisDocument, label: string, reason?: RegExp,
): Promise<void> {
  return expectRejectedStrict(role, doc, label, reason)
}

/** Assert the platform accepted and successfully processed a document. */
async function expectAccepted(role: Role, doc: EpcisDocument, label: string): Promise<void> {
  const { submitStatus, msg } = await submitAndPoll(role, doc)
  expect(submitStatus, `${label}: accepted for processing`).toBe(202)
  expect(msg.state, `${label}: ${describeMsgStatus(msg)}`).toBe('SUCCESS')
}

// ─── mutation table ──────────────────────────────────────────────────────────

interface Mut {
  id: string
  what: string
  mutate: (doc: EpcisDocument) => void
  /** Set when the platform currently accepts this input; becomes test.fail(). */
  gap?: string
}

const MUTATIONS: Mut[] = [
  // EPC list, GTIN, serial
  {
    id: 'TC_COMM_004', what: 'an empty epcList', mutate: (d) => { ev(d).epcList = [] },
    gap: 'an event with zero EPCs is accepted; the log even omits the "Commission (Items)" line',
  },
  {
    id: 'TC_COMM_005', what: 'a GTIN not registered on the platform',
    // Valid URN shape, but the item reference belongs to no registered product.
    mutate: (d) => { ev(d).epcList = [`urn:epc:id:sgtin:84353083.09999.${uniqueSerial()}`] },
  },
  {
    id: 'TC_COMM_006', what: 'a GTIN one digit too short (13)',
    mutate: (d) => { ev(d).epcList = [`urn:epc:id:sgtin:8435308.05448.${uniqueSerial()}`] },
  },
  {
    id: 'TC_COMM_007', what: 'a GTIN one digit too long (15)',
    mutate: (d) => { ev(d).epcList = [`urn:epc:id:sgtin:843530831.054489.${uniqueSerial()}`] },
  },
  {
    id: 'TC_COMM_008', what: 'an empty serial number',
    mutate: (d) => { ev(d).epcList = ['urn:epc:id:sgtin:84353083.05448.'] },
  },

  // ilmd — lot and expiry
  {
    id: 'TC_COMM_009', what: 'an expiry date in the past',
    mutate: (d) => { ilmd(d)['cbvmda:itemExpirationDate'] = '2020-01-01' },
  },
  {
    id: 'TC_COMM_010', what: 'an empty batch number',
    mutate: (d) => { ilmd(d)['cbvmda:lotNumber'] = '' },
  },
  {
    id: 'TC_COMM_013', what: 'an empty expiry date',
    mutate: (d) => { ilmd(d)['cbvmda:itemExpirationDate'] = '' },
  },
  {
    id: 'TC_COMM_014', what: 'a malformed expiry date',
    mutate: (d) => { ilmd(d)['cbvmda:itemExpirationDate'] = '31-12-2030' },
  },

  // SBDH
  { id: 'TC_COMM_018', what: 'an empty SBDH sender identifier', mutate: (d) => { d.sbdh.sender.identifier = '' } },
  { id: 'TC_COMM_019', what: 'a malformed SBDH sender identifier', mutate: (d) => { d.sbdh.sender.identifier = 'NOT-A-GLN' } },
  { id: 'TC_COMM_020', what: 'an empty SBDH receiver identifier', mutate: (d) => { d.sbdh.receiver.identifier = '' } },
  { id: 'TC_COMM_021', what: 'a malformed SBDH receiver identifier', mutate: (d) => { d.sbdh.receiver.identifier = 'NOT-A-GLN' } },

  // event fields
  { id: 'TC_COMM_023', what: 'an empty event type', mutate: (d) => { ev(d).type = '' } },
  { id: 'TC_COMM_024', what: 'an unknown event type', mutate: (d) => { ev(d).type = 'TeleportEvent' } },
  {
    id: 'TC_COMM_025', what: 'an empty eventTime', mutate: (d) => { ev(d).eventTime = '' },
    gap: 'an empty eventTime is accepted and processed successfully',
  },
  {
    id: 'TC_COMM_026', what: 'a non-ISO-8601 eventTime', mutate: (d) => { ev(d).eventTime = '05-05-2026 10:00' },
    gap: 'a non-ISO-8601 eventTime is accepted and processed successfully',
  },
  {
    id: 'TC_COMM_027', what: 'an empty eventTimeZoneOffset', mutate: (d) => { ev(d).eventTimeZoneOffset = '' },
    gap: 'an empty eventTimeZoneOffset is accepted and processed successfully',
  },
  {
    id: 'TC_COMM_028', what: 'an invalid eventTimeZoneOffset', mutate: (d) => { ev(d).eventTimeZoneOffset = '+99:99' },
    gap: 'eventTimeZoneOffset +99:99 is accepted and processed successfully',
  },
  { id: 'TC_COMM_029', what: 'an empty action', mutate: (d) => { ev(d).action = '' } },
  { id: 'TC_COMM_030', what: 'an invalid action', mutate: (d) => { ev(d).action = 'MODIFY' } },
  { id: 'TC_COMM_031', what: 'an empty bizStep', mutate: (d) => { ev(d).bizStep = '' } },
  { id: 'TC_COMM_032', what: 'an invalid bizStep', mutate: (d) => { ev(d).bizStep = 'teleporting' } },
  { id: 'TC_COMM_033', what: 'an empty disposition', mutate: (d) => { ev(d).disposition = '' } },
  {
    id: 'TC_COMM_034', what: 'an invalid disposition', mutate: (d) => { ev(d).disposition = 'teleported' },
    // TC_COMM_033 (empty) IS refused as a missing mandatory field, so the presence check
    // exists — but the value is never checked against the CBV vocabulary.
    gap: 'a disposition outside the CBV vocabulary is accepted (presence is checked, validity is not)',
  },
  { id: 'TC_COMM_035', what: 'an unsupported schemaVersion', mutate: (d) => { d.schemaVersion = '9.9' } },
  { id: 'TC_COMM_036', what: 'an empty readPoint identifier', mutate: (d) => { ev(d).readPoint = { id: '' } } },
  { id: 'TC_COMM_037', what: 'a malformed readPoint identifier', mutate: (d) => { ev(d).readPoint = { id: 'NOT-AN-SGLN' } } },
  { id: 'TC_COMM_038', what: 'an empty bizLocation identifier', mutate: (d) => { ev(d).bizLocation = { id: '' } } },
  { id: 'TC_COMM_039', what: 'a malformed bizLocation identifier', mutate: (d) => { ev(d).bizLocation = { id: 'NOT-AN-SGLN' } } },

  // acting for another GLN
  {
    id: 'TC_COMM_040', what: 'a sender identifier belonging to another GLN',
    mutate: (d) => { d.sbdh.sender.identifier = glnFor('branch') },
  },
  {
    id: 'TC_COMM_041', what: 'a readPoint belonging to another GLN',
    mutate: (d) => { ev(d).readPoint = { id: sglnOf('branch') } },
  },
  {
    id: 'TC_COMM_042', what: 'a bizLocation belonging to another GLN',
    mutate: (d) => { ev(d).bizLocation = { id: sglnOf('branch') } },
  },
]

const mutationCases: ApiCase[] = MUTATIONS.map((m) => ({
  id: m.id,
  feature: FEATURE,
  title: `commissioning with ${m.what} is refused`,
  slow: true,
  expectFail: m.gap ? `platform validation gap: ${m.gap}` : undefined,
  run: async () => {
    const doc = validDoc()
    m.mutate(doc)
    await expectRejected('manufacturer', doc, `${m.id} ${m.what}`)
  },
}))

// ─── cases with their own shape ──────────────────────────────────────────────

const specialCases: ApiCase[] = [
  {
    id: 'TC_COMM_001', feature: FEATURE, slow: true,
    title: 'commission a new pack with a valid request body',
    run: async () => {
      const sgtin = freshSgtin()
      await expectAccepted('manufacturer', validDoc([sgtin]), 'single commission')

      const v = await packOf('manufacturer', sgtin)
      expect(v.verified, 'the pack exists after commissioning').toBe(true)
      expect(v.pack?.status, 'a commissioned pack is active').toBe('active')
      expect(v.pack?.currentGln, 'owned by the commissioning manufacturer').toBe(MFG())
      expect(v.pack?.expiryDate, 'the ilmd expiry is stored').toBe('2030-12-31')
      expect(v.pack?.batchNumber, 'the ilmd lot is stored').toBeTruthy()
    },
  },
  {
    id: 'TC_COMM_002', feature: FEATURE, slow: true,
    title: 'commission multiple packs in one request',
    run: async () => {
      const epcs = [freshSgtin(), freshSgtin(), freshSgtin()]
      await expectAccepted('manufacturer', validDoc(epcs), 'batch commission')
      for (const epc of epcs) {
        const v = await packOf('manufacturer', epc)
        expect(v.verified, `${epc} exists`).toBe(true)
        expect(v.pack?.status, `${epc} is active`).toBe('active')
      }
    },
  },
  {
    id: 'TC_COMM_003', feature: FEATURE, slow: true,
    title: 're-commissioning an already-commissioned pack is refused',
    // The sheet marks this POSITIVE, expecting the pack to simply stay commissioned. A
    // reviewer flagged that as wrong — "how is that positive? the system should reject an
    // already commissioned pack" — and they are right: accepting a duplicate breaks
    // serialisation integrity. Confirmed accepted on 2026-08-31.
    expectFail: 'platform validation gap: re-commissioning an existing SGTIN succeeds',
    run: async () => {
      const sgtin = freshSgtin()
      await expectAccepted('manufacturer', validDoc([sgtin]), 'first commission')
      await expectRejected('manufacturer', validDoc([sgtin]), 'second commission of the same SGTIN')
    },
  },
  {
    id: 'TC_COMM_011', feature: FEATURE, slow: true,
    title: 're-commissioning the same SGTIN with a different batch is refused',
    /**
     * This case reported PASS while proving nothing.
     *
     * It used to set the second lot to `OTHER-${uniqueSerial()}` — 24 characters — and the
     * platform answered "batch exceeds 20 characters". expectRejected saw a rejection and was
     * satisfied, so the re-commissioning rule was never reached. With a lot inside the limit
     * the platform returns "S - Successful": the re-commission IS accepted.
     *
     * The lot is now short enough to stay clear of that limit, and the rejection has to name
     * the pack or the duplicate for the assertion to count.
     */
    expectFail: 'platform validation gap: re-commissioning with a different batch succeeds',
    run: async () => {
      const sgtin = freshSgtin()
      await expectAccepted('manufacturer', validDoc([sgtin]), 'first commission')
      const doc = validDoc([sgtin])
      // 20 characters is the platform's limit; keep well inside it so a length complaint
      // cannot stand in for the rule under test.
      ilmd(doc)['cbvmda:lotNumber'] = `OTHER-${runId().slice(0, 8)}`
      await expectRejected('manufacturer', doc, 'same SGTIN, different batch',
        /already|exists|duplicate|commission|sgtin|pack/i)
    },
  },
  {
    id: 'TC_COMM_012', feature: FEATURE, slow: true,
    title: 're-commissioning the same SGTIN with a different expiry is refused',
    // Worse than a plain duplicate: this silently REWRITES an existing pack's expiry.
    // This used to add "note a different *batch* IS correctly refused, so this looks like an
    // oversight". That was wrong, and it came from TC_COMM_011's false pass: a different batch
    // is accepted too. The gap is not an oversight in one field — no ilmd change is checked.
    expectFail: 'platform validation gap: re-commissioning with a different expiry succeeds',
    run: async () => {
      const sgtin = freshSgtin()
      await expectAccepted('manufacturer', validDoc([sgtin]), 'first commission')
      const doc = validDoc([sgtin])
      ilmd(doc)['cbvmda:itemExpirationDate'] = '2029-06-30'
      await expectRejected('manufacturer', doc, 'same SGTIN, different expiry')
    },
  },
  {
    id: 'TC_COMM_015', feature: FEATURE, slow: true,
    title: 'a non-manufacturer role cannot commission',
    run: async () => {
      // Only a manufacturer may bring serials into existence, and a non-manufacturer must
      // be refused even with a perfectly valid document.
      for (const role of ['branch', 'pharmacy'] as Role[]) {
        await expectRejected(role, validDoc(), `${role} attempting to commission`)
      }
    },
  },
  {
    id: 'TC_COMM_016', feature: FEATURE,
    title: 'an empty or malformed bearer token is rejected',
    run: async () => {
      const empty = await sendEpcis('manufacturer', validDoc(), { headers: { Authorization: 'Bearer ' } })
      expect(empty.status(), 'an empty token is unauthorized').toBe(401)
      const bad = await sendEpcis('manufacturer', validDoc(), { headers: { Authorization: 'Bearer not-a-jwt' } })
      expect(bad.status(), 'a malformed token is unauthorized').toBe(401)
    },
  },
  {
    id: 'TC_COMM_017', feature: FEATURE,
    title: 'an empty apikey header does not affect an authenticated request',
    run: async () => {
      // Re-targeted. The sheet expected an empty apikey to break the request, but the
      // event endpoints do not read `apikey` at all — only Authorization. Asserting
      // otherwise would encode a contract that does not exist.
      const res = await sendEpcis('manufacturer', validDoc(), { headers: { apikey: '' } })
      expect(res.status(), 'the request still succeeds on the bearer token alone').toBe(202)
    },
  },
]

// ─── security ────────────────────────────────────────────────────────────────

// New cases continue the feature's own counter, per the ID-scheme rule: the sheet ends
// at TC_COMM_042, so these are 043 and 044 and are added to the test-case table too.
const INJECTIONS: { id: string; label: string; payload: string }[] = [
  { id: 'TC_COMM_043', label: 'SQL injection', payload: "' OR 1=1 --" },
  { id: 'TC_COMM_044', label: 'XSS', payload: '<script>alert(1)</script>' },
]

const securityCases: ApiCase[] = INJECTIONS.map(({ id, label, payload }) => ({
  id,
  feature: FEATURE,
  title: `${label} in the lot number is refused safely`,
  slow: true,
  run: async () => {
    const doc = validDoc()
    ilmd(doc)['cbvmda:lotNumber'] = payload
    const { submitStatus, submitBody, msg } = await submitAndPoll('manufacturer', doc)
    const all = JSON.stringify(submitBody) + JSON.stringify(msg.body)
    console.log(`[comm] ${label} in lot -> ${submitStatus} ${describeMsgStatus(msg)}`)

    expect(submitStatus, 'accepted for processing before validation').toBe(202)
    // Lot numbers are allow-listed:
    //   ILMD cbvmda:lotNumber "<...>" is invalid — must contain only Latin letters,
    //   digits, or the separators - . _ /
    // Quoting the rejected value back inside a JSON error is correct and is NOT an XSS
    // vector, so this asserts refusal plus no leakage — not the absence of the string.
    expect(msg.state, `${label} must be refused: ${describeMsgStatus(msg)}`).toBe('FAILED')
    expect(all, 'no SQL internals leak').not.toMatch(/syntax error|sqlstate|constraint|relation .* does not exist/i)
    expect(all, 'the refusal explains the allowed character set').toMatch(/invalid|must contain/i)
  },
}))

// ─── pricing gate (PO rule, confirmed 2026-09-07) ────────────────────────────

/**
 * A product whose price has not been approved must not enter the supply chain.
 *
 * The PO's rule: `pricingReviewStatus = pending` BLOCKS commissioning and packing. Only an
 * approved price may proceed. The reason is billing — every packed unit is priced from that
 * figure, so commissioning stock against an unapproved price means invoicing at a number
 * nobody signed off.
 *
 * The platform enforces the weaker rule of price PRESENCE: it refuses a GTIN with no price at
 * all ("Cannot seal this container: no registered unit price") but accepts one whose price is
 * pending review. Marked expectFail rather than skipped so the assertion keeps running and
 * reports an unexpected pass the moment the gate is added.
 */
/**
 * Is billing ENFORCE mode active on this tenant?
 *
 * The PO's pricing-approval rule only bites when it is: with enforce off, commissioning and
 * packing a product whose price is pending review is legitimate, so asserting a refusal would
 * manufacture a failure. Declared by the tester rather than read from the platform, because no
 * endpoint exposes the flag — /settings, /billing/mode and a dozen siblings are all absent. If
 * one appears, read it here instead and delete the variable.
 *
 * Unset means "do not assume": the cases skip and say why, rather than defaulting to a
 * verdict on a rule that may not be in force.
 */
const BILLING_ENFORCE_ACTIVE = process.env.EPTTS_BILLING_ENFORCE === '1'
const PRICING_GATE_SKIP = BILLING_ENFORCE_ACTIVE
  ? undefined
  : 'the pricing-approval gate applies only when billing enforce mode is active — set '
    + 'EPTTS_BILLING_ENFORCE=1 once that is confirmed for the tenant'

const pricingGateCases: ApiCase[] = [
  {
    id: 'TC_COMM_045', feature: FEATURE, slow: true,
    title: 'commissioning a product whose pricing review is pending is refused',
    skip: PRICING_GATE_SKIP,
    expectFail: 'the platform gates on a price EXISTING, not on it being approved — '
      + 'pricingReviewStatus=pending is accepted',
    run: async () => {
      const gtin = MFG_GTINS[0]
      const product = await productByGtin('manufacturer', gtin)
      expect(product, `${gtin} must be readable from /products`).not.toBeNull()
      // Stating the precondition in the assertion, so a run against a tenant whose pricing IS
      // approved fails loudly here rather than quietly testing nothing.
      expect(product!.pricingReviewStatus,
        `this case needs ${gtin} to be pending review; it is "${product!.pricingReviewStatus}"`)
        .toBe('pending')

      const doc = validDoc([freshSgtin(gtin)])
      const { submitStatus, msg } = await submitAndPoll('manufacturer', doc)
      console.log(`[comm] pending-review commission -> ${submitStatus} ${describeMsgStatus(msg)}`)
      expect(msg.state,
        'commissioning a product with pricingReviewStatus=pending must be refused — '
        + describeMsgStatus(msg)).toBe('FAILED')
    },
  },
]

export const COMMISSION_CASES: ApiCase[] = [
  ...specialCases, ...mutationCases, ...securityCases, ...pricingGateCases,
]
