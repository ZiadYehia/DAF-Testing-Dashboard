# EPTTS APIs — Verified Live Contract

Everything below was **probed against production** (`192.168.225.195`, via Citrix VPN) on
2026-08-31. Where this document and any other source disagree, **this document wins** — the
spreadsheet and the Postman collection both predate the current build and both are wrong in places
noted here.

## Authentication — resolved

```
POST https://192.168.225.195:8445/registry-service/api/v1/auth
Header: apikey: <64-char B2B key>
Body:   optional (see the credential rules below)

200 -> { "access_token": "<jwt>", "refresh_token": "<jwt>",
         "token_type": "Bearer", "expires_in": 900 }
```

| Question | Answer |
|---|---|
| Which auth URL is canonical? | **`:8445/registry-service/api/v1/auth`**. The Postman collection's `:8444/masar-service/api/v1/auth` returns **404 — it does not exist.** |
| Token lifetime | **900 s (15 min).** Any run longer than that must re-authenticate — the helper caches per worker and refreshes 2 min early. |
| Refresh token | Issued, ~7-day expiry. Not yet exercised. |

### The credential rules — subtler than "apikey only"

An earlier reading of this endpoint as *"the body is never read"* was **wrong**. Probed exhaustively:

| Request | Result |
|---|---|
| valid key, no body | `200` |
| valid key, `{}` / `{foo:'bar'}` / `[]` | `200` |
| valid key, `{username, password}` both non-empty and **wrong** | **`401` "Invalid credentials"** |
| valid key, `{username:'', password:'x'}` | `200` — check skipped |
| valid key, `{username:'x'}` (no password) | `200` — check skipped |
| valid key, `{username:null, password:null}` | `200` — check skipped |
| **bad** key + any credentials | `401` |
| **no** key + any credentials | `401` |

So:

1. **A valid `apikey` is mandatory.** No credential pair can substitute for it, so the body can only
   ever narrow access, never widen it. There is no authentication bypass here.
2. **The legacy username/password path is still live**, but engages *only when both fields are
   present and non-empty*.
3. **If either field is empty, null, or absent, the credential check is skipped entirely** and the
   key alone authenticates.

This is why the spreadsheet's note *"In new version, it depends only on apikey"* is true for the
common case yet misleading: several of its cases are meaningful again. `TC_AUTH_006`
(valid key + invalid credentials → 401) is testable **exactly as originally written** and passes.

**PROBABLE DEFECT — rule 3.** `TC_AUTH_007`–`TC_AUTH_010` expected **400** for empty or missing
credential fields; the platform returns **200**. Silently ignoring a half-supplied credential hides
client bugs instead of surfacing them — a caller that fails to populate a password would believe it
authenticated *with* one. The tests assert the real behaviour and name the divergence, so a fix
turns them red. Worth filing.

**No credential pair we hold authenticates.** The devsim *dashboard* logins return `401` here, so the
dashboard (Keycloak) and B2B credential stores are separate. Injection payloads in `username` return
a clean `401` with no SQL detail leaked and no payload echoed back.

B2B access-token claims:

```json
{ "sub": "<partner uuid>", "role": "manufacturer|distributor|pharmacy",
  "entityId": "<uuid>", "entityGln": "<13-digit GLN>",
  "jti": "<uuid>", "source": "b2b", "principalType": "b2b_partner" }
```

### The `apikey` header is NOT needed after `/auth`

Verified across every endpoint: `apikey + Bearer` and **`Bearer` alone behave identically**;
`apikey` alone returns `401`. The API key is a credential used **once** at `/auth` to mint a token —
thereafter only `Authorization: Bearer` is authoritative.

**The Postman collection sends `apikey` on every request.** Harmless, but misleading: a test that
"proves" `apikey` is required on `/scp/SendEPCIS` is asserting something untrue. Any test case whose
objective is *"verify X with a valid/invalid API key in the header"* must target `/auth`, not the
event endpoints.

## Dashboard auth is a completely separate system

The web dashboard uses **Keycloak OIDC**, not the B2B key:

```
realm:  masar          client_id: masar-dashboard
flow:   Authorization Code + PKCE (S256), response_mode=fragment
login:  #username / #password / #kc-login   (standard Keycloak page)
```

**Keycloak direct password grant is disabled** —
`{"error":"unauthorized_client","error_description":"Client not allowed for direct access grants"}`.
Consequence: dashboard automation **must** drive the real browser login; there is no shortcut to a
dashboard JWT. The dashboard JWT carries `aud: ["masar-reporting","masar-api","account"]` and a
custom `entityGln` claim.

## Endpoint guard matrix (verified per role)

`403` = role denied · `400` = role allowed, body rejected · `200` = OK

| Endpoint | Manufacturer | Distributor | Pharmacy |
|---|---|---|---|
| `POST /scp/SendEPCIS` | 400 | 400 | 400 |
| `POST /epcis/json` | 400 | 400 | 400 |
| `POST /MsgStatusQuery` | 400 | 400 | 400 |
| `POST /VerifyProduct` | **200** | **200** | **200** |
| `POST /Dispensation` | **403** | 400 | 400 |  (400 = allowed, body rejected)
| `GET /epcis` | **200** | **200** | **200** |
| `GET /scp/invoices` | **403** | **200** | **200** |

The `403` body names the permitted roles, which makes it directly assertable:

> `Access denied. This endpoint is available to: Pharmacy, SCP branch, SCP, Daf admin, B2B user, pharmacy_admin.`

## Both submission endpoints are live

`POST /scp/SendEPCIS` **and** `POST /epcis/json` both exist and both accept authenticated requests —
neither supersedes the other. They differ in their error envelope (see below), which suggests
different handlers. **Which one the suite should target is still an open question for the PO**; the
specs default to `/scp/SendEPCIS` because that is what the collection and all 348 cases describe.

## Three different error envelope formats

This is a real API-consistency problem and it directly affects how negative assertions are written —
a single shared "expect an error" helper cannot work.

**1. `/scp/SendEPCIS` and `/Dispensation`** — structured EPCIS envelope with an error code:

```json
{ "statustype": "E", "code": 400, "date": "2026-08-31T08:42:28.514Z", "messageid": "",
  "status": { "reason": "Missing SBDH (Standard Business Document Header)", "code": "E003" } }
```

**2. `/VerifyProduct`** — a log list:

```json
{ "logList": [ { "type": "E", "code": "E016", "message": "JSON body must include productId" } ] }
```

**3. `/epcis/json`, `/MsgStatusQuery`, and every registry-service route** — NestJS default:

```json
{ "statusCode": 400, "timestamp": "...", "path": "...", "method": "POST",
  "correlationId": "no-context", "message": "JSON body must include instanceIdentifier",
  "error": "Bad Request" }
```

Known error codes so far: **`E003`** missing SBDH · **`E016`** missing `productId`.

## Accept envelope (the 202 body)

A queued submission answers with an informational envelope, not an empty body:

```json
{ "statustype": "I", "code": 202, "date": "...", "messageid": "<your instanceIdentifier>",
  "status": { "reason": "Message accepted for EPTTS Processing, the message status can be
               viewed in the message status query", "code": "I001" } }
```

So `statustype` is `I` for accepted and `E` for rejected, and `messageid` echoes the
`instanceIdentifier` — useful as a cheap sanity check that the platform read the SBDH.
Known informational code: **`I001`** accepted for processing.

## An empty `eventList` is ACCEPTED (probable defect)

A well-formed envelope carrying **zero events** returns **`202` + `I001`**, not `400`:

```
POST /scp/SendEPCIS  { …valid sbdh…, "epcisBody": { "eventList": [] } }   ->  202 I001
```

An EPCIS document with no events is not meaningful and should be rejected. This is
asserted as-is in `eptts-api-smoke` (`SMOKE-05b`) so that a future fix surfaces as a
failing test rather than passing silently. **Worth filing.**

Contrast with a document that omits the SBDH entirely, which *is* rejected
synchronously with `400` / `E003`.

## `MsgStatusQuery` returns 404, not 200, for an unknown identifier

```
POST /MsgStatusQuery  { "instanceIdentifier": "<unknown>" }
404 -> "No message was found for the provided instance identifier. The message may still be
        initializing. Please retry after 10 seconds and verify the identifier if the issue continues."
```

**The polling helper must treat `404` as "not ready yet" and keep retrying**, not as a failure. The
message itself recommends a 10-second interval. Treating 404 as terminal would make every
asynchronous test fail spuriously.

## `MsgStatusQuery` success shape — the field name is a trap

```json
{ "instanceIdentifier": "ztg-...-0003",
  "messagestatus": "S - Successful",
  "logList": [ { "type": "I", "message": "Commission (Items) event processed successfully" },
               { "type": "I", "message": "Message processed successfully - all 1 event(s) completed" } ] }
```

Two things cost real debugging time here:

1. The field is **`messagestatus` — all lowercase**. A camelCase `messageStatus` lookup misses it
   silently, so the poller sees no state, polls to timeout, and the test fails even though the
   submission *succeeded*. Match status keys case-insensitively.
2. The value is **`"S - Successful"`**, not a bare `SUCCESS`. The leading letter is the
   machine-readable part: `S` success, `E`/`F` failure, `P`/`I`/`Q` still processing.

`logList` carries **per-event** outcomes and is the best source for a failure reason. Assert on it
rather than only on the overall message status — a message can complete while an individual event
inside it fails.

## `VerifyProduct` response shape

Unknown pack — **`200` with `verified: false`**, not a `404`:

```json
{ "verified": false, "sgtin": "urn:epc:id:sgtin:...", "pack": null, "product": null,
  "alerts": ["NOT_FOUND"], "verifiedAt": "..." }
```

Known pack — the `pack` object is the authoritative state source for assertions:

```json
{ "verified": true,
  "sgtin": "urn:epc:id:sgtin:84353083.05448.ZTG...0002",
  "pack": { "sgtin": "...", "gtin": "08435308354487", "serial": "ZTG...0002",
            "batchNumber": "ZTG-...", "expiryDate": "2030-12-31",
            "status": "active", "currentGln": "8435308300002",
            "isRecalled": false, "parentSscc": null, "manufacturerGln": null },
  "product": { "name": "Factor IX Grifols ...", ... } }
```

Notes for writing state assertions:

- **`pack.status` is the lifecycle field, and its vocabulary is lowercase** (`active`, …) — not the
  title-case names the test cases use ("Commissioned", "In transit"). A freshly commissioned pack
  reads `status: "active"`, so assert on `pack.status` values, not on the prose wording.
- **`pack.currentGln`** is how ownership/custody transfer is verified after shipping and receiving.
- **`pack.parentSscc`** confirms aggregation and disaggregation.
- **`manufacturerGln` came back `null`** for a pack whose GTIN belongs to a registered manufacturer.
  Possibly a data gap — worth a closer look, though not blocking.
- Because an unknown pack returns `200`, a test asserting non-existence must check
  `verified` / `alerts`, never the status code.

## `/Dispensation` is asynchronous, but it acknowledges with `200` — not `202`

This entry was wrong on a first pass and is worth stating carefully, because the two halves of
the question have different answers.

**Is it asynchronous?** Yes. A `/Dispensation` response does NOT mean the pack was dispensed.
The outcome only exists after polling `MsgStatusQuery`, exactly as with `/scp/SendEPCIS`.

**What status code does it acknowledge with?** `200`. Not `202`.

```
POST /Dispensation  <valid EPCIS document>
  -> 200                                     <- queued, NOT dispensed
POST /MsgStatusQuery { instanceIdentifier }
  -> 200 { messagestatus: "S - Successful",
           logList: [ { type: "I", message: "Dispensing event processed successfully" } ] }
```

So `/Dispensation` differs from every other submission endpoint here: `/scp/SendEPCIS` and
`/epcis/json` acknowledge with `202`, `/Dispensation` with `200`. Confirmed by four
independent dispensing cases in the full run, each receiving `200` and each then polling to a
real terminal state.

**Why this was initially recorded as `202`.** The source spreadsheet and the vendor collection
both say *"200 Success"*, meaning **synchronously complete**. That framing is wrong, and in
correcting it the status code got swept along with it — the note became "it returns 202 and
must be polled" when the truth is "it returns 200 *and* must be polled". The spreadsheet had
the code right and the meaning wrong.

**What to assert.** Not the status code. A test that asserts `202` fails against the real
platform, and one that reads `200` as success passes while the dispense actually failed —
the worse of the two errors. Assert the polled `messagestatus`, and treat the acknowledgement
as nothing more than "the request was accepted for processing".

## Pack lifecycle — the actual status values

Confirmed by walking one pack through the whole chain and reading `pack.status` after each step:

| After | `pack.status` | `pack.currentGln` |
|---|---|---|
| commissioning | `active` | manufacturer |
| packing (aggregation) | `active` (unchanged; `parentSscc` gets set) | manufacturer |
| shipping | `in_transit` | **still the sender** — custody moves on receipt, not despatch |
| receiving | `active` | the receiver |
| dispensing | `dispensed` | pharmacy |

Two things worth noting:

- **`currentGln` does not change at shipping.** It changes when the receiver posts the receiving
  event. So a test that asserts custody moved immediately after shipping will fail — correctly.
- **`status` returns to `active` after receiving**, it is not a distinct "received" value. Assert
  `in_transit` → `active` plus the `currentGln` change, not a "received" string.

Invalid transitions are refused asynchronously with a precise, assertable message:

```
E - Application Error
logList: [ { type: "E", message: "Dispensing event failed: Invalid status transition for
             urn:epc:id:sgtin:84353083.04888.ZTG...: 'dispensed' → 'dispensed'" } ]
```

## SSCC has two representations and they are NOT interchangeable

- EPCIS events carry the **URN**: `urn:epc:id:sscc:84353083.169538028`
- `VerifyProduct`'s `pack.parentSscc` returns the **18-digit GS1 element string**:
  `184353083695380288`

Per the EPC Tag Data Standard the URN's serial-reference field starts with the extension digit, so
`SSCC-18 = extensionDigit + companyPrefix + restOfSerialRef + mod10CheckDigit`. Comparing the two
forms directly makes a perfectly good aggregation look broken. `ssccUrnToDigits()` / `sameSscc()` in
`automation-hub/lib/eptts-api.ts` do the conversion.

## Dispensing is blocked for Dawana-integrated products

**27 of the manufacturer's 30 products carry `isDawanaIntegration: true`**, and the platform refuses
to dispense those through this API:

> `Dispensing is not allowed for Dawana-integrated products via this channel. These products must be
> dispensed through the Dawana integration.`

This is a legitimate business rule, not a defect — but a dispensing test that picks a GTIN at random
fails for the wrong reason. Only these three are dispensable here:

| GTIN | Product |
|---|---|
| `08435308348882` | Fanhdi 50 IU FVIII / 60 IU VWF per ml (MQ) |
| `08435308348912` | Flebogamma DIF 2.5 g / 50 ml (MQ) |
| `08435308348929` | Human Albumin Grifols 10 g / 50 ml (MQ) |

Commissioning, packing, shipping and receiving are unaffected and work with any of the 30.

## BLOCKER: partial dispensing cannot be tested on this tenant

**Every one of the 30 products has `dispenseType: "full"`.** None is registered for partial or unit
dispensing, so the platform has nothing to partially dispense. The whole
**`api-partial-dispensing` feature (36 cases) is unexecutable against devsim** no matter how the
tests are written — this is a test-data gap, not a code problem.

To unblock it, a product must be registered with a partial/unit `dispenseType` (Registry portal →
Products), or the feature must be tested on a tenant that already has one.

## TS_RECV_001 (DW-878) now passes

The spreadsheet records `TS_RECV_001` — a branch receiving a complete shipment from the manufacturer
— as **failing** against `DW-878`. Walked end to end on 2026-08-31 it **succeeds**: the SSCC and its
child move `in_transit` → `active` and `currentGln` transfers to the branch. Either the defect was
fixed or it was environment-specific to staging. Worth confirming with the DW-878 owner before the
ticket is closed on this evidence alone.

## devsim tenant — actual identities

| Role | Account | GLN | Entity | B2B key |
|---|---|---|---|---|
| admin | `admin@devsim.local` | `9999999999999` | Masar Platform Pilot | n/a |
| manufacturer | `manufacturer@devsim.local` | `8435308300002` | INSTITUTO GRIFOLS, S.A. | `EPTTS_MFG_APIKEY` |
| distributor | `distributor@devsim.local` | `0085412000008` | Baxter International Inc. | `EPTTS_BRANCH_APIKEY` |
| pharmacy | `pharmacy@devsim.local` | `1234567890128` | test pharmacy | `EPTTS_PHARMACY_APIKEY` |

All three B2B keys were **rotated on 2026-08-31** to obtain them (the platform cannot display an
existing key — only replace it). They are 64-char hex, stored in `automation-hub/.env`, and **cannot
be recovered from the platform**: if `.env` is lost they must be rotated again.

The manufacturer's GLN `8435308300002` supersedes the spreadsheet's `5413868000009`. The
distributor/branch and pharmacy GLNs above supersede `6224010009998` / `9506000140476` and
`6221385005587` / `6224010005228` respectively.

Note the role vocabulary: the platform has **no `branch`-role users** (0 of them). Branch behaviour
is carried by the **`distributor`** role, even though `branch` exists as an *entity type* (8 entities).
Test cases written as "Authenticated as Branch" map to `distributor`.

## Real catalogue data (replaces the spreadsheet's placeholder GTINs)

Confirmed products: `00300020007554` Human Insulin · `00300020012558` Fluoxetine ·
`05000456010870` budesonide micronized · `05415062126240` ABRYSVO 120mcg ·
`08718692511262` OMNIC ocas · `06290000000016`.

Platform scale: **1,707,149 packs** — 1,683,142 active, 24,002 dispensed, 5 in transit.
Our manufacturer already has real EPCIS history (`GET /epcis` shows `COMMISSION_ITEMS` + `PACKING`
messages from INSTITUTO GRIFOLS with 2,085 items each).

## Registry-service API surface (extracted from the portal's JS bundle)

```
GET    /entities                              GET    /products
POST   /entities/{id}/activate                POST   /products
POST   /entities/activate-all[?type=]         PUT    /products/{gtin}
GET    /master-data/versions                  POST   /products/{id}/activate|deactivate
                                              GET    /products/{gtin}/price-history
GET    /users?entityId=                       POST   /admin/mdm/upload
POST   /users                                 POST   /admin/mdm/seed-from-existing
PUT    /users/{id}/email
PUT    /users/{id}/password                   POST   /b2b/partner/generate-key
POST   /users/{id}/activate|deactivate        POST   /b2b/partner/regenerate-key
DELETE /users/{id}                            POST   /b2b/partner/branch/{gln}/regenerate-key
                                              POST   /admin/b2b-partners/by-gln/{gln}/regenerate-key
```

## Defects and open questions found during recon

1. **`PUT /users/{id}/password` returns `503`** —
   *"Could not update the password in Keycloak — no change was made."* Reproducible for both
   `distributor@devsim.local` and `pharmacy@devsim.local` as admin. The platform's Keycloak
   password-update integration is broken. **Blocks dashboard testing as the distributor and pharmacy
   roles** (the API path is unaffected). Worth filing.
2. **Product data is field-swapped in `GET /registry-service/api/v1/products`** — e.g.
   `{"gtin":"Temodal 100 mg","name":"00366582511120"}`. The GTIN field holds the product name and
   vice-versa, on at least some rows.
3. **Most dashboard nav items navigate nowhere.** Product Movement, Product Structure, Product
   Actions, File Upload, Monitoring, and External Portals all silently fall back to
   `/information-center` when clicked. Master Data and Reports are reachable only by typing the URL
   (`/master-data`, `/reporting`), not from the menu.
4. **Three inconsistent error envelopes** across endpoints (documented above).
5. **Open question for the PO:** is `/scp/SendEPCIS` or `/epcis/json` the intended submission
   endpoint? Both are live and they behave differently on malformed input.
6. **`GET /masar-service/api/v1/master-data/snapshot/latest` is `404`.** Master data lives on
   registry-service (`/master-data/versions`), not masar-service as the collection states.

## Tooling gotchas (cost real time; documented so they don't recur)

1. **Playwright `baseURL` + a leading-slash path silently drops the base path.**
   Playwright resolves request paths with `new URL(path, baseURL)` semantics, so
   baseURL `…/registry-service/api/v1` plus path `/auth` requests
   `https://host/auth` — which nginx answers with **405**, a confusing symptom.
   `automation-hub/lib/eptts-api.ts` therefore sets **no** `baseURL` and builds
   absolute URLs.
2. **The hub's `actionTimeout: 15_000` also applies to `APIRequestContext` calls.**
   `MsgStatusQuery` against a just-submitted message can exceed it, and the
   platform's own 404 body suggests retrying after 10 s. The helper passes an
   explicit per-request timeout (`EPTTS_API_TIMEOUT_MS`, default 45 s) instead of
   loosening `actionTimeout`, which would slacken every other app's UI specs.
3. **The `apikey` appears in Playwright's call log**, so a failed `/auth` prints the
   raw key to stdout and into `trace.zip`. `test-results/` and each project's
   `runs/` folder are gitignored, so nothing is committed — but do not paste raw run
   output or share a trace externally.
4. **Keycloak direct password grant is disabled**, so dashboard automation must drive
   the real browser login. There is no shortcut to a dashboard JWT.
5. **The self-signed certificate breaks every client by default.** Playwright needs
   `ignoreHTTPSErrors: true` (including in `browser.newContext()`, which does *not*
   inherit it from the config's `use` block), the Playwright MCP server needs
   `--ignore-https-errors`, curl needs `-k`, and Postman needs SSL verification off.
6. **A `*/` inside a block comment terminates it early.** Writing a glob such as
   `projects/*/runs/` inside a JSDoc comment silently broke parsing of the whole
   file, with errors reported dozens of lines later. Avoid globs in block comments.

# Commission suite — executed against production 2026-08-31

47 tests, all green (9 of them are tracked expected-failures). Two categories of result matter.

## Five previously-recorded defects are FIXED

The spreadsheet recorded these as `Fail`. They now reject correctly, with good messages:

| Case | What | Platform response now |
|---|---|---|
| `TC_COMM_033` | empty `disposition` | `EPCIS event #0 is missing mandatory field(s): disposition` |
| `TC_COMM_035` | `schemaVersion: "9.9"` | `400 E003` — `Mandatory Field schemaVersion must be "2.0", got "9.9"` |
| `TC_COMM_038` | empty `bizLocation.id` | `missing mandatory field(s): bizLocation.id` |
| `TC_COMM_041` | foreign `readPoint` | rejected |
| `TC_COMM_042` | foreign `bizLocation` | rejected |

Also confirmed working well: `TC_COMM_040` foreign SBDH sender →
`403 "Sender GLN does not match authenticated user entity"`, and malformed SGLNs →
`Invalid location identifier "NOT-AN-SGLN". Expected a canonical SGLN URN … or a 13-digit GLN`.

## NINE validation gaps found — all recorded `Pass` in the spreadsheet

Each returns `202` then `messagestatus: "S - Successful"`. These are new findings; the sheet says
they pass, and they do not.

| Case | Input | Why it matters |
|---|---|---|
| `TC_COMM_003` | re-commission an existing SGTIN | **Serialisation integrity.** The same serial can be re-declared at will. The reviewer who questioned the sheet's "Positive" classification was right. |
| `TC_COMM_012` | re-commission with a *different expiry* | **Worse:** silently rewrites an existing pack's expiry date. |
| `TC_COMM_004` | `epcList: []` | An event with zero EPCs succeeds; the log even omits the `Commission (Items)` line. |
| `TC_COMM_004b` | `epcList: [""]` | Accepted **and misclassified** — the log says `Commission (SSCCs) event processed successfully`. An empty string is parsed as an SSCC: an EPC-parsing bug, not just a missing length check. |
| `TC_COMM_025` | empty `eventTime` | No timestamp validation. |
| `TC_COMM_026` | `eventTime: "05-05-2026 10:00"` | Non-ISO-8601 accepted. |
| `TC_COMM_027` | empty `eventTimeZoneOffset` | Accepted. |
| `TC_COMM_028` | `eventTimeZoneOffset: "+99:99"` | Nonsense offset accepted. |
| `TC_COMM_034` | `disposition: "teleported"` | Presence is checked (`TC_COMM_033` is refused) but the value is never checked against the CBV vocabulary, so any string passes. |

The event-time cluster (`025`–`028`) is one root cause: **`eventTime` and `eventTimeZoneOffset` are
not validated at all.** For a traceability system whose entire value rests on a defensible event
chronology, that is the most consequential of the nine.

These carry `test.fail()` in `automation-hub/projects/eptts-api-commission/`, so the suite stays
green while the gaps exist and reports an "unexpected pass" the moment any is fixed.

## Input validation that IS solid

- Lot numbers are allow-listed: `ILMD cbvmda:lotNumber "<script>alert(1)</script>" is invalid — must
  contain only Latin letters, digits, or the separators - . _ /`. Both SQL-injection and XSS payloads
  are refused, with no database internals leaked. Quoting the rejected value back inside a JSON error
  is correct and is not an XSS vector.
- Re-commissioning with a different *batch* is refused (`Document rejected before any chunk was
  committed — 1 unpersistable row(s)`), which makes the *expiry* variant (`TC_COMM_012`) being
  accepted look like an oversight rather than a deliberate difference.
- Role separation holds: a branch or pharmacy cannot commission.
