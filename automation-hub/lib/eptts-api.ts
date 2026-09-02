/**
 * EPTTS / Masar B2B API — shared test helper.
 *
 * The single place the API contract lives, so the eleven `eptts-api-*` projects stay
 * thin. Everything here was verified against production on 2026-08-31; see
 * data/eptts-api/modules/eptts-apis/knowledge/verified-live-contract.md for the
 * evidence behind each decision. Where the Postman collection or the source
 * spreadsheet disagree with this file, this file is right.
 *
 * Three facts drive the whole design:
 *
 *  1. `apikey` is a credential used ONCE, at POST :8445/registry-service/api/v1/auth,
 *     to mint a 15-minute bearer token. Every other endpoint authenticates with
 *     `Authorization: Bearer` alone — `apikey` on those calls is ignored. A valid key
 *     is mandatory; the optional username/password body can only narrow access.
 *  2. Most writes are fire-and-poll: 202 -> MsgStatusQuery -> SUCCESS. A test that
 *     stops at the 202 has verified almost nothing.
 *  3. MsgStatusQuery answers 404 (not 200) while a submission is still initializing,
 *     so 404 means "retry", not "failed".
 *
 * No browser is involved: these are pure APIRequestContext calls.
 */
import { request as pwRequest, type APIRequestContext, type APIResponse } from '@playwright/test'
import { requireEnv } from './env'
import { recordExchange } from './eptts-api-log'

// ─── roles ───────────────────────────────────────────────────────────────────

/**
 * The three trade-partner identities the suite acts as.
 *
 * `branch` maps to the platform's `distributor` role: the devsim tenant has zero
 * `branch`-role users, even though `branch` exists as an entity type. Test cases
 * written as "Authenticated as Branch" belong here.
 */
export type Role =
  | 'manufacturer' | 'branch' | 'pharmacy'
  // Second, independent entity of each role — the "EF" set. Distinct GLNs and entityIds
  // from the primaries, so they are the genuine foreign parties horizontal-isolation and
  // cross-entity ownership (OWASP API1 BOLA / API5 BFLA) cases need. Added 2026-09-02 when
  // the second accounts were provisioned; used by the api-security feature.
  | 'ef_manufacturer' | 'ef_distributor' | 'ef_pharmacy'

/** The three primary trade-partner identities — the supply-chain suites act only as these. */
export type PrimaryRole = 'manufacturer' | 'branch' | 'pharmacy'

interface RoleConfig {
  apiKeyEnv: string
  glnEnv: string
  /** The role string the platform puts in the B2B token, for assertions. */
  platformRole: string
}

const ROLES: Record<Role, RoleConfig> = {
  manufacturer: { apiKeyEnv: 'EPTTS_MFG_APIKEY', glnEnv: 'EPTTS_MFG_GLN', platformRole: 'manufacturer' },
  branch: { apiKeyEnv: 'EPTTS_BRANCH_APIKEY', glnEnv: 'EPTTS_BRANCH_GLN', platformRole: 'distributor' },
  pharmacy: { apiKeyEnv: 'EPTTS_PHARMACY_APIKEY', glnEnv: 'EPTTS_PHARMACY_GLN', platformRole: 'pharmacy' },
  ef_manufacturer: { apiKeyEnv: 'EPTTS_EF_MAH_APIKEY', glnEnv: 'EPTTS_EF_MAH_GLN', platformRole: 'manufacturer' },
  ef_distributor: { apiKeyEnv: 'EPTTS_EF_DISTRIBUTOR_APIKEY', glnEnv: 'EPTTS_EF_DISTRIBUTOR_GLN', platformRole: 'distributor' },
  ef_pharmacy: { apiKeyEnv: 'EPTTS_EF_PHARMACY_APIKEY', glnEnv: 'EPTTS_EF_PHARMACY_GLN', platformRole: 'pharmacy' },
}

export function apiKeyFor(role: Role): string {
  return requireEnv(ROLES[role].apiKeyEnv)
}
export function glnFor(role: Role): string {
  return requireEnv(ROLES[role].glnEnv)
}
export function platformRoleFor(role: Role): string {
  return ROLES[role].platformRole
}

/** masar-service base, e.g. https://192.168.225.195:8444/masar-service/api/v1 */
export function masarBase(): string {
  return requireEnv('EPTTS_MASAR_API_URL').replace(/\/$/, '')
}
/** registry-service base, e.g. https://192.168.225.195:8445/registry-service/api/v1 */
export function registryBase(): string {
  return requireEnv('EPTTS_REGISTRY_API_URL').replace(/\/$/, '')
}

// ─── contexts ────────────────────────────────────────────────────────────────
//
// ignoreHTTPSErrors is mandatory: the production host serves a self-signed cert.
//
// Deliberately NO baseURL. Playwright resolves a request path against baseURL with
// `new URL(path, baseURL)` semantics, where a leading-slash path REPLACES the whole
// base path — so baseURL ".../registry-service/api/v1" + "/auth" would hit
// "https://host/auth" and return 405 from nginx. Absolute URLs are unambiguous.

const CTX_KEY = 'shared'
const contexts = new Map<string, APIRequestContext>()

/**
 * NOTE ON SECRETS IN ARTIFACTS: Playwright's call log records request headers, so a
 * failed `/auth` call prints the raw `apikey` into stdout and into trace.zip. Both
 * `test-results/` and each project's `runs/` folder are gitignored, so keys are
 * not committed — but do not paste raw run output or share a trace externally.
 */
async function sharedCtx(): Promise<APIRequestContext> {
  const existing = contexts.get(CTX_KEY)
  if (existing) return existing
  const ctx = await pwRequest.newContext({ ignoreHTTPSErrors: true })
  contexts.set(CTX_KEY, ctx)
  return ctx
}

/** Join a service base and a path into an absolute URL, tolerating slashes on either side. */
function url(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base
  const p = path.startsWith('/') ? path.slice(1) : path
  return b + '/' + p
}

/**
 * Per-request timeout for API calls, in ms.
 *
 * The hub config's `actionTimeout: 15_000` is tuned for UI actions and also applies
 * to APIRequestContext calls, which is too tight here: MsgStatusQuery against a
 * just-submitted message can sit well past 15 s, and the platform's own 404 body
 * suggests retrying after 10 s. Every helper call passes this explicitly rather than
 * loosening actionTimeout globally, which would slacken every other app's UI specs.
 * Override with EPTTS_API_TIMEOUT_MS.
 *
 * WHY 75 s AND NOT 45 s
 *
 * When SendEPCIS cannot persist a document it holds the request for ~60 s and then answers
 * with a precise diagnosis of its own:
 *
 *   503 {"code":"E003","reason":"EPCIS accept temporarily unavailable — durable object
 *        storage not confirmed. Please retry."}
 *
 * At 45 s we timed out four seconds-worth of patience short of that, so every affected case
 * failed with an opaque "apiRequestContext.post: Timeout 45000ms exceeded" and the platform's
 * explanation was thrown away — it read as our client hanging rather than a named storage
 * outage. Sitting past the platform's own failure window means the run records what the
 * platform actually said.
 */
const API_TIMEOUT_MS = Number(process.env.EPTTS_API_TIMEOUT_MS ?? 75_000)

/** Dispose every cached context + token. Call from an afterAll hook. */
export async function disposeApi(): Promise<void> {
  for (const ctx of contexts.values()) await ctx.dispose()
  contexts.clear()
  tokens.clear()
}

// ─── auth ────────────────────────────────────────────────────────────────────

interface CachedToken {
  token: string
  /** epoch ms after which we re-authenticate (refreshed early — see AUTH_SKEW_MS). */
  expiresAt: number
}
const tokens = new Map<Role, CachedToken>()

/**
 * Tokens live 900 s. Refresh 120 s early so a long spec can never fire a request
 * with a token that expires mid-flight.
 */
const AUTH_SKEW_MS = 120_000

export interface AuthResult {
  status: number
  accessToken: string | null
  refreshToken: string | null
  tokenType: string | null
  expiresIn: number | null
  body: unknown
}

/**
 * Raw POST /auth — no caching, no throwing. Use this in the api-authentication
 * feature, where the response itself is the thing under test.
 *
 * The `apikey` header is mandatory. The body is OPTIONAL and conditionally validated:
 * the legacy username/password path engages only when BOTH fields are present and
 * non-empty (a wrong pair gives 401), and is skipped when either is empty/null/absent.
 * Pass `apikey: null` to omit the header entirely (the missing-key negative case).
 */
export async function rawAuth(apikey: string | null, body?: unknown): Promise<AuthResult> {
  const ctx = await sharedCtx()
  const target = url(registryBase(), 'auth')
  const headers: Record<string, string> = apikey === null ? {} : { apikey }
  const startedAt = Date.now()
  const res = await ctx.post(target, {
    headers,
    timeout: API_TIMEOUT_MS,
    ...(body !== undefined ? { data: body } : {}),
  })
  // Recorded before the body is consumed below: an APIResponse body can only be read once.
  await recordExchange({
    method: 'POST', url: target, requestHeaders: headers, requestBody: body,
    label: 'auth', startedAt, res,
  })
  let json: Record<string, unknown> = {}
  try { json = (await res.json()) as Record<string, unknown> } catch { /* non-JSON body */ }
  return {
    status: res.status(),
    accessToken: typeof json.access_token === 'string' ? json.access_token : null,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    tokenType: typeof json.token_type === 'string' ? json.token_type : null,
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : null,
    body: json,
  }
}

/** Authenticate a role and cache the token. Throws with the response body on failure. */
export async function authenticate(role: Role): Promise<string> {
  const cached = tokens.get(role)
  if (cached && Date.now() < cached.expiresAt) return cached.token

  const result = await rawAuth(apiKeyFor(role))
  if (result.status !== 200 || !result.accessToken) {
    throw new Error(
      `auth failed for role "${role}": ${result.status} ${JSON.stringify(result.body)} — ` +
        `check ${ROLES[role].apiKeyEnv} in automation-hub/.env (keys cannot be re-read from the ` +
        `platform; if lost they must be rotated again)`,
    )
  }
  const lifetimeMs = (result.expiresIn ?? 900) * 1000
  tokens.set(role, { token: result.accessToken, expiresAt: Date.now() + lifetimeMs - AUTH_SKEW_MS })
  return result.accessToken
}

/** Decoded B2B token claims — asserted by the authentication feature. */
export interface B2BClaims {
  sub: string
  role: string
  entityId: string
  entityGln: string
  jti: string
  source: string
  principalType: string
  iat?: number
  exp?: number
}

export function decodeClaims(jwt: string): B2BClaims {
  const part = jwt.split('.')[1]
  if (!part) throw new Error('not a JWT')
  return JSON.parse(Buffer.from(part, 'base64').toString('utf8')) as B2BClaims
}

/** Authorization header for a role. `apikey` is deliberately NOT sent — see the file header. */
async function bearer(role: Role): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await authenticate(role)}` }
}

// ─── raw calls ───────────────────────────────────────────────────────────────

/** POST to masar-service as `role`. `headers` overrides let negative cases break auth on purpose. */
export async function postMasar(
  role: Role,
  path: string,
  data: unknown,
  opts: { headers?: Record<string, string>; contentType?: string } = {},
): Promise<APIResponse> {
  const ctx = await sharedCtx()
  const headers = { ...(await bearer(role)), ...(opts.headers ?? {}) }
  if (opts.contentType) headers['Content-Type'] = opts.contentType
  const target = url(masarBase(), path)
  const startedAt = Date.now()
  // A string payload goes through untouched, so malformed-JSON and XML cases work.
  const common = { headers, timeout: API_TIMEOUT_MS }
  const res = await ctx.post(target, typeof data === 'string' ? { ...common, data } : { ...common, data })
  await recordExchange({
    role, method: 'POST', url: target, requestHeaders: headers, requestBody: data,
    label: path.replace(/^\//, ''), startedAt, res,
  })
  return res
}

export async function getMasar(role: Role, path: string): Promise<APIResponse> {
  const ctx = await sharedCtx()
  const target = url(masarBase(), path)
  const headers = await bearer(role)
  const startedAt = Date.now()
  const res = await ctx.get(target, { headers, timeout: API_TIMEOUT_MS })
  await recordExchange({
    role, method: 'GET', url: target, requestHeaders: headers,
    label: path.replace(/^\//, '').split('?')[0], startedAt, res,
  })
  return res
}

/**
 * A fully raw request with caller-controlled headers — the primitive the security feature
 * needs. Unlike postMasar/getMasar it injects NO Authorization of its own, so a case can
 * present a forged token, a garbage bearer, or no credential at all, and can hit either
 * service. The exchange is still recorded, so the request/response evidence lands in the
 * run's api-log.html exactly like every other call. `apikey` and `Authorization` remain
 * masked by the recorder.
 */
export async function rawRequest(
  method: 'GET' | 'POST',
  service: 'masar' | 'registry',
  path: string,
  opts: { headers?: Record<string, string>; data?: unknown; label?: string } = {},
): Promise<APIResponse> {
  const ctx = await sharedCtx()
  const base = service === 'masar' ? masarBase() : registryBase()
  const target = url(base, path)
  const headers = { ...(opts.headers ?? {}) }
  const startedAt = Date.now()
  const label = opts.label ?? path.replace(/^\//, '').split('?')[0]
  const res =
    method === 'GET'
      ? await ctx.get(target, { headers, timeout: API_TIMEOUT_MS })
      : await ctx.post(target, {
          headers,
          timeout: API_TIMEOUT_MS,
          ...(opts.data !== undefined
            ? typeof opts.data === 'string'
              ? { data: opts.data }
              : { data: opts.data }
            : {}),
        })
  await recordExchange({
    method, url: target, requestHeaders: headers,
    requestBody: opts.data, label, startedAt, res,
  })
  return res
}

/** POST an EPCIS document. Defaults to /scp/SendEPCIS (what all 348 cases describe). */
export async function sendEpcis(
  role: Role,
  document: unknown,
  opts: { endpoint?: '/scp/SendEPCIS' | '/epcis/json'; headers?: Record<string, string>; contentType?: string } = {},
): Promise<APIResponse> {
  return postMasar(role, opts.endpoint ?? '/scp/SendEPCIS', document, opts)
}

/** POST /Dispensation — synchronous (200), no polling. Manufacturer gets 403 here. */
export async function dispensation(
  role: Role,
  document: unknown,
  opts: { headers?: Record<string, string>; contentType?: string } = {},
): Promise<APIResponse> {
  return postMasar(role, '/Dispensation', document, opts)
}

export async function verifyProduct(role: Role, productId: string): Promise<APIResponse> {
  return postMasar(role, '/VerifyProduct', { productId, geoLatitude: '', geoLongitude: '' })
}

/** The `pack` object VerifyProduct returns — the authoritative pack-state source. */
export interface PackState {
  sgtin: string
  gtin: string
  serial: string
  batchNumber: string | null
  expiryDate: string | null
  /** Lifecycle state. LOWERCASE vocabulary ("active", ...) — not the prose names. */
  status: string
  /** Current custodian GLN — how shipping/receiving custody transfer is verified. */
  currentGln: string | null
  isRecalled: boolean
  /** Set once the pack is aggregated; confirms packing / unpacking. */
  parentSscc: string | null
  manufacturerGln: string | null
}

export interface VerifyResult {
  verified: boolean
  sgtin: string
  pack: PackState | null
  product: Record<string, unknown> | null
  alerts: string[]
}

/**
 * Read a pack's current state.
 *
 * Note VerifyProduct answers 200 with `verified: false` for an unknown pack, so the
 * HTTP status proves nothing — callers must inspect `verified` / `alerts` / `pack`.
 */
export async function packOf(role: Role, epc: string): Promise<VerifyResult> {
  const res = await verifyProduct(role, epc)
  const body = (await bodyOf(res)) as Partial<VerifyResult> | null
  return {
    verified: body?.verified === true,
    sgtin: body?.sgtin ?? epc,
    pack: (body?.pack as PackState | null) ?? null,
    product: (body?.product as Record<string, unknown> | null) ?? null,
    alerts: Array.isArray(body?.alerts) ? (body!.alerts as string[]) : [],
  }
}

// ─── MsgStatusQuery polling ──────────────────────────────────────────────────

export interface MsgStatus {
  /** HTTP status of the last poll. */
  status: number
  /** The platform's raw status string, e.g. "S - Successful". Null if absent. */
  raw: string | null
  /** Normalised outcome. PENDING means still processing. */
  state: 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'PENDING' | null
  /** True once `state` is one of SUCCESS / FAILED / PARTIAL. */
  terminal: boolean
  /** Per-event log entries the platform returns; the best failure-reason source. */
  logs: { type: string; message: string }[]
  /** Whole response body of the last poll, for assertions and failure messages. */
  body: unknown
  /** True when polling gave up before reaching a terminal state. */
  timedOut: boolean
  pollCount: number
}

/**
 * Find a status string in the response, whatever it is called.
 *
 * The live field is `messagestatus` — ALL LOWERCASE — which a camelCase lookup
 * silently misses, making every async test poll to timeout despite the submission
 * having succeeded. Keys are therefore matched case-insensitively.
 */
function extractRawStatus(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const wanted = ['messagestatus', 'status', 'state', 'processingstatus', 'msgstatus']
  for (const key of Object.keys(b)) {
    if (!wanted.includes(key.toLowerCase())) continue
    const v = b[key]
    if (typeof v === 'string') return v
    // /scp/SendEPCIS-style nesting: { status: { reason, code } }
    if (v && typeof v === 'object') {
      const inner = v as Record<string, unknown>
      for (const ik of ['status', 'state', 'reason']) {
        if (typeof inner[ik] === 'string') return inner[ik] as string
      }
    }
  }
  return null
}

/**
 * Classify the platform's status string.
 *
 * Observed live: "S - Successful". The leading letter is the machine-readable part,
 * so both it and the word are matched: S = success, E/F = failure, P/I/Q = still
 * working. A bare "SUCCESS"/"COMPLETED" is also accepted in case the shape varies
 * by endpoint.
 */
function classifyStatus(raw: string | null): MsgStatus['state'] {
  if (!raw) return null
  const t = raw.trim()
  if (/partial/i.test(t)) return 'PARTIAL'
  // Match the leading letter code ("S - Successful") or the word form.
  if (/^S([^A-Za-z]|$)|success|complete/i.test(t)) return 'SUCCESS'
  if (/^[EF]([^A-Za-z]|$)|error|fail|reject|invalid/i.test(t)) return 'FAILED'
  if (/^[PIQ]([^A-Za-z]|$)|process|initial|pending|queue|progress/i.test(t)) return 'PENDING'
  return null
}

/** Pull the platform's per-event log entries out of a MsgStatusQuery body. */
function extractLogs(body: unknown): { type: string; message: string }[] {
  if (!body || typeof body !== 'object') return []
  const list = (body as Record<string, unknown>).logList
  if (!Array.isArray(list)) return []
  return list
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l) => ({ type: String(l.type ?? ''), message: String(l.message ?? '') }))
}

/** Human-readable one-liner for assertion failure messages. */
export function describeMsgStatus(m: MsgStatus): string {
  const logs = m.logs.map((l) => `${l.type}: ${l.message}`).join(' | ')
  return `http=${m.status} raw="${m.raw}" state=${m.state} polls=${m.pollCount}` +
    (m.timedOut ? ' TIMED_OUT' : '') + (logs ? ` logs=[${logs}]` : '')
}

/**
 * Poll MsgStatusQuery until the submission reaches a terminal state.
 *
 * A 404 means "no message yet — may still be initializing" (the platform's own
 * wording) and is retried, NOT treated as failure. Getting this wrong makes every
 * asynchronous test flake.
 */
export async function pollMsgStatus(
  role: Role,
  instanceIdentifier: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<MsgStatus> {
  const timeoutMs = opts.timeoutMs ?? 90_000
  // The 404 body itself recommends ~10 s; 2 s converges faster without hammering.
  const intervalMs = opts.intervalMs ?? 2_000
  const deadline = Date.now() + timeoutMs

  let last: { status: number; body: unknown } = { status: 0, body: null }
  let pollCount = 0

  while (Date.now() < deadline) {
    pollCount++
    const res = await postMasar(role, '/MsgStatusQuery', { instanceIdentifier })
    let body: unknown = null
    try { body = await res.json() } catch { body = await res.text() }
    last = { status: res.status(), body }

    if (res.status() === 200) {
      const raw = extractRawStatus(body)
      const state = classifyStatus(raw)
      if (state && state !== 'PENDING') {
        return { status: res.status(), raw, state, terminal: true, logs: extractLogs(body), body, timedOut: false, pollCount }
      }
    } else if (res.status() !== 404) {
      // Anything other than 200-still-pending or 404-not-found is a real error.
      const raw = extractRawStatus(body)
      return { status: res.status(), raw, state: classifyStatus(raw), terminal: false, logs: extractLogs(body), body, timedOut: false, pollCount }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  const raw = extractRawStatus(last.body)
  return {
    status: last.status, raw, state: classifyStatus(raw), terminal: false,
    logs: extractLogs(last.body), body: last.body, timedOut: true, pollCount,
  }
}

/** Convenience: submit, assert 202-ish, then poll. Returns the instanceIdentifier + status. */
export async function submitAndPoll(
  role: Role,
  document: EpcisDocument,
  opts: { endpoint?: '/scp/SendEPCIS' | '/epcis/json'; timeoutMs?: number } = {},
): Promise<{ submitStatus: number; submitBody: unknown; instanceIdentifier: string; msg: MsgStatus }> {
  const iid = document.sbdh.documentIdentification.instanceIdentifier
  const res = await sendEpcis(role, document, { endpoint: opts.endpoint })
  let submitBody: unknown = null
  try { submitBody = await res.json() } catch { submitBody = await res.text() }
  const msg: MsgStatus = res.status() >= 400
    ? {
        status: res.status(), raw: null, state: null, terminal: false, logs: [],
        body: submitBody, timedOut: false, pollCount: 0,
      }
    : await pollMsgStatus(role, iid, { timeoutMs: opts.timeoutMs })
  return { submitStatus: res.status(), submitBody, instanceIdentifier: iid, msg }
}

// ─── identifiers ─────────────────────────────────────────────────────────────
//
// Serials MUST be unique per run: the suite executes against production, and
// re-commissioning an existing SGTIN is a different test than commissioning a new
// one. A run-scoped prefix keeps repeated runs from colliding.

const RUN_ID = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`.toUpperCase()
let serialCounter = 0

/** The run's identifier, surfaced in logs so a run's EPCs can be traced afterwards. */
export function runId(): string {
  return RUN_ID
}

/** A fresh serial, unique within and across runs. Prefixed ZTG so ours are identifiable. */
export function uniqueSerial(): string {
  serialCounter++
  return `ZTG${RUN_ID}${String(serialCounter).padStart(4, '0')}`
}

/**
 * A fresh business-transaction reference — an invoice number for a shipment, or a return
 * reference for a return.
 *
 * MUST be unique per shipment, not per run. The platform enforces this:
 *
 *   Shipping event failed: [handleShipping] Invoice number 'INV-ZTG-MTHAFOX02S0' is already
 *   used in shipment 01a0580f-…. Each shipment must have a unique invoice number.
 *
 * That is correct behaviour on its part — an invoice number is how a shipment is identified,
 * so reusing one makes two shipments indistinguishable. Deriving the reference from
 * `runId()` alone (which is constant for the whole worker) meant the FIRST shipment in a
 * worker succeeded and every later one failed, which then cascaded into every receiving,
 * dispensing, unpacking and returns fixture built on top of it. It looked like a platform
 * fault across five features and was ours.
 */
export function uniqueBizTransaction(prefix = 'INV'): string {
  return `${prefix}-ZTG-${RUN_ID}-${String(++serialCounter).padStart(4, '0')}`
}

/** A fresh instanceIdentifier (the MsgStatusQuery handle). */
export function uniqueInstanceId(): string {
  return `ztg-${RUN_ID.toLowerCase()}-${String(++serialCounter).padStart(4, '0')}`
}

/**
 * Convert a GTIN-14 to the SGTIN URN prefix for a given GS1 Company Prefix length.
 *
 * GTIN-14 = indicator(1) + companyPrefix(gcpLength) + itemRef(rest) + checkDigit(1).
 * SGTIN URN = urn:epc:id:sgtin:<companyPrefix>.<indicator + itemRef>.<serial>
 * companyPrefix + itemReference always totals 13 digits.
 *
 * e.g. gtin 08435308354487, gcpLength 8 -> urn:epc:id:sgtin:84353083.05448.<serial>
 */
export function sgtinFor(gtin: string, gcpLength: number, serial: string): string {
  const g = gtin.replace(/\D/g, '')
  if (g.length !== 14) throw new Error(`GTIN must be 14 digits, got "${gtin}" (${g.length})`)
  const indicator = g[0]
  const companyPrefix = g.slice(1, 1 + gcpLength)
  const itemRef = g.slice(1 + gcpLength, 13) // drop the trailing check digit
  return `urn:epc:id:sgtin:${companyPrefix}.${indicator}${itemRef}.${serial}`
}

/**
 * SSCC URN: urn:epc:id:sscc:<companyPrefix>.<serialRef>, where companyPrefix +
 * serialRef totals 17 digits.
 */
export function ssccFor(companyPrefix: string, serialRef?: string): string {
  const prefix = companyPrefix.replace(/\D/g, '')
  const width = 17 - prefix.length
  if (width < 1) throw new Error(`company prefix "${companyPrefix}" leaves no room for a serial ref`)
  const digits = (serialRef ?? String(Date.now() % 10 ** width) + String(++serialCounter))
    .replace(/\D/g, '')
    .slice(0, width)
    .padStart(width, '0')
  return `urn:epc:id:sscc:${prefix}.${digits}`
}

/**
 * GS1 mod-10 check digit for a numeric payload.
 * Weights alternate 3,1,3,1,… from the LEFTMOST payload digit.
 */
export function gs1CheckDigit(payload: string): string {
  const d = payload.replace(/\D/g, '')
  let sum = 0
  for (let i = 0; i < d.length; i++) {
    sum += Number(d[i]) * (i % 2 === 0 ? 3 : 1)
  }
  return String((10 - (sum % 10)) % 10)
}

/**
 * Convert an SSCC URN to the 18-digit GS1 element string.
 *
 * This matters because the two forms are NOT interchangeable across the API:
 * EPCIS events carry the URN (`urn:epc:id:sscc:84353083.168930135`) while
 * VerifyProduct's `pack.parentSscc` returns the element string
 * (`184353083689301350`). Comparing them directly makes a working aggregation look
 * broken.
 *
 * Layout per the EPC Tag Data Standard: the URN's serial-reference field begins with
 * the extension digit, so
 *   SSCC-18 = extensionDigit + companyPrefix + restOfSerialRef + checkDigit
 */
export function ssccUrnToDigits(urn: string): string {
  const m = /^urn:epc:id:sscc:(\d+)\.(\d+)$/.exec(urn.trim())
  if (!m) throw new Error(`not an SSCC URN: "${urn}"`)
  const [, companyPrefix, serialRef] = m
  const payload = serialRef.slice(0, 1) + companyPrefix + serialRef.slice(1)
  if (payload.length !== 17) {
    throw new Error(`SSCC payload must be 17 digits, got ${payload.length} from "${urn}"`)
  }
  return payload + gs1CheckDigit(payload)
}

/** True when a URN and an element string denote the same SSCC. */
export function sameSscc(urn: string, elementString: string | null | undefined): boolean {
  if (!elementString) return false
  const digits = String(elementString).replace(/\D/g, '')
  try {
    return ssccUrnToDigits(urn) === digits
  } catch {
    return false
  }
}

/** SGLN URN for a GLN: urn:epc:id:sgln:<companyPrefix>.<locationRef>.0 (prefix+ref = 12 digits). */
export function sglnFor(gln: string, gcpLength: number): string {
  const g = gln.replace(/\D/g, '')
  if (g.length !== 13) throw new Error(`GLN must be 13 digits, got "${gln}"`)
  const companyPrefix = g.slice(0, gcpLength)
  const locationRef = g.slice(gcpLength, 12) // drop the check digit
  return `urn:epc:id:sgln:${companyPrefix}.${locationRef}.0`
}

// ─── EPCIS document builders ─────────────────────────────────────────────────

export interface EpcisDocument {
  '@context': string[]
  type: 'EPCISDocument'
  schemaVersion: string
  creationDate: string
  sbdh: {
    headerVersion: string
    sender: { identifier: string }
    receiver: { identifier: string }
    documentIdentification: {
      standard: string
      typeVersion: string
      instanceIdentifier: string
      type: string
      creationDateAndTime: string
    }
  }
  epcisBody: { eventList: Record<string, unknown>[] }
}

/** ISO 8601 with an explicit offset — the platform rejects timestamps without one. */
export function nowIso(offset = '+03:00'): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${offset}`
  )
}

export interface EnvelopeOpts {
  senderGln: string
  receiverGln: string
  instanceIdentifier?: string
  creationDate?: string
}

/** Wrap events in the standard EPCIS 2.0 envelope. */
export function epcisDocument(events: Record<string, unknown>[], opts: EnvelopeOpts): EpcisDocument {
  const when = opts.creationDate ?? nowIso()
  return {
    '@context': ['https://ref.gs1.org/standards/epcis/2.0.0/epcis-context.jsonld'],
    type: 'EPCISDocument',
    schemaVersion: '2.0',
    creationDate: when,
    sbdh: {
      headerVersion: '1.3',
      sender: { identifier: opts.senderGln },
      receiver: { identifier: opts.receiverGln },
      documentIdentification: {
        standard: 'EPCGlobal',
        typeVersion: '1.0',
        instanceIdentifier: opts.instanceIdentifier ?? uniqueInstanceId(),
        type: 'Events',
        creationDateAndTime: when,
      },
    },
    epcisBody: { eventList: events },
  }
}

interface BaseEventOpts {
  readPointSgln: string
  bizLocationSgln?: string
  eventTime?: string
  eventTimeZoneOffset?: string
}

function baseEvent(o: BaseEventOpts): Record<string, unknown> {
  const t = o.eventTime ?? nowIso(o.eventTimeZoneOffset ?? '+03:00')
  return {
    eventTime: t,
    eventTimeZoneOffset: o.eventTimeZoneOffset ?? '+03:00',
    readPoint: { id: o.readPointSgln },
    bizLocation: { id: o.bizLocationSgln ?? o.readPointSgln },
  }
}

/** Commissioning: brings SGTINs into existence. `ilmd` carries lot + expiry. */
export function commissionEvent(
  o: BaseEventOpts & { epcList: string[]; lotNumber: string; expiryDate: string },
): Record<string, unknown> {
  return {
    type: 'ObjectEvent',
    ...baseEvent(o),
    action: 'ADD',
    bizStep: 'commissioning',
    disposition: 'active',
    epcList: o.epcList,
    ilmd: { 'cbvmda:lotNumber': o.lotNumber, 'cbvmda:itemExpirationDate': o.expiryDate },
  }
}

/** Packing / unpacking. `action: ADD` aggregates, `DELETE` disaggregates. */
export function aggregationEvent(
  o: BaseEventOpts & { parentID: string; childEPCs: string[]; action: 'ADD' | 'DELETE' },
): Record<string, unknown> {
  return {
    type: 'AggregationEvent',
    ...baseEvent(o),
    action: o.action,
    bizStep: o.action === 'ADD' ? 'packing' : 'unpacking',
    disposition: 'active',
    parentID: o.parentID,
    childEPCs: o.childEPCs,
  }
}

const SDT = 'urn:epcglobal:cbv:sdt:owning_party'
const BTT = 'urn:epcglobal:cbv:btt:desadv'

/** Shipping (`in_transit`) and return-shipping (`returned`). */
export function shippingEvent(
  o: BaseEventOpts & {
    epcList: string[]
    sourceSgln: string
    destinationSgln: string
    bizTransaction: string
    disposition?: 'in_transit' | 'returned'
  },
): Record<string, unknown> {
  return {
    type: 'ObjectEvent',
    ...baseEvent(o),
    action: 'OBSERVE',
    bizStep: 'shipping',
    disposition: o.disposition ?? 'in_transit',
    epcList: o.epcList,
    sourceList: [{ type: SDT, source: o.sourceSgln }],
    destinationList: [{ type: SDT, destination: o.destinationSgln }],
    bizTransactionList: [{ type: BTT, bizTransaction: o.bizTransaction }],
  }
}

/** Receiving (`in_progress`) and return-receiving (`returned`). */
export function receivingEvent(
  o: BaseEventOpts & {
    epcList: string[]
    sourceSgln: string
    bizTransaction?: string
    disposition?: 'in_progress' | 'returned'
  },
): Record<string, unknown> {
  const ev: Record<string, unknown> = {
    type: 'ObjectEvent',
    ...baseEvent(o),
    action: 'OBSERVE',
    bizStep: 'receiving',
    disposition: o.disposition ?? 'in_progress',
    epcList: o.epcList,
    sourceList: [{ type: SDT, source: o.sourceSgln }],
  }
  if (o.bizTransaction) ev.bizTransactionList = [{ type: BTT, bizTransaction: o.bizTransaction }]
  return ev
}

/** Destruction (`destroyed`) and the other decommissioning dispositions. */
export function destructionEvent(
  o: BaseEventOpts & { epcList: string[]; disposition?: string; bizStep?: string },
): Record<string, unknown> {
  return {
    type: 'ObjectEvent',
    ...baseEvent(o),
    action: 'DELETE',
    bizStep: o.bizStep ?? 'destroying',
    disposition: o.disposition ?? 'destroyed',
    epcList: o.epcList,
  }
}

/** Dispensing. Omit `quantity` for a full pack, supply it for a partial dispense. */
export function dispensingEvent(
  o: BaseEventOpts & { epcList: string[]; quantity?: number },
): Record<string, unknown> {
  const ev: Record<string, unknown> = {
    type: 'ObjectEvent',
    ...baseEvent(o),
    action: 'OBSERVE',
    bizStep: 'retail_selling',
    disposition: 'retail_sold',
    epcList: o.epcList,
  }
  if (o.quantity !== undefined) ev.quantity = o.quantity
  return ev
}

// ─── error envelopes ─────────────────────────────────────────────────────────
//
// The API uses THREE different error shapes (see verified-live-contract.md). A
// single "expect an error" helper cannot work, so normalise instead.

export interface NormalisedError {
  /** Error code where the envelope carries one (E003, E016, …). */
  code: string | null
  /** Human-readable reason, whichever field it lived in. */
  message: string | null
  /** Which envelope format was detected — useful in assertion messages. */
  shape: 'epcis' | 'logList' | 'nest' | 'text' | 'unknown'
}

/** Normalise any of the platform's error bodies into one shape. */
export function normaliseError(body: unknown): NormalisedError {
  if (typeof body === 'string') return { code: null, message: body, shape: 'text' }
  if (!body || typeof body !== 'object') return { code: null, message: null, shape: 'unknown' }
  const b = body as Record<string, any>

  // 1. /scp/SendEPCIS, /Dispensation: { statustype:'E', status:{ reason, code } }
  if (b.statustype && b.status && typeof b.status === 'object') {
    return { code: b.status.code ?? null, message: b.status.reason ?? null, shape: 'epcis' }
  }
  // 2. /VerifyProduct: { logList:[{ type:'E', code, message }] }
  if (Array.isArray(b.logList)) {
    const err = b.logList.find((l: any) => l?.type === 'E') ?? b.logList[0]
    return { code: err?.code ?? null, message: err?.message ?? null, shape: 'logList' }
  }
  // 3. NestJS default: { statusCode, message, error }
  if (b.statusCode !== undefined || b.message !== undefined) {
    return { code: b.error ?? null, message: typeof b.message === 'string' ? b.message : JSON.stringify(b.message), shape: 'nest' }
  }
  return { code: null, message: null, shape: 'unknown' }
}

/** Read a response body as JSON, falling back to text. Never throws. */
export async function bodyOf(res: APIResponse): Promise<unknown> {
  try { return await res.json() } catch { /* not JSON */ }
  try { return await res.text() } catch { return null }
}

/** Read + normalise an error response in one step. */
export async function errorOf(res: APIResponse): Promise<NormalisedError> {
  return normaliseError(await bodyOf(res))
}

// ─── test data ───────────────────────────────────────────────────────────────

/**
 * A GTIN registered to the devsim manufacturer (INSTITUTO GRIFOLS, GLN
 * 8435308300002, GCP length 8). Confirmed active in the registry on 2026-08-31.
 * Commissioning requires a GTIN under the acting manufacturer's own GCP, so these
 * are not interchangeable with the spreadsheet's placeholder GTINs.
 */
export const MFG_GTINS = [
  '08435308354487', // Factor IX Grifols 1000 IU / 20 ml
  '08435308354494', // Factor IX Grifols 1500 IU / 30 ml
  '08435308354302', // Factor IX Grifols 250 IU / 5 ml
  '08435308354319', // Factor IX Grifols 500 IU / 10 ml
  '08435308354081', // Fanhdi 100 IU FVIII / 120 IU VWF per ml
] as const

/**
 * GTINs that can actually be DISPENSED through this API.
 *
 * 27 of the manufacturer's 30 products carry `isDawanaIntegration: true`, and the
 * platform refuses to dispense those here:
 *
 *   "Dispensing is not allowed for Dawana-integrated products via this channel.
 *    These products must be dispensed through the Dawana integration."
 *
 * That is a legitimate business rule, not a defect — but it means a dispensing test
 * must pick from this short list or it fails for the wrong reason. Commissioning,
 * packing, shipping and receiving are unaffected and work with any GTIN above.
 */
export const MFG_DISPENSABLE_GTINS = [
  '08435308348882', // Fanhdi 50 IU FVIII / 60 IU VWF per ml (MQ)
  '08435308348912', // Flebogamma DIF 2.5 g / 50 ml (MQ)
  '08435308348929', // Human Albumin Grifols 10 g / 50 ml (MQ)
] as const

/**
 * No product THIS MANUFACTURER holds has a `dispenseType` other than "full" — all 30 of its
 * own are full-pack only.
 *
 * The registry as a whole is a different matter: it has 662 products and 5 of them are
 * `partial`, among them 07910000000012 "LoadTest Product 0". An earlier version of this
 * comment claimed the platform had none at all, which was measuring the manufacturer's
 * catalogue and describing the registry.
 *
 * They are still unusable here, for a reason that is correct behaviour rather than a gap:
 * every one belongs to another MAH, and commissioning is refused —
 *
 *   "GTIN 06290009990011 is registered to 6290009990004 with no registered agent, and this
 *    request was sent by 8435308300002. Only the marketing-authorisation holder or its
 *    registered agent may act for a product."
 *
 * So this list stays empty until 8435308300002 is added as `registeredAgentGln` on one of the
 * non-Dawana partial products, or a partial product is registered under it. Two of the five
 * are also Dawana-only, so any fix should target 06290009990011 or 05413868123456.
 */
export const MFG_PARTIAL_DISPENSE_GTINS: readonly string[] = [
  // Fanhdi 50 IU FVIII/60 IU VWF per ml (MQ). Made `dispenseType: partial` on 2026-09-01 so
  // partial dispensing could be exercised at all. It is the ONE partial product this
  // manufacturer holds, and it is non-Dawana, so this channel will actually dispense it.
  '08435308348882',
]

/**
 * Units in one pack of the partial-dispense product: 10 pills per strip x 3 strips.
 *
 * Read from the registry rather than assumed — the quantity cases turn on it, and a wrong
 * pack size makes "over-dispense is refused" pass for the wrong reason.
 */
export const MFG_PARTIAL_PACK_UNITS = 30

/** A fresh SGTIN of the partial-dispense product. */
export function freshPartialSgtin(): string {
  return sgtinFor(MFG_PARTIAL_DISPENSE_GTINS[0], MFG_GCP_LENGTH, uniqueSerial())
}

export const MFG_GCP_LENGTH = 8
/** The manufacturer's GS1 Company Prefix, for minting SSCCs. */
export const MFG_COMPANY_PREFIX = '84353083'

/**
 * GS1 Company Prefix length per role, from the registry's `gcpLength` field.
 * Needed to build each role's SGLN, which every event's readPoint/bizLocation uses.
 *   manufacturer 8435308300002 gcp 8 -> urn:epc:id:sgln:84353083.0000.0
 *   branch       0085412000008 gcp 7 -> urn:epc:id:sgln:0085412.00000.0
 *   pharmacy     1234567890128 gcp 7 -> urn:epc:id:sgln:1234567.89012.0
 */
export const GCP_LENGTH: Record<Role, number> = {
  manufacturer: 8,
  branch: 7,
  pharmacy: 7,
  // Second-entity GCP lengths, read from the registry's `gcpLength` field 2026-09-02:
  //   ef_manufacturer 7910000000005 gcp 9 (LoadTest MAH 0)
  //   ef_distributor  5413868000108 gcp 7 (Test Distributor)
  //   ef_pharmacy     6220000000013 gcp 6 (Test Pharmacy 1)
  ef_manufacturer: 9,
  ef_distributor: 7,
  ef_pharmacy: 6,
}

/** The SGLN for a role, used as readPoint / bizLocation and in source/destination lists. */
export function sglnOf(role: Role): string {
  return sglnFor(glnFor(role), GCP_LENGTH[role])
}

/** A fresh SGTIN under the manufacturer's own GCP, ready to commission. */
export function freshSgtin(gtin: string = MFG_GTINS[0]): string {
  return sgtinFor(gtin, MFG_GCP_LENGTH, uniqueSerial())
}

/**
 * A fresh SGTIN for a product that can be dispensed through this API — use this
 * whenever the flow under test ends in a dispense, otherwise the run fails on the
 * Dawana-integration rule rather than on the behaviour being tested.
 */
export function freshDispensableSgtin(gtin: string = MFG_DISPENSABLE_GTINS[0]): string {
  return sgtinFor(gtin, MFG_GCP_LENGTH, uniqueSerial())
}

/** A fresh SSCC under the manufacturer's own GCP. */
export function freshSscc(): string {
  return ssccFor(MFG_COMPANY_PREFIX)
}
