# api-packing — Feature Knowledge

## Why this feature matters

Aggregation lets a whole container move under one identifier, and it **cascades**: shipping an SSCC moves every child pack with it. A wrong aggregation therefore corrupts every later event silently, which makes this feature's correctness a precondition for shipping, receiving and returns.

## Contract specifics

- `AggregationEvent`, `action: ADD`, `bizStep: packing`, with `parentID` (the SSCC) and `childEPCs`
  — **not** `epcList`. Getting the EPC carrier wrong is the most common authoring mistake here.
- SSCCs are minted under the manufacturer's GCP: `ssccFor('84353083')` → `urn:epc:id:sscc:84353083.<9 digits>`.
- Packing does **not** change `pack.status` (it stays `active`); what changes is `pack.parentSscc`.
  Assert on that, not on status.

## What will bite you

- **SSCC has two non-interchangeable representations.** Events carry the URN
  (`urn:epc:id:sscc:84353083.169538028`) while `VerifyProduct.pack.parentSscc` returns the 18-digit
  GS1 element string (`184353083695380288`). Comparing them directly makes a perfectly good
  aggregation look broken — use `sameSscc()` / `ssccUrnToDigits()`.
- Children must be commissioned first, so any packing test owns a commissioning fixture.

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

- **TS_PACK_005** — https://dafholding.atlassian.net/browse/DW-846 _(DW-846)_
- **TS_PACK_009** — N/A
- **TS_PACK_015** — https://dafholding.atlassian.net/browse/DW-848 _(DW-848)_
- **TS_PACK_017** — https://dafholding.atlassian.net/browse/DW-851 _(DW-851)_

### Verification status

**Not yet executed against production.** Every case is `Under Testing` / `new_added`.

The source spreadsheet recorded these statuses against **staging**, by a different tester: Blocked/Skipped 1, Fail 4, Pass 12. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.
