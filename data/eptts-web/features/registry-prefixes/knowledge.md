# registry-prefixes — Feature Knowledge

## Why this feature matters

GCP length here decides how every EPC for that partner is decoded. A wrong prefix does not fail loudly — it silently mis-parses SGTINs and SSCCs across the whole platform, which makes this small page disproportionately important.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /registry-service/api/v1/admin/mdm/prefixes?limit=50
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- Cross-check a prefix against a real EPC: GTIN `08435308354487` with GCP length 8 must yield
  `urn:epc:id:sgtin:84353083.05448.<serial>`. If the prefix is wrong the URN is wrong and
  commissioning fails with a confusing error far from the cause.

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

The source spreadsheet recorded these statuses against **staging**, by a different tester: Under Testing 8. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.
