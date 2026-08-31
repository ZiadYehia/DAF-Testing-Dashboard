# registry-register-pharmacy — Feature Knowledge

## Why this feature matters

The widest input surface in the product — 25 fields — which makes it the highest-value target for mandatory-field and format-validation testing, and the place where a validation gap is most likely to let bad master data in.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /registry-service/api/v1/geography/areas
GET /registry-service/api/v1/admin/mdm/products?limit=50
GET /registry-service/api/v1/geography/governorates
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- Creating a pharmacy is a **write to the production registry**. Prefer validation-failure cases,
  which exercise the form without persisting anything.
- GLN check-digit validation is the highest-value single check: a pharmacy with an invalid GLN
  corrupts every downstream event addressed to it.

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

### Verification status

**Not yet executed against production.** Every case is `Under Testing` / `new_added`.

The source spreadsheet recorded these statuses against **staging**, by a different tester: Under Testing 6. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.
