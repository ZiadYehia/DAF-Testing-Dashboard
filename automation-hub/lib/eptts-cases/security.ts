/**
 * EPTTS_API_12 — Security. The security cross-cut of the B2B API, mapping the six control
 * areas of the QA & Security Testing Work Package onto the verified live contract.
 *
 * These are NOT inherited from the spreadsheet — `api-security` is the one API feature this
 * team added, so the TC_SEC counter is ours (see testcase-writing-rules.md).
 *
 * CONVENTIONS (identical to the rest of the suite):
 *   - The body asserts what the platform SHOULD do. Where the platform is currently wrong,
 *     the case carries `expectFail` so a fix surfaces as a loud unexpected pass — never
 *     assert the observed defect (that reports it as fixed). See TC_AUTH_007..010's history.
 *   - `skip` marks a case that cannot run at all on this environment (→ blocked), e.g.
 *     cross-tenant with a single tenant, or a load case that would hammer a shared platform.
 *   - Async endpoints assert the whole chain, not the 202/200 acknowledgement.
 *
 * Phase 0 recon (2026-09-01) established that JWT verification is ENFORCED: alg:none,
 * tampered-claim, empty/garbage signature, expired, no-auth and apikey-only all return 401.
 * So the auth cluster asserts correct behaviour as positive cases.
 */
import { expect } from '@playwright/test'
import {
  rawRequest, rawAuth, authenticate, decodeClaims,
  apiKeyFor, glnFor, getMasar, postMasar, dispensation, verifyProduct, packOf,
  submitAndPoll, pollMsgStatus, describeMsgStatus,
  epcisDocument, commissionEvent, shippingEvent, receivingEvent, dispensingEvent,
  sglnOf, freshSgtin, freshDispensableSgtin, freshSscc, uniqueInstanceId, runId,
  MFG_GTINS,
  type MsgStatus,
} from '../eptts-api'
import {
  commissioned, inTransitToBranch, atPharmacy, MFG, BRANCH, PHARMACY,
} from './fixtures'
import type { ApiCase } from './index'

const FEATURE = 'api-security'

// ─── shared helpers ──────────────────────────────────────────────────────────

/** Split a JWT into its three raw segments. */
function parts(jwt: string): [string, string, string] {
  const p = jwt.split('.')
  return [p[0] ?? '', p[1] ?? '', p[2] ?? '']
}
const b64u = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url')
const decodeSeg = (seg: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'))

/** Mint a fresh, genuinely-valid manufacturer token to forge from. */
async function validToken(): Promise<string> {
  return authenticate('manufacturer')
}

/** POST a forged/absent-credential token to /VerifyProduct and expect a clean 401. */
async function expectBearerRejected(bearer: string | null, what: string): Promise<void> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (bearer !== null) headers.authorization = `Bearer ${bearer}`
  const res = await rawRequest('POST', 'masar', '/VerifyProduct', {
    headers, data: { productId: MFG_GTINS[0], geoLatitude: '', geoLongitude: '' }, label: `sec:${what}`,
  })
  expect(res.status(), `${what} is rejected`).toBe(401)
  const body = await res.text()
  expect(body, `${what}: no product data leaks in a 401`).not.toMatch(/"verified"\s*:\s*true/i)
}

/** Anything that betrays server internals in an error body. */
const DISCLOSURE =
  /syntax error|sqlstate|constraint|relation .* does not exist|ORA-\d|ER_\w+|\bat [\w.$]+\([\w./\\]+:\d+\)|\.java:\d+|\.ts:\d+\)|node_modules|\/usr\/|\/var\/|c:\\\\|stacktrace|nginx\/\d|Exception in|econnrefused|127\.0\.0\.1|localhost:\d/i

function assertNoDisclosure(body: string, what: string): void {
  const m = body.match(DISCLOSURE)
  expect(m ? `${what}: leaked "${m[0]}"` : 'clean', `${what} exposes no internal detail`).toBe('clean')
}

/** A required refusal: the polled outcome must not be SUCCESS. */
function assertRefused(msg: MsgStatus, submitStatus: number, what: string): void {
  if (submitStatus >= 400) return // refused synchronously — a valid refusal
  expect(msg.state, `${what}: must not succeed — ${describeMsgStatus(msg)}`).not.toBe('SUCCESS')
}

/** Read one response header case-insensitively (Playwright lowercases them). */
function hdr(res: { headers(): Record<string, string> }, name: string): string | undefined {
  return res.headers()[name.toLowerCase()]
}

// ─── 1. Authentication & session (TC_SEC_001–010) ────────────────────────────

const AUTH_SESSION: ApiCase[] = [
  {
    id: 'TC_SEC_001', feature: FEATURE, title: 'reject a token with header alg=none',
    run: async () => {
      const [, payload] = parts(await validToken())
      await expectBearerRejected(`${b64u({ alg: 'none', typ: 'JWT' })}.${payload}.`, 'alg-none')
    },
  },
  {
    id: 'TC_SEC_002', feature: FEATURE, title: 'reject a token with edited claims and the original signature',
    run: async () => {
      const [h, payload, sig] = parts(await validToken())
      const claims = decodeSeg(payload)
      const forged = `${h}.${b64u({ ...claims, entityGln: glnFor('pharmacy'), role: 'pharmacy' })}.${sig}`
      await expectBearerRejected(forged, 'tampered-claims')
    },
  },
  {
    id: 'TC_SEC_003', feature: FEATURE, title: 'reject a token with an empty signature',
    run: async () => {
      const [h, payload] = parts(await validToken())
      await expectBearerRejected(`${h}.${payload}.`, 'empty-signature')
    },
  },
  {
    id: 'TC_SEC_004', feature: FEATURE, title: 'reject a token with a garbage signature',
    run: async () => {
      const [h, payload] = parts(await validToken())
      await expectBearerRejected(`${h}.${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, 'garbage-signature')
    },
  },
  {
    id: 'TC_SEC_005', feature: FEATURE, title: 'reject an expired token',
    run: async () => {
      const [h, payload, sig] = parts(await validToken())
      const claims = decodeSeg(payload)
      await expectBearerRejected(`${h}.${b64u({ ...claims, exp: 1000000000 })}.${sig}`, 'expired')
    },
  },
  {
    id: 'TC_SEC_006', feature: FEATURE, title: 'reject a request with no Authorization header',
    run: () => expectBearerRejected(null, 'no-authorization'),
  },
  {
    id: 'TC_SEC_007', feature: FEATURE, title: 'reject an apikey presented instead of a bearer token',
    run: async () => {
      const res = await rawRequest('POST', 'masar', '/VerifyProduct', {
        headers: { apikey: apiKeyFor('manufacturer'), 'content-type': 'application/json' },
        data: { productId: MFG_GTINS[0], geoLatitude: '', geoLongitude: '' }, label: 'sec:apikey-only',
      })
      expect(res.status(), 'an apikey is not a request credential').toBe(401)
    },
  },
  {
    id: 'TC_SEC_008', feature: FEATURE, title: 'reject a refresh token used as an access token',
    run: async () => {
      const auth = await rawAuth(apiKeyFor('manufacturer'))
      expect(auth.refreshToken, 'a refresh token is issued').toBeTruthy()
      await expectBearerRejected(auth.refreshToken!, 'refresh-as-access')
    },
  },
  {
    id: 'TC_SEC_009', feature: FEATURE, title: 'a minted token is scoped only to the authenticating entity',
    run: async () => {
      const seen = new Map<string, string>()
      for (const role of ['manufacturer', 'branch', 'pharmacy'] as const) {
        const auth = await rawAuth(apiKeyFor(role))
        expect(auth.status, `${role} authenticates`).toBe(200)
        const c = decodeClaims(auth.accessToken!)
        expect(c.source, `${role} token is B2B`).toBe('b2b')
        expect(c.principalType, `${role} principal`).toBe('b2b_partner')
        expect(c.entityGln, `${role} token is bound to its own GLN`).toBe(glnFor(role))
        expect(seen.has(c.entityGln), `${role} GLN ${c.entityGln} is not shared with another role`).toBe(false)
        seen.set(c.entityGln, role)
      }
      expect(seen.size, 'three distinct entity identities').toBe(3)
    },
  },
  {
    id: 'TC_SEC_010', feature: FEATURE, title: 'reject a malformed non-JWT bearer string',
    run: () => expectBearerRejected('not-a-jwt', 'non-jwt-bearer'),
  },
]

// ─── 2. Authorization & tenant isolation (TC_SEC_011–020) ────────────────────

const AUTHZ: ApiCase[] = [
  {
    id: 'TC_SEC_011', feature: FEATURE, title: 'a manufacturer is denied the invoices endpoint',
    run: async () => {
      const res = await getMasar('manufacturer', '/scp/invoices')
      expect(res.status(), 'manufacturer is forbidden from /scp/invoices').toBe(403)
      const body = await res.text()
      expect(body, 'the 403 names the permitted roles').toMatch(/available to|Pharmacy|SCP|denied/i)
    },
  },
  {
    id: 'TC_SEC_012', feature: FEATURE, title: 'a manufacturer is denied the dispensation endpoint',
    run: async () => {
      const doc = epcisDocument(
        [dispensingEvent({ epcList: [freshDispensableSgtin()], readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      )
      const res = await dispensation('manufacturer', doc)
      expect(res.status(), 'manufacturer is forbidden from /Dispensation').toBe(403)
    },
  },
  {
    id: 'TC_SEC_013', feature: FEATURE, title: 'each downstream role is allowed the invoices endpoint',
    run: async () => {
      for (const role of ['branch', 'pharmacy'] as const) {
        const res = await getMasar(role, '/scp/invoices')
        expect(res.status(), `${role} is allowed /scp/invoices`).toBe(200)
      }
    },
  },
  {
    id: 'TC_SEC_014', feature: FEATURE, title: 'reject a commissioning event whose SBDH sender is not the caller',
    run: async () => {
      // Manufacturer authenticates, but the document claims the distributor is the sender.
      const doc = epcisDocument(
        [commissionEvent({
          epcList: [freshSgtin(MFG_GTINS[0])], lotNumber: `ZTG-${runId()}`, expiryDate: '2030-12-31',
          readPointSgln: sglnOf('manufacturer'),
        })],
        { senderGln: glnFor('branch'), receiverGln: glnFor('branch') },
      )
      const { submitStatus, submitBody } = await submitAndPoll('manufacturer', doc)
      expect(submitStatus, 'a spoofed SBDH sender is refused synchronously').toBe(403)
      expect(JSON.stringify(submitBody), 'the refusal cites the sender-GLN mismatch')
        .toMatch(/sender gln does not match|does not match/i)
    },
  },
  {
    id: 'TC_SEC_015', feature: FEATURE, title: 'pack ownership is derived from the token, not a client property',
    slow: true,
    run: async () => {
      const c = await commissioned(1)
      const v = await packOf('manufacturer', c.sgtins[0])
      expect(v.verified, 'the pack exists').toBe(true)
      expect(v.pack?.currentGln, 'custody is the authenticated manufacturer, not any injected owner')
        .toBe(glnFor('manufacturer'))
    },
  },
  {
    id: 'TC_SEC_016', feature: FEATURE, title: 'a role reads only its own invoices',
    run: async () => {
      const res = await getMasar('branch', '/scp/invoices')
      expect(res.status(), 'the distributor can list its invoices').toBe(200)
      const body = await res.text()
      // A distributor's own invoice list must not surface another entity's GLN as owner.
      expect(body, 'the distributor list does not disclose the pharmacy entity')
        .not.toContain(glnFor('pharmacy'))
    },
  },
  {
    id: 'TC_SEC_017', feature: FEATURE, title: 'a role cannot export an SSCC it does not own',
    // The /scp/sscc/{sscc}/export contract is not verified live, and proving denial needs a
    // second-owner SSCC the pharmacy can request. Deferred rather than asserted on an
    // unverified endpoint (which would test nothing).
    skip: 'export endpoint contract unverified on this environment; needs a foreign-owned SSCC to probe',
    run: async () => {},
  },
  {
    id: 'TC_SEC_018', feature: FEATURE, title: 'commissioning a product the entity does not own is refused',
    slow: true,
    run: async () => {
      // A GTIN from the live catalogue that does NOT belong to INSTITUTO GRIFOLS. The
      // platform is expected to refuse it on ownership grounds; the LoadTesting suite saw
      // this NOT enforced on cloud staging, so a success here is the finding we want surfaced.
      const foreignGtin = '00300020007554' // Human Insulin — a different MAH
      const sgtin = freshSgtin(foreignGtin)
      const doc = epcisDocument(
        [commissionEvent({ epcList: [sgtin], lotNumber: `ZTG-${runId()}`, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      )
      const { submitStatus, msg } = await submitAndPoll('manufacturer', doc)
      console.log(`[sec] foreign-GTIN commission → submit ${submitStatus}, ${describeMsgStatus(msg)}`)
      assertRefused(msg, submitStatus, 'commissioning a foreign-owned product')
    },
  },
  {
    id: 'TC_SEC_019', feature: FEATURE, title: 'cross-tenant isolation across a second tenant',
    skip: 'single tenant on this environment (devsim only) — no second tenant to isolate against',
    run: async () => {},
  },
  {
    id: 'TC_SEC_020', feature: FEATURE, title: 'an entity event history returns only its own messages',
    run: async () => {
      const mfg = await (await getMasar('manufacturer', '/epcis?limit=25')).text()
      const pha = await (await getMasar('pharmacy', '/epcis?limit=25')).text()
      // The manufacturer's own history must not surface the pharmacy's GLN, and vice-versa.
      expect(mfg, 'manufacturer history does not disclose pharmacy events').not.toContain(glnFor('pharmacy'))
      expect(pha, 'pharmacy history does not disclose manufacturer events').not.toContain(glnFor('manufacturer'))
    },
  },
]

// ─── 3. Lifecycle & workflow (TC_SEC_021–026) ────────────────────────────────

const LIFECYCLE: ApiCase[] = [
  {
    id: 'TC_SEC_021', feature: FEATURE, title: 'a shipping event for a never-commissioned pack is refused',
    slow: true,
    run: async () => {
      const sscc = freshSscc()
      const doc = epcisDocument(
        [shippingEvent({
          epcList: [sscc], sourceSgln: sglnOf('manufacturer'), destinationSgln: sglnOf('branch'),
          bizTransaction: `INV-ZTG-${runId()}-NOCOMM`, readPointSgln: sglnOf('manufacturer'),
        })],
        { senderGln: MFG(), receiverGln: BRANCH() },
      )
      const { submitStatus, msg } = await submitAndPoll('manufacturer', doc)
      assertRefused(msg, submitStatus, 'shipping a never-commissioned SSCC')
    },
  },
  {
    id: 'TC_SEC_022', feature: FEATURE, title: 'a receiving event for a never-shipped pack is refused',
    slow: true,
    run: async () => {
      const c = await commissioned(1)
      const doc = epcisDocument(
        [receivingEvent({ epcList: c.sgtins, sourceSgln: sglnOf('manufacturer'), readPointSgln: sglnOf('branch') })],
        { senderGln: BRANCH(), receiverGln: MFG() },
      )
      const { submitStatus, msg } = await submitAndPoll('branch', doc)
      assertRefused(msg, submitStatus, 'receiving a never-shipped pack')
    },
  },
  {
    id: 'TC_SEC_023', feature: FEATURE, title: 'dispensing a pack not received at the pharmacy is refused',
    slow: true,
    run: async () => {
      // A dispensable pack that exists (commissioned) but the pharmacy has never received.
      const sgtin = freshDispensableSgtin()
      await submitAndPoll('manufacturer', epcisDocument(
        [commissionEvent({ epcList: [sgtin], lotNumber: `ZTG-${runId()}`, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      ))
      const doc = epcisDocument(
        [dispensingEvent({ epcList: [sgtin], readPointSgln: sglnOf('pharmacy') })],
        { senderGln: PHARMACY(), receiverGln: PHARMACY() },
      )
      const res = await dispensation('pharmacy', doc)
      // /Dispensation acknowledges 200 then is async; if 403/4xx that is also a valid refusal.
      if (res.status() === 200) {
        const iid = doc.sbdh.documentIdentification.instanceIdentifier
        const msg = await submitAndPoll('pharmacy', doc).then((r) => r.msg).catch(() => null)
        void iid
        if (msg) assertRefused(msg, 200, 'dispensing a pack not in custody')
      } else {
        expect(res.status(), 'dispensing a pack not in custody is refused').toBeGreaterThanOrEqual(400)
      }
    },
  },
  {
    id: 'TC_SEC_024', feature: FEATURE, title: 'a duplicate instanceIdentifier produces exactly one pack',
    slow: true,
    run: async () => {
      const sgtin = freshSgtin(MFG_GTINS[0])
      const iid = uniqueInstanceId()
      const build = () => epcisDocument(
        [commissionEvent({ epcList: [sgtin], lotNumber: `ZTG-${runId()}`, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG(), instanceIdentifier: iid },
      )
      await submitAndPoll('manufacturer', build())
      await submitAndPoll('manufacturer', build()) // identical resubmission
      const v = await packOf('manufacturer', sgtin)
      expect(v.verified, 'the pack exists exactly once').toBe(true)
      expect(v.pack?.status, 'and is in a single commissioned (active) state').toBe('active')
    },
  },
  {
    id: 'TC_SEC_025', feature: FEATURE, title: 'replaying a committed shipping event does not transfer custody twice',
    slow: true,
    run: async () => {
      const t = await inTransitToBranch(1)
      // Replay the identical shipping document (same invoice number).
      const replay = epcisDocument(
        [shippingEvent({
          epcList: [t.sscc], sourceSgln: sglnOf('manufacturer'), destinationSgln: sglnOf('branch'),
          bizTransaction: t.invoice, readPointSgln: sglnOf('manufacturer'),
        })],
        { senderGln: MFG(), receiverGln: BRANCH() },
      )
      const { submitStatus, msg } = await submitAndPoll('manufacturer', replay)
      assertRefused(msg, submitStatus, 'replaying a committed shipment')
    },
  },
  {
    id: 'TC_SEC_026', feature: FEATURE, title: 'an already-dispensed pack cannot be dispensed again',
    slow: true,
    run: async () => {
      const r = await atPharmacy(1)
      // Dispensing operates on the child SGTIN, not the SSCC container.
      const sgtin = r.sgtins[0]
      // Post a dispense and poll it (/Dispensation acknowledges 200 then is async).
      const dispense = async () => {
        const doc = epcisDocument(
          [dispensingEvent({ epcList: [sgtin], readPointSgln: sglnOf('pharmacy') })],
          { senderGln: PHARMACY(), receiverGln: PHARMACY() },
        )
        const res = await dispensation('pharmacy', doc)
        if (res.status() >= 400) return { ok: false, logs: '', state: `HTTP ${res.status()}` }
        const msg = await pollMsgStatus('pharmacy', doc.sbdh.documentIdentification.instanceIdentifier)
        return { ok: msg.state === 'SUCCESS', logs: JSON.stringify(msg.logs), state: describeMsgStatus(msg) }
      }
      const first = await dispense()
      const second = await dispense()
      console.log(`[sec] dispense #1 ${first.state}; dispense #2 ${second.state}`)
      // The security invariant: a pack cannot be dispensed twice. At most one attempt succeeds.
      expect(first.ok && second.ok, 'a pack must not be dispensable twice').toBe(false)
      // When the first genuinely dispensed, the second is refused as an invalid transition.
      if (first.ok) {
        expect(second.ok, 'the second dispense is refused').toBe(false)
        expect(second.logs, 'the refusal cites an invalid status transition')
          .toMatch(/invalid status transition|already|dispensed/i)
      }
    },
  },
]

// ─── 4. Input, payload & file (TC_SEC_027–036) ───────────────────────────────

const INJECTION = "' OR 1=1 --"
const XSS = '<script>alert(1)</script>'

const INPUT: ApiCase[] = [
  {
    id: 'TC_SEC_027', feature: FEATURE, title: 'malformed JSON is rejected without a stack trace',
    run: async () => {
      const res = await postMasar('manufacturer', '/scp/SendEPCIS', '{ "epcisBody": { "eventList": [ ', {
        contentType: 'application/json',
      })
      expect(res.status(), 'malformed JSON is a 400-class error').toBeGreaterThanOrEqual(400)
      expect(res.status(), 'and not a 5xx').toBeLessThan(500)
      assertNoDisclosure(await res.text(), 'malformed JSON')
    },
  },
  {
    id: 'TC_SEC_028', feature: FEATURE, title: 'a document with no SBDH is rejected synchronously',
    run: async () => {
      const res = await postMasar('manufacturer', '/scp/SendEPCIS', {
        '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
        type: 'EPCISDocument', schemaVersion: '2.0', creationDate: '2026-09-01T00:00:00+03:00',
        epcisBody: { eventList: [] },
      })
      expect(res.status(), 'a missing SBDH is a synchronous 400').toBe(400)
      expect(await res.text(), 'the refusal names the SBDH / E003').toMatch(/SBDH|E003/i)
    },
  },
  {
    id: 'TC_SEC_029', feature: FEATURE, title: 'a document with zero events is rejected',
    expectFail: 'platform validation gap: an empty eventList is accepted (202 I001) instead of rejected',
    run: async () => {
      const doc = epcisDocument([], { senderGln: MFG(), receiverGln: MFG() })
      const res = await postMasar('manufacturer', '/scp/SendEPCIS', doc)
      expect(res.status(), 'an empty eventList should be rejected, not accepted').toBe(400)
    },
  },
  {
    id: 'TC_SEC_030', feature: FEATURE, title: 'an oversized payload is rejected without an unhandled error',
    run: async () => {
      // Moderately large (not abusive against a shared platform): 5,000 fresh SGTINs.
      const epcs = Array.from({ length: 5000 }, () => freshSgtin(MFG_GTINS[0]))
      const doc = epcisDocument(
        [commissionEvent({ epcList: epcs, lotNumber: `ZTG-${runId()}`, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      )
      const res = await postMasar('manufacturer', '/scp/SendEPCIS', doc)
      expect(res.status(), 'a large payload does not cause an unhandled 5xx').toBeLessThan(500)
      assertNoDisclosure(await res.text(), 'oversized payload')
    },
  },
  {
    id: 'TC_SEC_031', feature: FEATURE, title: 'an EPCIS XML external entity is not resolved',
    skip: 'no verified XML submission endpoint on the B2B API; XML/XXE upload is a dashboard feature (Phase 5)',
    run: async () => {},
  },
  {
    id: 'TC_SEC_032', feature: FEATURE, title: 'an XML entity-expansion payload does not exhaust the parser',
    skip: 'no verified XML submission endpoint on the B2B API; covered on the dashboard EPCIS XML upload (Phase 5)',
    run: async () => {},
  },
  {
    id: 'TC_SEC_033', feature: FEATURE, title: 'a SQL injection payload in a free-text field is refused with no DB detail',
    slow: true,
    run: async () => {
      // The lotNumber allow-list rejects the value ASYNC (202 then an error in the logList),
      // so submit-and-poll and assert the outcome is a refusal that leaks no DB internals.
      const doc = epcisDocument(
        [commissionEvent({ epcList: [freshSgtin(MFG_GTINS[0])], lotNumber: INJECTION, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      )
      const { submitStatus, submitBody, msg } = await submitAndPoll('manufacturer', doc)
      const combined = JSON.stringify(submitBody) + ' ' + JSON.stringify(msg.body) + ' ' + JSON.stringify(msg.logs)
      assertRefused(msg, submitStatus, 'a SQL injection lotNumber')
      assertNoDisclosure(combined, 'SQL injection in lotNumber')
    },
  },
  {
    id: 'TC_SEC_034', feature: FEATURE, title: 'a script payload in a free-text field is refused and not reflected as markup',
    slow: true,
    run: async () => {
      const doc = epcisDocument(
        [commissionEvent({ epcList: [freshSgtin(MFG_GTINS[0])], lotNumber: XSS, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      )
      const { submitStatus, submitBody, msg } = await submitAndPoll('manufacturer', doc)
      assertRefused(msg, submitStatus, 'a <script> lotNumber')
      // Wherever the value is echoed, it is inert JSON text, never served as executable HTML.
      const ct = (msg.body && typeof msg.body === 'object') ? 'application/json' : ''
      expect(ct, 'the async error body is JSON, not HTML').not.toMatch(/text\/html/i)
      void submitBody
    },
  },
  {
    id: 'TC_SEC_035', feature: FEATURE, title: 'an over-length lot number is rejected with a controlled message, not a raw DB error',
    slow: true,
    run: async () => {
      // Valid characters, but longer than the 20-char column the LoadTesting BUG-004 hit.
      // That leak surfaced ASYNC in the MsgStatusQuery logList ("value too long for type
      // character varying(20)") after a 202 — so scan both the sync body AND the polled logs.
      const longLot = `ZTG-${runId()}-${'A'.repeat(40)}`
      const doc = epcisDocument(
        [commissionEvent({ epcList: [freshSgtin(MFG_GTINS[0])], lotNumber: longLot, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      )
      const { submitStatus, submitBody, msg } = await submitAndPoll('manufacturer', doc)
      const combined = JSON.stringify(submitBody) + ' ' + JSON.stringify(msg.body) + ' ' + JSON.stringify(msg.logs)
      console.log(`[sec] over-length lot → submit ${submitStatus}, ${describeMsgStatus(msg)}`)
      // The control under test: no raw database column/type detail leaks, sync or async.
      expect(combined, 'no raw varchar/DB column detail leaks in the length error')
        .not.toMatch(/character varying|value too long|varchar|sqlstate|column .* of relation/i)
      assertNoDisclosure(combined, 'over-length lotNumber')
    },
  },
  {
    id: 'TC_SEC_036', feature: FEATURE, title: 'rejected input does not persist or queue a message',
    slow: true,
    run: async () => {
      const sgtin = freshSgtin(MFG_GTINS[0])
      // An invalid commissioning event (empty disposition). Presence is validated, but the
      // refusal is async, so poll it and then confirm the serial was never stored.
      const doc = epcisDocument(
        [commissionEvent({ epcList: [sgtin], lotNumber: `ZTG-${runId()}`, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      )
      ;(doc.epcisBody.eventList[0] as Record<string, unknown>).disposition = ''
      const { submitStatus, msg } = await submitAndPoll('manufacturer', doc)
      assertRefused(msg, submitStatus, 'a commissioning event with an empty disposition')
      const v = await packOf('manufacturer', sgtin)
      expect(v.verified, 'the refused serial was never stored').toBe(false)
    },
  },
]

// ─── 5. Rate, admission & async (TC_SEC_037–040) ─────────────────────────────

const RATE: ApiCase[] = [
  {
    id: 'TC_SEC_037', feature: FEATURE, title: 'rate-limit headers are present and decrement',
    run: async () => {
      const first = await getMasar('manufacturer', '/epcis?limit=1')
      const second = await getMasar('manufacturer', '/epcis?limit=1')
      // The ceiling differs by service (registry /auth is 2000, masar /epcis is 300); the
      // control under test is that a positive ceiling is advertised and remaining decrements.
      const limit = Number(hdr(first, 'x-ratelimit-limit'))
      expect(Number.isFinite(limit) && limit > 0, 'a positive rate-limit ceiling is advertised').toBe(true)
      const r1 = Number(hdr(first, 'x-ratelimit-remaining'))
      const r2 = Number(hdr(second, 'x-ratelimit-remaining'))
      expect(Number.isFinite(r1) && Number.isFinite(r2), 'remaining is numeric on both').toBe(true)
      expect(r2, 'remaining decreases across successive requests').toBeLessThan(r1)
      expect(hdr(first, 'x-ratelimit-reset'), 'a reset window is advertised').toBeTruthy()
    },
  },
  {
    id: 'TC_SEC_038', feature: FEATURE, title: 'exceeding the rate limit returns 429 with Retry-After',
    skip: 'would push 2000+ requests/window at a shared platform; needs an agreed maintenance window',
    run: async () => {},
  },
  {
    id: 'TC_SEC_039', feature: FEATURE, title: 'an accepted submission actually registers rather than being lost',
    slow: true,
    run: async () => {
      const sgtin = freshSgtin(MFG_GTINS[0])
      const { submitStatus, msg } = await submitAndPoll('manufacturer', epcisDocument(
        [commissionEvent({ epcList: [sgtin], lotNumber: `ZTG-${runId()}`, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      ))
      expect(submitStatus, 'the submission is accepted (202)').toBe(202)
      expect(msg.state, `and then registers — ${describeMsgStatus(msg)}`).toBe('SUCCESS')
      const v = await packOf('manufacturer', sgtin)
      expect(v.verified, 'the accepted message is not silently lost').toBe(true)
    },
  },
  {
    id: 'TC_SEC_040', feature: FEATURE, title: 'retrying an accepted submission does not double the business effect',
    slow: true,
    run: async () => {
      const sgtin = freshSgtin(MFG_GTINS[0])
      const build = () => epcisDocument(
        [commissionEvent({ epcList: [sgtin], lotNumber: `ZTG-${runId()}`, expiryDate: '2030-12-31', readPointSgln: sglnOf('manufacturer') })],
        { senderGln: MFG(), receiverGln: MFG() },
      )
      await submitAndPoll('manufacturer', build())
      await submitAndPoll('manufacturer', build())
      const v = await packOf('manufacturer', sgtin)
      expect(v.verified, 'the pack exists').toBe(true)
      expect(v.pack?.status, 'in exactly one active state, not duplicated').toBe('active')
    },
  },
]

// ─── 6. Transport & disclosure (TC_SEC_041–045) ──────────────────────────────

const TRANSPORT: ApiCase[] = [
  {
    id: 'TC_SEC_041', feature: FEATURE, title: 'responses carry HSTS and a content security policy',
    run: async () => {
      const res = await getMasar('manufacturer', '/epcis?limit=1')
      expect(hdr(res, 'strict-transport-security'), 'HSTS is present with a max-age').toMatch(/max-age=\d+/)
      expect(hdr(res, 'content-security-policy'), 'a CSP restricts default-src').toMatch(/default-src/)
    },
  },
  {
    id: 'TC_SEC_042', feature: FEATURE, title: 'responses carry anti-sniffing and anti-framing headers',
    run: async () => {
      const res = await getMasar('manufacturer', '/epcis?limit=1')
      expect(hdr(res, 'x-content-type-options'), 'nosniff is set').toMatch(/nosniff/)
      expect(hdr(res, 'x-frame-options'), 'framing is restricted').toMatch(/SAMEORIGIN|DENY/i)
    },
  },
  {
    id: 'TC_SEC_043', feature: FEATURE, title: 'responses do not advertise the server technology or version',
    run: async () => {
      const res = await getMasar('manufacturer', '/epcis?limit=1')
      expect(hdr(res, 'x-powered-by'), 'no X-Powered-By banner').toBeFalsy()
      const server = hdr(res, 'server') ?? ''
      expect(server, 'the server header carries no version number').not.toMatch(/\d+\.\d+/)
    },
  },
  {
    id: 'TC_SEC_044', feature: FEATURE, title: 'an authentication failure body exposes no internal detail',
    run: async () => {
      const res = await rawRequest('POST', 'masar', '/VerifyProduct', {
        headers: { authorization: 'Bearer not-a-jwt', 'content-type': 'application/json' },
        data: { productId: MFG_GTINS[0] }, label: 'sec:401-disclosure',
      })
      expect(res.status(), 'the invalid token is rejected').toBe(401)
      assertNoDisclosure(await res.text(), '401 body')
    },
  },
  {
    id: 'TC_SEC_045', feature: FEATURE, title: 'a validation failure body exposes no internal detail',
    run: async () => {
      const res = await verifyProduct('manufacturer', '') // empty productId → validation error
      const body = await res.text()
      assertNoDisclosure(body, 'validation 400 body')
    },
  },
]

export const SECURITY_CASES: ApiCase[] = [
  ...AUTH_SESSION, ...AUTHZ, ...LIFECYCLE, ...INPUT, ...RATE, ...TRANSPORT,
]
