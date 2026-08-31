# api-partial-dispensing — Feature Knowledge

## Why this feature matters

The only quantity-bearing event in the module. A pack sits in a partially-dispensed state across several requests until exhausted, so arithmetic correctness — and refusing to over-dispense — is the entire point of the feature.

## Contract specifics

- Same as dispensing plus a `quantity` field on the event.
- Sequential partial dispenses must decrement the remainder correctly and flip the pack to fully
  dispensed on the last one.

## What will bite you

- **BLOCKED: this feature cannot be executed on devsim at all.** Every one of the 30 registered
  products has `dispenseType: "full"`; none supports partial dispensing, so the platform has nothing
  to partially dispense. This is a test-data gap, not a code defect — see the filed bug. To unblock,
  register a product with a partial/unit `dispenseType` (Registry → Products) and ideally
  `isDawanaIntegration: false`.
- When it is unblocked, the cases that matter most are the boundaries: quantity exceeding the
  remainder must be **refused, not clamped**; zero, negative and fractional quantities; and
  concurrent partial dispenses of the same SGTIN, where the remainder must not go negative.

## Known defects filed against this feature

- **P2 – High** — [BLOCKER][Partial Dispensing] No product is registered with a partial dispense type, so partial dispensing cannot be exercised at all

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

- **TC_PDISP_018** — https://dafholding.atlassian.net/browse/DW-897 _(DW-897)_
- **TC_PDISP_019** — https://dafholding.atlassian.net/browse/DW-897 _(DW-897)_

### Verification status

**Not yet executed against production.** Every case is `Under Testing` / `new_added`.

The source spreadsheet recorded these statuses against **staging**, by a different tester: Fail 2, Pass 34. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.
