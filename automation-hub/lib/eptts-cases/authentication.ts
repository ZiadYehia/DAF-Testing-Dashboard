/**
 * EPTTS_API_01 — Authentication. All 13 spreadsheet cases, one per Hub project.
 *
 * CONTRACT (verified against production 2026-08-31):
 *   POST :8445/registry-service/api/v1/auth   header: apikey: <64-char key>
 *
 *   1. A valid `apikey` is MANDATORY — no credential pair can substitute, so the body can
 *      only ever narrow access, never widen it.
 *   2. The optional username/password body is validated ONLY when BOTH fields are present
 *      and non-empty; a wrong pair is then 401.
 *   3. If either field is empty, null or absent, the credential check is SKIPPED and the
 *      key alone authenticates. TC_AUTH_007..010 expected 400 here — filed as a bug.
 *   4. The devsim dashboard logins are refused by this endpoint, so the dashboard
 *      (Keycloak) and B2B credential stores are separate.
 */
import { expect } from '@playwright/test'
import {
  rawAuth, decodeClaims, apiKeyFor, glnFor, platformRoleFor,
  getMasar, registryBase,
  type Role,
} from '../eptts-api'
import type { ApiCase } from './index'

const FEATURE = 'api-authentication'
const BAD_KEY = '0'.repeat(64)

/** Assert a role's key mints a token correctly scoped to that role's entity. */
async function assertRoleAuthenticates(role: Role): Promise<void> {
  const res = await rawAuth(apiKeyFor(role))

  expect(res.status, 'HTTP 200 OK').toBe(200)
  expect(res.accessToken, 'an access token is returned').toBeTruthy()
  expect(res.tokenType, 'token_type is Bearer').toBe('Bearer')
  expect(res.expiresIn, 'the token lasts 900 s').toBe(900)
  expect(res.refreshToken, 'a refresh token is issued').toBeTruthy()

  // A key that authenticates but returns another tenant's identity would be a serious
  // isolation defect, so assert the binding rather than just the 200.
  const claims = decodeClaims(res.accessToken!)
  expect(claims.role, 'token role').toBe(platformRoleFor(role))
  expect(claims.entityGln, 'token is bound to this entity GLN').toBe(glnFor(role))
  expect(claims.source, 'issued through the B2B path').toBe('b2b')
  expect(claims.principalType, 'principal is a B2B partner').toBe('b2b_partner')
  expect(claims.entityId, 'entity id present').toBeTruthy()
  expect(claims.jti, 'token has a unique id').toBeTruthy()
}

/** Assert a bad/absent key is refused and no token is issued. */
async function assertRejected(apikey: string | null, what: string, body?: unknown): Promise<void> {
  const res = await rawAuth(apikey, body)
  expect(res.status, `${what} is rejected`).toBe(401)
  expect(res.accessToken, 'no token is issued').toBeNull()
}

/**
 * The four partial-credential cases share one body and one finding: the platform skips
 * the credential check instead of rejecting, and answers 200.
 */
/**
 * A partially-supplied credential SHOULD be rejected. It is not — hence the `expectFail`
 * marker on the four cases that use this.
 *
 * WHY THIS ASSERTS THE CORRECT BEHAVIOUR RATHER THAN THE OBSERVED ONE
 *
 * This function previously asserted `toBe(200)` — the platform's real, defective answer —
 * while the cases were ALSO marked `expectFail`. Those two things contradict each other: the
 * body passed, so Playwright reported "expected to fail but passed", and the results recorder
 * read that as "the gap has been fixed, remove the marker". It had not been fixed. Four
 * genuine defects were being reported as resolved.
 *
 * The convention, applied consistently across this suite: **the body asserts what the
 * platform SHOULD do, and `expectFail` records that it currently does not.** A case then
 * lands as `fail` with the gap named while the defect exists, and flips to an unexpected
 * pass — a loud "remove the marker" — the moment it is fixed. Asserting observed behaviour
 * instead makes a defect indistinguishable from correct behaviour.
 *
 * The real response is logged either way, so the evidence is in the run artifacts.
 */
async function assertPartialCredentialRejected(body: Record<string, unknown>, what: string): Promise<void> {
  const res = await rawAuth(apiKeyFor('manufacturer'), body)

  if (res.status === 200 && res.accessToken) {
    // Record the shape of the gap: a token IS issued, but it is still scoped to the key's
    // owner. So this is a validation gap, not an authorization hole — worth stating plainly
    // because the two have very different severities.
    const claims = decodeClaims(res.accessToken)
    console.log(
      `[auth] ${what}: credential check SKIPPED — 200 with a token scoped to ` +
      `entityGln=${claims.entityGln} (expected ${glnFor('manufacturer')}). ` +
      'A validation gap, not an authorization bypass.')
  }

  expect(res.status, `${what}: a half-supplied credential should be rejected, not ignored`).toBe(400)
}

const PARTIAL_GAP =
  'platform validation gap: a partially-supplied credential is ignored rather than rejected ' +
  '(the spreadsheet expected 400, the platform returns 200)'

export const AUTH_CASES: ApiCase[] = [
  {
    id: 'TC_AUTH_001', feature: FEATURE,
    title: 'authenticate with a valid Manufacturer API key',
    run: () => assertRoleAuthenticates('manufacturer'),
  },
  {
    id: 'TC_AUTH_002', feature: FEATURE,
    // The sheet says "Branch"; the platform models branches under the distributor role.
    title: 'authenticate with a valid Branch (distributor role) API key',
    run: () => assertRoleAuthenticates('branch'),
  },
  {
    id: 'TC_AUTH_003', feature: FEATURE,
    title: 'authenticate with a valid Pharmacy API key',
    run: () => assertRoleAuthenticates('pharmacy'),
  },
  {
    id: 'TC_AUTH_004', feature: FEATURE,
    title: 'reject an invalid API key',
    run: async () => {
      await assertRejected(BAD_KEY, 'a well-formed but unknown key')
      await assertRejected('not-a-real-key', 'a malformed key')
    },
  },
  {
    id: 'TC_AUTH_005', feature: FEATURE,
    title: 'reject a request with no apikey header at all',
    // The sheet allowed "400/401"; live behaviour is 401.
    run: () => assertRejected(null, 'no apikey header'),
  },
  {
    id: 'TC_AUTH_006', feature: FEATURE,
    title: 'valid API key with invalid credentials is rejected',
    run: async () => {
      // Testable exactly as the sheet wrote it: the credential path is still live when
      // both fields are supplied, and a wrong pair is refused despite a valid key.
      const res = await rawAuth(apiKeyFor('manufacturer'), {
        username: 'not-a-real-user@example.invalid',
        password: 'definitely-wrong',
      })
      expect(res.status, 'HTTP 401 for a wrong credential pair').toBe(401)
      expect(res.accessToken, 'no token is issued').toBeNull()
      expect(JSON.stringify(res.body), 'reported as a credential problem').toMatch(/credential|unauthor/i)
    },
  },
  {
    id: 'TC_AUTH_007', feature: FEATURE,
    title: 'an empty username is rejected rather than ignored',
    expectFail: PARTIAL_GAP,
    run: () => assertPartialCredentialRejected({ username: '', password: 'anything' }, 'an empty username'),
  },
  {
    id: 'TC_AUTH_008', feature: FEATURE,
    title: 'an empty password is rejected rather than ignored',
    expectFail: PARTIAL_GAP,
    run: () => assertPartialCredentialRejected(
      { username: 'someone@example.invalid', password: '' }, 'an empty password'),
  },
  {
    id: 'TC_AUTH_009', feature: FEATURE,
    title: 'a missing username field is rejected rather than ignored',
    expectFail: PARTIAL_GAP,
    run: () => assertPartialCredentialRejected({ password: 'anything' }, 'no username field'),
  },
  {
    id: 'TC_AUTH_010', feature: FEATURE,
    title: 'a missing password field is rejected rather than ignored',
    expectFail: PARTIAL_GAP,
    run: () => assertPartialCredentialRejected(
      { username: 'someone@example.invalid' }, 'no password field'),
  },
  {
    id: 'TC_AUTH_011', feature: FEATURE,
    title: 'a rotated (superseded) API key no longer authenticates',
    // Keys cannot be expired on demand. Rotation supersedes one, and a superseded key
    // must stop working — but proving that means rotating a live key, which invalidates
    // whatever is currently using it. Not something to do inside a test run.
    //
    // Gathered manually during recon on 2026-08-31: rotating the three devsim keys
    // immediately superseded the previous ones. To automate, create a throwaway entity,
    // issue its first key, rotate it, and assert the old key returns 401.
    skip: 'needs a disposable entity: rotating a real key to prove it dies is destructive',
    run: async () => { /* unreachable while skipped */ },
  },
  {
    id: 'TC_AUTH_012', feature: FEATURE,
    title: 'dashboard credentials do not authenticate against the B2B API',
    run: async () => {
      // The original changed the dashboard password then re-authenticated here. That
      // premise does not hold: the dashboard (Keycloak OIDC) and the B2B credential store
      // are separate, and the devsim dashboard logins are refused by this endpoint. That
      // independence is the real property to assert.
      const res = await rawAuth(apiKeyFor('manufacturer'), {
        username: process.env.EPTTS_WEB_MFG_USERNAME ?? 'manufacturer@devsim.local',
        password: process.env.EPTTS_WEB_MFG_PASSWORD ?? '',
      })
      expect(res.status, 'dashboard credentials are not valid B2B credentials').toBe(401)

      // …while the same key with no credential body authenticates fine, proving the
      // dashboard password is irrelevant to B2B auth.
      const keyOnly = await rawAuth(apiKeyFor('manufacturer'))
      expect(keyOnly.status, 'the key alone still works').toBe(200)
      const claims = decodeClaims(keyOnly.accessToken!)
      expect(claims.source, 'B2B tokens never come from the dashboard realm').toBe('b2b')
      expect(JSON.stringify(claims), 'no Keycloak issuer on a B2B token').not.toContain('realms/masar')
    },
  },
  {
    id: 'TC_AUTH_013', feature: FEATURE,
    title: 'a dashboard username is not a valid apikey',
    run: () => assertRejected('admin@devsim.local', 'a username in the apikey header'),
  },
]

/**
 * Contract guards — not spreadsheet cases, so they are NOT registered as per-case
 * projects. They pin down facts the other ten features depend on and live in
 * `eptts-api-smoke`, where a failure points at the contract rather than at one case.
 */
export async function authContractGuards(): Promise<void> {
  // /auth lives on registry-service, not masar-service (the collection's URL is a 404).
  expect(registryBase(), 'registry base is the :8445 service').toContain('registry-service')
  const good = await rawAuth(apiKeyFor('manufacturer'))
  expect(good.status, 'the registry-service path works').toBe(200)

  // The apikey header is not required after /auth.
  const epcis = await getMasar('manufacturer', '/epcis?limit=1')
  expect(epcis.status(), 'Bearer alone is sufficient').toBe(200)

  // A credential pair cannot substitute for a valid key.
  const badKey = await rawAuth(BAD_KEY, {
    username: process.env.EPTTS_WEB_MFG_USERNAME ?? 'manufacturer@devsim.local',
    password: process.env.EPTTS_WEB_MFG_PASSWORD ?? '',
  })
  expect(badKey.status, 'bad key + credentials is still refused').toBe(401)

  // Each role gets a distinctly scoped token.
  const seen = new Set<string>()
  for (const role of ['manufacturer', 'branch', 'pharmacy'] as Role[]) {
    const res = await rawAuth(apiKeyFor(role))
    expect(res.status, `${role} authenticates`).toBe(200)
    const c = decodeClaims(res.accessToken!)
    expect(seen.has(c.entityGln), `${role} GLN ${c.entityGln} is not shared`).toBe(false)
    seen.add(c.entityGln)
  }
  expect(seen.size, 'three distinct entities').toBe(3)
}
