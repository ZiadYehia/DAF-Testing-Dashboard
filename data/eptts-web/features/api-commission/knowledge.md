# api-commission — Feature Knowledge

## Why this feature matters

Commissioning brings a serial number into existence. It is the origin of every traceability chain, and it must be possible **exactly once** per SGTIN — that uniqueness is what the whole system rests on. It is also the only event where master data (lot, expiry) is attached, via `ilmd`, and it cannot be supplied later.

## Contract specifics

- `ObjectEvent`, `action: ADD`, `bizStep: commissioning`, `disposition: active`, plus
  `ilmd: {cbvmda:lotNumber, cbvmda:itemExpirationDate}`.
- Only a **manufacturer** may commission, and only for a GTIN registered under its own GS1 Company
  Prefix. A branch or pharmacy attempting it is correctly refused.
- Test data must come from the acting manufacturer's own catalogue. For devsim that is
  `MFG_GTINS` in `automation-hub/lib/eptts-api.ts` (GCP length **8**, so GTIN `08435308354487`
  becomes `urn:epc:id:sgtin:84353083.05448.<serial>`).
- A successful commission leaves `pack.status: "active"` — lowercase, and *not* the "Commissioned"
  wording the test cases use. Assert on the API's vocabulary.

## What will bite you

- Every serial must be **unique per run** (`uniqueSerial()` produces `ZTG<runId><n>`). Re-using one
  turns a "commission a new pack" test into a "re-commission an existing pack" test, which is a
  different case entirely.
- Validation that IS solid and worth relying on: lot numbers are allow-listed to Latin letters,
  digits and `- . _ /`; a foreign SBDH sender gets `403 "Sender GLN does not match authenticated user
  entity"`; malformed SGLNs are named precisely; `schemaVersion` is pinned to `"2.0"`.
- Nine validation gaps found here are tracked as `test.fail()` — see the filed bugs. The most
  consequential cluster is that **event timestamps are not validated at all**.

## Known defects filed against this feature

- **P1 – Critical** — [Commissioning] An already-commissioned SGTIN can be re-commissioned, and re-commissioning with a different expiry silently overwrites the original
- **P2 – High** — [Commissioning] An empty epcList is accepted, and an empty-string EPC is misclassified as an SSCC
- **P3 – Medium** — [Commissioning] disposition is checked for presence but not validated against the CBV vocabulary
- **P2 – High** — [Commissioning] Event timestamps are not validated — empty and malformed eventTime and eventTimeZoneOffset are accepted

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

- **TC_COMM_003** — How is that positive case ? system should reject an already commissioned pack
- **TC_COMM_005** — what is the diff here ?
- **TC_COMM_006** — what is the diff here ?
- **TC_COMM_007** — what is the diff here ?
- **TC_COMM_010** — Return to dev make sure is this valid case or not as in dashboard you can't with batch no.
- **TC_COMM_011** — how msgquery success and information didn't get updated if so don't return success
- **TC_COMM_012** — same
- **TC_COMM_017** — Could be authenticated without apikey
- **TC_COMM_040** — _Authored, not from the source sheet:_ Source has Steps but empty Expected Results. Recorded Status=Pass, i.e. the platform correctly rejects a foreign sender identifier.
- **TC_COMM_041** — _Authored, not from the source sheet:_ Source has Steps but empty Expected Results. Recorded Status=Fail — the platform currently ACCEPTS a foreign readPoint. Expected Results state the correct behaviour, so the case legitimately fails until fixed.
- **TC_COMM_042** — _Authored, not from the source sheet:_ Source has Steps but empty Expected Results. Recorded Status=Fail — the platform currently ACCEPTS a foreign bizLocation. Expected Results state the correct behaviour, so the case legitimately fails until fixed.

### Verification status

Executed against production on 2026-08-31 (47 automated assertions, `automation-hub/projects/eptts-api-commission/`). 33 pass, 8 fail. The 8 failures are platform validation gaps this run found, all of which the spreadsheet had recorded as Pass. Conversely, five cases the spreadsheet recorded as Fail (TC_COMM_033, 035, 038, 041, 042) now reject correctly and are recorded Pass.
