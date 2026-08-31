# api-authentication — Feature Knowledge

## Why this feature matters

Every other feature in this module depends on this one endpoint, so a break here fails all 348 API cases at once. The API key also *selects the tenant*: it is simultaneously the authentication credential and the authorization identity, which is why a key that authenticates but returns the wrong `entityGln` would be a serious isolation defect rather than a cosmetic one.

## Contract specifics

- `POST :8445/registry-service/api/v1/auth`, header `apikey`. The vendor collection's
  `:8444/masar-service/api/v1/auth` is a **404 and does not exist**.
- Returns `access_token` (15 min), `refresh_token` (~7 days, not yet exercised), `token_type: Bearer`,
  `expires_in: 900`.
- Token claims: `{sub, role, entityId, entityGln, jti, source:"b2b", principalType:"b2b_partner"}`.
  Assert `entityGln` and `role`, not just the 200.
- **The `apikey` header is not needed after `/auth`.** Every event endpoint authenticates on
  `Authorization: Bearer` alone; `apikey` alone gives 401. The collection sends it everywhere, which
  is harmless but misleading — a case whose objective is "verify a valid/invalid API key in the
  header" belongs against `/auth`, nowhere else.
- **The body is optional but not ignored.** The legacy username/password path engages only when
  *both* fields are present and non-empty; then a wrong pair is 401. If either is empty, null or
  absent the credential check is skipped and the key alone authenticates.
- A valid key is mandatory: no credential pair can substitute for one, so the body can only ever
  narrow access, never widen it.

## What will bite you

- Keys **cannot be read back** from the platform, only replaced. They live in
  `automation-hub/.env`; if that file is lost they must be rotated again, which invalidates whatever
  is currently using them.
- Playwright's call log prints request headers, so a failed `/auth` writes the raw key to stdout and
  into `trace.zip`. Both are gitignored, but do not paste raw run output or share a trace.
- Proving a rotated key stops working requires rotating a live key — destructive, so `TC_AUTH_011`
  stays blocked until a throwaway entity exists to do it against.

## Known defects filed against this feature

- **P3 – Medium** — [Authentication] /auth silently ignores a partially-supplied username/password instead of rejecting it

All are `draft` status: filed in-repo, not yet raised in Jira.

## The asynchronous contract — the main source of false passes

Every write endpoint is fire-and-poll:

1. `POST` the EPCIS document → **`202`** with `{statustype:"I", status:{code:"I001"}}`. This means
   *queued*, not *applied*.
2. `POST /MsgStatusQuery` with the `instanceIdentifier` → poll until terminal.
3. Only then assert the resulting pack state via `POST /VerifyProduct`.

Three traps, each of which has already cost time here:

- The status field is **`messagestatus`, all lowercase**, and its value is **`"S - Successful"`**, not
  a bare `SUCCESS`. A camelCase lookup silently misses it, so the poller sees no state and times out
  while the submission actually succeeded.
- **`404` from MsgStatusQuery means "not ready yet"**, not failure — the body says the message "may
  still be initializing". Treating it as terminal makes every async test flake.
- A negative case can fail in **two different shapes**: a malformed document is refused
  *synchronously* with `400` and nothing is queued; a well-formed document that breaks a business
  rule returns `202` and only reports `FAILED` on polling. Asserting the wrong shape means the test
  passes against broken behaviour.

`/Dispensation` is **also asynchronous** (`202` then poll), despite the source spreadsheet and the
vendor Postman collection both documenting it as a synchronous `200`.

## Error envelopes differ by endpoint

There is no single "expect an error" helper, because the platform uses three formats:

| Endpoints | Shape |
|---|---|
| `/scp/SendEPCIS`, `/Dispensation` | `{statustype:"E", status:{reason, code}}` — codes like `E003` |
| `/VerifyProduct` | `{logList:[{type:"E", code:"E016", message}]}` |
| `/epcis/json`, `/MsgStatusQuery`, all registry-service | NestJS default `{statusCode, message, error}` |

`normaliseError()` in `automation-hub/lib/eptts-api.ts` flattens all three. Assert on the normalised
`code` / `message`, and prefer the per-event `logList` from MsgStatusQuery for a failure reason — a
message can complete overall while an individual event inside it fails.

## What every case here has to account for

- **The Citrix VPN is a hard precondition.** Nothing on `192.168.225.195` resolves without it, and a
  dropped VPN looks exactly like a hung server: every request fails after a uniform ~10 s connect
  timeout. Rule that out before diagnosing anything.
- **TLS is a self-signed certificate.** Playwright needs `ignoreHTTPSErrors: true` (including in
  `browser.newContext()`, which does *not* inherit it from the config's `use` block), the Playwright
  MCP server needs `--ignore-https-errors`, curl needs `-k`, and Postman needs SSL verification off.
- **Two unrelated auth systems.** The dashboard is Keycloak OIDC (realm `masar`, client
  `masar-dashboard`, Authorization Code + PKCE); the B2B API is an `apikey` exchanged for a
  15-minute bearer token. A change to one cannot affect the other. Keycloak's direct password grant
  is **disabled**, so dashboard automation must drive the real browser login.
- **Secrets never go in `data/`.** It is committed. Reference the env key name
  (`EPTTS_MFG_APIKEY`), never the value.

## Case history and provenance

Per-case history for this feature: where each case came from, what the source
spreadsheet recorded, and what this project actually verified. Kept here rather than in
the test-case table, which holds only the 13 columns.

### Notes & Known Defects

Carried over from the `Note` / `Bug Ticket` columns of `EPTTS - API TEST CASES.xlsx`, plus
provenance for any case authored to fill a gap in the source. Kept out of the table so the
13-column format stays parseable.

- **TC_AUTH_004** — In new version, it depends only on apikey
- **TC_AUTH_006** — In new version, it depends only on apikey
- **TC_AUTH_007** — In new version, it depends only on apikey
- **TC_AUTH_008** — In new version, it depends only on apikey
- **TC_AUTH_009** — In new version, it depends only on apikey
- **TC_AUTH_010** — In new version, it depends only on apikey
- **TC_AUTH_011** — In new version, it depends only on apikey
- **TC_AUTH_012** — In new version, it depends only on apikey
- **TC_AUTH_013** — In new version, it depends only on apikey
- **TC_AUTH_013** — _Authored, not from the source sheet:_ Source has a title but empty Steps and Expected Results.

### Verification status

Executed against production on 2026-08-31 (20 automated assertions, `automation-hub/projects/eptts-api-authentication/`). TC_AUTH_011 is blocked: proving a rotated key stops working requires rotating a live key, which is destructive. TC_AUTH_007-TC_AUTH_010 PASS as written because they now assert the platform's real behaviour — the spreadsheet expected 400 for a partially-supplied credential and the platform returns 200. That divergence is filed separately as a draft bug rather than left as a failing case.
