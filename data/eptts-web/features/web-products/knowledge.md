# web-products — Feature Knowledge

## Why this feature matters

The platform's own view of the registered catalogue. Useful mainly as a cross-check against the Registry portal's Products page and the API — three views of one dataset that must agree.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /masar-service/api/v1/users/me
GET /registry-service/api/v1/products?limit=1
GET /registry-service/api/v1/products?isActive=true&limit=1
GET /registry-service/api/v1/products?isActive=false&limit=1
GET /registry-service/api/v1/products
GET /registry-service/api/v1/entities/manufacturers?limit=500
GET /registry-service/api/v1/entities?type=distributor&limit=500
GET /registry-service/api/v1/products?limit=10&offset=0
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- Also unreachable from the navigation (filed).
- Compare against `registry-service/products`: exactly one record has `gtin` and `name` transposed
  in the API while the Registry UI renders it correctly, so disagreement between views is a live
  possibility here.

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

The source spreadsheet recorded these statuses against **staging**, by a different tester: Under Testing 10. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.
