# api-shipping — Feature Knowledge

## Why this feature matters

Shipping transfers custody and is the busiest feature in the module. It carries the richest request body — the only event with `sourceList`, `destinationList` and a `bizTransactionList` invoice reference — which gives it the largest mandatory-field surface and therefore the most negative cases.

## Contract specifics

- `ObjectEvent`, `action: OBSERVE`, `bizStep: shipping`, `disposition: in_transit`.
- **Custody does not move at shipping.** `pack.status` becomes `in_transit` but `pack.currentGln`
  stays with the *sender*; it changes only when the receiver posts the receiving event. A case that
  asserts custody moved right after shipping fails correctly.
- Routes are distinct authorization paths and each needs coverage: manufacturer→branch,
  branch→branch, branch→pharmacy.
- Return shipping reuses this shape with `disposition: returned`.

## What will bite you

- `TC_SHIP_025`–`TC_SHIP_044` were **empty reserved ID slots** in the source spreadsheet (an ID and
  `Validity: Negative`, nothing else). They have been authored here; see
  `scripts/eptts-web-api-overrides.json` for provenance.
- Ownership failures are **asynchronous**: shipping an EPC owned by another GLN returns `202` and only
  reports `FAILED` on polling. Do not expect a synchronous 403.
- The branch role is the platform's `distributor` role — there are zero `branch`-role users.

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

- **TC_SHIP_025** — _Authored, not from the source sheet:_ Empty reserved slot. Continues the mandatory-field sequence begun at TC_SHIP_020.
- **TC_SHIP_026** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_027** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_028** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_029** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_030** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_031** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_032** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_033** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_034** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_035** — _Authored, not from the source sheet:_ Empty reserved slot. Format-validation variant.
- **TC_SHIP_036** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_037** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_038** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_039** — _Authored, not from the source sheet:_ Empty reserved slot.
- **TC_SHIP_040** — _Authored, not from the source sheet:_ Empty reserved slot. GLN-ownership negative — the platform's most important authorization rule.
- **TC_SHIP_041** — _Authored, not from the source sheet:_ Empty reserved slot. Role-authorization negative.
- **TC_SHIP_042** — _Authored, not from the source sheet:_ Empty reserved slot. Idempotency/replay negative.
- **TC_SHIP_043** — _Authored, not from the source sheet:_ Empty reserved slot. Content-type negative.
- **TC_SHIP_044** — _Authored, not from the source sheet:_ Empty reserved slot. Security negative.

### Verification status

**Not yet executed against production.** Every case is `Under Testing` / `new_added`.

The source spreadsheet recorded these statuses against **staging**, by a different tester: Fail 8, Pass 16, Under Testing 20. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.
