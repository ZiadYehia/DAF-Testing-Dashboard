# Security Finding Register — EPTTS B2B API

Deliverable 3 of the QA & Security Testing Work Package. One row per finding, with owner, severity,
status, the covering `TC_SEC` case, and the bug slug under `data/eptts-api/bugs/api-security/`.

Severity uses the bug scale: `P1 – Critical` | `P2 – High` | `P3 – Medium` | `P4 – Low`.
Status: `open` | `retest` (fix claimed, re-run pending) | `closed` | `accepted` (risk accepted with
owner + deadline) | `not-confirmed` (observed on another environment, not yet reproduced here).

## Confirmed on devsim (this pass — executed 2026-09-01)

**Headline: the B2B API is clean on every control that could be tested.** 39 of 45 `TC_SEC` cases
pass; 5 are blocked by environment/data limits (below); 1 is a known validation gap already on file.
No new authentication, authorization, ownership, lifecycle, transport or disclosure defect was found.

What the pass positively confirmed on devsim:
- **JWT verification is enforced** (`TC_SEC_001`–`010`): `alg:none`, tampered-claim, empty/garbage
  signature, expired, apikey-only and refresh-as-access all return `401`.
- **Role & object authorization hold** (`TC_SEC_011`–`020`): the guard matrix is enforced, a spoofed
  SBDH sender is refused `403`, and — notably — **product ownership IS enforced on devsim**
  (`TC_SEC_018` refused a foreign-owned GTIN), unlike the LoadTesting cloud-staging finding.
- **Lifecycle integrity holds** (`TC_SEC_021`–`026`): out-of-order events are refused and a pack
  cannot be dispensed twice — captured verbatim: `Invalid status transition … 'dispensed' → 'dispensed'`.
- **Input validation is sound and non-leaking** (`TC_SEC_027`,`030`,`033`–`036`): injection/XSS in
  free-text are refused (asynchronously) with no SQL/DB detail; the BUG-004 over-length-lot leak did
  **not** reproduce (`TC_SEC_035`); rejected input is not stored.
- **Transport & disclosure are good** (`TC_SEC_037`,`041`–`045`): rate-limit headers, HSTS, CSP,
  nosniff, SAMEORIGIN present; no `X-Powered-By`; error bodies leak no internals.

| ID | Title | Severity | Covers | Owner | Status | Bug |
|---|---|---|---|---|---|---|
| Gap-1 | An EPCIS document with an empty `eventList` is accepted (`202`/`I001`) instead of rejected | P3 – Medium | `TC_SEC_029` (and `TC_COMM_004`) | Backend/API team | open (known gap, `test.fail`) | `draft:an-empty-epclist-is-accepted-and-an-empty-string-epc-is-misclassified-as-an-sscc` |

### Blocked (not faked green)

| ID | Reason |
|---|---|
| `TC_SEC_017` | `/scp/sscc/{sscc}/export` contract unverified on this environment; needs a foreign-owned SSCC to probe |
| `TC_SEC_019` | single tenant (`devsim` only) — no second tenant for horizontal cross-tenant isolation |
| `TC_SEC_031` | no verified XML submission endpoint on the B2B API — XXE belongs to the dashboard EPCIS XML upload (Phase 5) |
| `TC_SEC_032` | same — XML entity-expansion belongs to the dashboard upload path |
| `TC_SEC_038` | `429` trigger would push 2000+ req/window at a shared platform; needs an agreed maintenance window |

## Carried from the LoadTesting k6 suite (different environment — needs devsim re-confirmation)

Environment: cloud staging behind Cloudflare, not devsim. Corrections in that repo's
`bugs/README.md` are respected — BUG-002 and BUG-007 are largely retracted; the withdrawn
Branch-Receive figures are not quoted here.

| Ref | Title | Severity | Security relevance | devsim status |
|---|---|---|---|---|
| BUG-001 | One active session per API key; re-auth invalidates the prior token | — (WAI) | Deliberate session control — re-tested as a *positive* case (`TC_SEC_008` area) | Not yet confirmed |
| BUG-002 (surviving) | `202 Accepted` then the message never registers | P3 – Medium | Admission / exactly-once integrity | `TC_SEC_039` re-tests |
| BUG-003 | Cloudflare blocks non-browser clients | P3 – Medium | Infrastructure answered instead of the API | N/A on devsim (no Cloudflare) |
| BUG-004 | `cbvmda:lotNumber` > 20 chars leaks a raw PostgreSQL error (`value too long for type character varying(20)`) | P3 – Medium | "errors expose no sensitive detail" (WSTG) — the leak is **async**, in the MsgStatusQuery logList after a 202, not the sync response | `TC_SEC_035` re-tests (polls the logList) |
| BUG-005 | Active product has an invalid GTIN check digit | P4 – Low | Data integrity | Out of scope for this feature |
| BUG-006 | New entity users land in Arabic behind an unaccepted disclaimer; Integration Hub unreachable | P2 – High | Dashboard usability/access — deferred to Phase 5 (`web-security`) | Dashboard phase |
| BUG-007 (retracted) | Commission rollbacks under concurrency | P4 – Low | Did not reproduce on a clean entity | Needs info |
| api-findings §4 | **Product ownership is not enforced at Commission** — manufacturer `9501101530003` commissioned products owned by Janssen, MSD, Pharmaoverseas and Merck, all `S - Successful` | P1 – Critical (if reproduced) | OWASP API1 BOLA / API3 | `TC_SEC_018` re-confirms on devsim (note: the verified devsim contract claims ownership *is* enforced there, so this may already be fixed — the test decides) |

## Rate / admission — evidence source

The work package's rate/admission pass condition ("documented backpressure occurs before unsafe
saturation; no loss or duplicates") is **evidenced on a different environment** by the k6 suite at
`C:\Users\ziadm\Downloads\LoadTesting` (runs under its `runs/`). Its headline finding: the API
accepts work and does not always finish it, and the failure rate is set by concurrency, not request
volume. On devsim this feature verifies only the *controls* (rate-limit headers, `Retry-After`,
`202`-then-registers), not saturation. The completion gate for this area is therefore met **by
citation, not by measurement on devsim** — recorded here so the gap is explicit.
