# api-security — Feature Knowledge

## Why this feature matters

The other eleven API features verify that the supply chain functions. This one verifies that it
refuses what it must. A traceability platform whose entire value rests on a defensible event
chronology and a trustworthy custody chain fails silently if a forged token is honoured, a role
acts outside its authority, or one entity can read or rewrite another's packs. This feature is the
security cross-cut across all of them, mapped to the QA & Security Testing Work Package's six
control areas.

## Scope and authorization

- **Environment:** Masar Platform, `https://192.168.225.195:8444` (masar-service) and `:8445`
  (registry-service), tenant `devsim`, reached over Citrix VPN, self-signed TLS. This is the same
  environment the existing functional suites target and, per
  `data/eptts-api/knowledge/testcase-writing-rules.md`, is treated as the production target.
- **Authorization:** internal QA security testing under the work package
  `01_QA_Security_Testing_Work_Package.md`. Boundary (from that document): "Internal testing and
  remediation prepare the product; formal penetration-test certification and final retesting remain
  independent." No production secrets or unredacted sensitive data are placed in `data/`.
- **Test window / owner:** _to be confirmed with the platform owner before any state-writing or
  rate case is executed._ Read-only cases (auth, authz-guard, transport/disclosure) are safe to run
  at any time; lifecycle, input and duplicate-event cases write state and are tagged accordingly.
- **Rate/admission:** no load is generated against devsim. Header-level controls are verified here;
  saturation evidence is cited from the separate k6 suite (below).

## Contract specifics this feature relies on

Verified live on 2026-09-01 (see `data/eptts-api/modules/eptts-apis/knowledge/verified-live-contract.md`):

- Tokens are **HS256**-signed with a server-side secret. JWT verification is **enforced**:
  `alg:none`, tampered-claim-with-original-signature, empty signature, garbage signature, expired,
  no-Authorization and apikey-only all return **`401`** on `POST /VerifyProduct`. This is why the
  `TC_SEC_001`–`010` cluster asserts correct behaviour as *positive* cases rather than expected
  failures.
- Every response carries rate-limit headers (`x-ratelimit-limit: 2000`, `-remaining` decrementing,
  `-reset`) and a full security-header set (HSTS, CSP, `x-content-type-options: nosniff`,
  `x-frame-options: SAMEORIGIN`, `referrer-policy: no-referrer`, `cross-origin-opener-policy`,
  `x-permitted-cross-domain-policies`). `server: nginx` with no version; **no `x-powered-by`**.
- The role-by-operation guard matrix and the `403` role-list body are in `role-inventory.md`.

## What will bite you

- **Header duplication.** `x-content-type-options` comes back as `nosniff, nosniff` and HSTS is
  emitted twice — nginx and the app both set them. Harmless but a hygiene note (P4), not a control
  failure; do not assert a single value, assert the header *contains* the expected token.
- **Three error envelopes.** `/scp/SendEPCIS` and `/Dispensation` use `{statustype:"E", status:{code}}`;
  `/VerifyProduct` uses `{logList:[...]}`; registry-service and `/epcis/json`/`/MsgStatusQuery` use
  the NestJS default `{statusCode, message, error}`. A disclosure assertion must scan the whole body
  string, not one field.
- **`202`/`200` is not success.** `/scp/SendEPCIS` acknowledges `202`, `/Dispensation` `200`; both
  are async. Assert the polled `messagestatus`, not the acknowledgement.
- **`VerifyProduct` returns `200` for an unknown pack** (`verified:false`, `alerts:["NOT_FOUND"]`),
  so a non-existence assertion checks `verified`/`alerts`, never the status code.

## Known defects filed against this feature

Executed 2026-09-01: **39 pass, 5 blocked, 1 known-gap; no new security defect**. The one gap —
`TC_SEC_029`, an empty `eventList` accepted (`202`/`I001`) instead of rejected — is the same platform
validation gap already filed under `api-commission`
(`draft:an-empty-epclist-is-accepted-and-an-empty-string-epc-is-misclassified-as-an-sscc`), whose
coverage line now also lists `TC_SEC_029`, so no duplicate bug was raised. See `finding-register.md`
for the full result and the LoadTesting carry-over.

Notable positive confirmations on devsim, contrary to the LoadTesting cloud-staging findings:
the **over-length lot number does NOT leak a raw DB error** (`TC_SEC_035`), and an earlier pass
showed **product ownership enforced** at commission. Worth re-checking with the platform owner
before closing the corresponding staging tickets.

**Second entities (2026-09-02).** A second independent entity of each role — the `EF` set
(`ef_manufacturer` 7910000000005, `ef_distributor` 5413868000108, `ef_pharmacy` 6220000000013),
wired into `automation-hub/lib/eptts-api.ts` — lets horizontal isolation be tested for real.
`TC_SEC_019` (cross-entity read isolation) passes. Five cross-entity *write* cases (`TC_SEC_017`,
`018`, `046`, `047`, `048`) are complete and wired to the EF accounts but are blocked by a live
**EPCIS storage outage** (`POST /scp/SendEPCIS` → `503 E003 "durable object storage not confirmed"`
after ~60 s). Re-run all five — plus `TC_COMM_001`, blocked by the same outage — once the write path
recovers. The read surfaces (`/epcis`, `/scp/invoices`, `/VerifyProduct`) are unaffected.

## The single-tenant limitation

`devsim` is the only tenant. Horizontal cross-tenant isolation cannot be tested here; those cases
(`TC_SEC_019` and any cross-tenant variant) are `Blocked/Skipped` with the reason recorded, and the
work package's "all tenants covered" gate is reported **not met on this environment**. Vertical
authorization (role boundaries within the tenant) and object-ownership *are* fully testable and are
covered.

## Rate/admission evidence — the k6 suite

Progressive-burst, concurrency and reconciliation testing was done by the load-testing project at
`C:\Users\ziadm\Downloads\LoadTesting` (k6 + Playwright provisioning). Its central result: the API
accepts work and does not always finish it, and the failure rate is set by concurrency rather than
request volume or latency — a p95 of 164 ms against a 2000 ms target while completing 0.63 % of
journeys end to end. That evidence was gathered on cloud staging behind Cloudflare, **not devsim**,
so it is cited, not re-run here. Respect its own corrections: BUG-002 and BUG-007 are largely
retracted.

## Case history and provenance

### Notes & Known Defects

- `TC_SEC_001`–`010` (auth/session): all verified **passing** during Phase 0 recon on 2026-09-01 —
  the platform enforces JWT verification and expiry correctly. Recorded as positive cases.
- `TC_SEC_011`–`013` (role matrix): rows taken from the verified live contract's guard matrix and
  re-executed as assertions.
- `TC_SEC_018` (product ownership): promoted from the LoadTesting `test-catalog.md` journey finding;
  re-confirmed against devsim.
- `TC_SEC_029` (empty `eventList` accepted) and `TC_SEC_035` (`lotNumber` length leak): known/likely
  gaps, asserted as correct behaviour with `expectFail` so a fix surfaces loudly.
- Cross-tenant, `429`-trigger and cross-pharmacy-pack cases without suitable test data are
  `Blocked/Skipped` with reasons — never faked green.

### Verification status

First authored 2026-09-01 from live recon. Execution results land in `execution-status-v1.json`
(source of truth) and are synced into the table's Status column by
`scripts/eptts-sync-testcase-status.js`.
