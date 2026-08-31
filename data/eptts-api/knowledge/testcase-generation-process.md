# Test-Case Generation Process

## Inputs

Read in this order, and prefer the earlier source when two disagree:

1. **Live behaviour** — a probe against `https://192.168.225.195:8444` (curl for API, Playwright MCP
   snapshot for dashboard). The running system outranks every document.
2. The feature's own `workflow.md` and feature knowledge.
3. `modules/eptts-apis/knowledge/module-overview.md` — endpoint map, auth model, async contract.
4. `Masar B2B API — Role Scenarios.postman_collection.json` — authoritative request/response shapes.
5. `EPTTS - API TEST CASES.xlsx` — the historical suite; the source of the API cases' IDs and intent.
6. `API_DOCUMENTATION_-_EPTTS.pdf` — lowest priority. It is a Word export with subset-embedded fonts
   and is not machine-readable without a text-extraction tool.

When a document and the live system disagree, **write the case against live behaviour and record the
discrepancy** in the feature's `## Notes & Known Defects` section. Do not silently pick one.

## Method

1. Restate each acceptance criterion / documented behaviour as one or more independently verifiable
   scenarios. One case verifies one behaviour.
2. For every scenario add the negative, boundary, and permission variants — see the coverage order
   below.
3. Map each case back to the Feature ID it covers, in the `Feature ID` column.
4. For asynchronous API endpoints, every case must assert the **full chain**
   (`202` → `MsgStatusQuery` = `SUCCESS` → resulting pack state). A case that stops at the
   acknowledgement is not finished.
5. Never invent a test-data value that has to exist in the system. Either generate it inside the test
   (commission a fresh SGTIN) or reference a real catalogue entry confirmed in Phase 2 recon.

## Coverage order (API features)

Generate cases in this fixed order so files stay comparable across features:

1. **Happy path** — the documented request with a valid body, asserted through to final pack state.
2. **Multi-entity** — several EPCs in one `epcList`; batch behaviour is a distinct code path.
3. **Variation** — SGTIN vs SSCC; JSON (EPCIS 2.0) vs XML (SOAP/EPCIS 1.2); nested aggregation.
4. **Downstream effects** — the event appears in `GET /epcis`; `VerifyProduct` reflects the new state;
   invoice/SSCC export contains it.
5. **Idempotency & replay** — re-submitting the same `instanceIdentifier`; re-submitting the same
   event with a fresh identifier.
6. **Authentication** — missing `apikey`; invalid `apikey`; missing `Authorization`; expired token;
   malformed token.
7. **Authorization** — a role performing an operation reserved for another (a pharmacy attempting to
   commission); acting on an EPC owned by a different GLN; a POS integrator with a mismatched
   `actingOnBehalfOfGln`. **GLN ownership is the most important rule in the system — every write
   feature needs at least one wrong-GLN case.**
8. **Mandatory field validation** — one required field omitted per case (`epcList`, `eventTime`,
   `bizStep`, `action`, `sbdh.sender`, `instanceIdentifier`, …).
9. **Format & range validation** — malformed SGTIN/SSCC/GLN URNs; wrong check digit; bad date format;
   negative or zero quantity; quantity exceeding pack contents; unregistered GTIN.
10. **State-machine validation** — every invalid transition the lifecycle forbids: commissioning an
    already-commissioned pack, shipping a pack already in transit, receiving a pack never shipped,
    dispensing a destroyed pack, unpacking from an SSCC that does not contain the child.
11. **Content-type & payload** — `Content-Type` mismatched against the body; empty body; malformed
    JSON/XML; oversized `epcList`.
12. **Security** — SQL injection and XSS strings in string fields; XML external entity (XXE) in the
    SOAP variant; whitespace-only values; max-length overflow.

## Coverage order (dashboard features)

1. **Render & navigation** — the page loads, its heading and primary controls are present, navigation
   in and back works, deep-linking the URL works.
2. **Core positive** — the page's main action, end to end.
3. **Variation positive** — alternate valid inputs, filters, sort orders, pagination.
4. **Downstream effects** — the change persists after refresh, appears in listings, and is reflected
   through the API (this is what ties a dashboard feature to its API feature).
5. **Empty, loading, and error states** — no data, slow response, backend `5xx`.
6. **Mandatory field validation** — one required field left empty per case.
7. **Format validation** — invalid GLN/GTIN check digits, bad dates, out-of-range numbers.
8. **Permissions & role isolation** — the other role cannot see or reach this page; a tenant cannot
   see another tenant's data; direct URL access is blocked, not merely hidden from the menu.
9. **Session** — expired session, logout, back-button after logout.
10. **Security** — XSS in any field rendered back to the page; injection in search/filter inputs.

## Coverage target

Every documented behaviour is covered by at least one positive and one negative case. Every write
operation has a wrong-GLN case and an invalid-state case. Every asynchronous endpoint has at least
one case that proves the `MsgStatusQuery` failure path, not only `SUCCESS`.

Cross-link the two halves: a dashboard feature's knowledge names the API feature its actions call,
and an API feature's workflow names the dashboard page that configures its prerequisites. Coverage of
one surface is not coverage of the other, but a gap in one usually predicts a gap in the other.
