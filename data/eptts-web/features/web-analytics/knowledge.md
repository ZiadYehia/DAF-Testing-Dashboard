# web-analytics — Feature Knowledge

## Why this feature matters

Four views over the same traceability data. **Expiry risk** is the commercially significant one — it drives write-off decisions, so a wrong expiry-risk figure has direct financial consequence.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/reports/activity
GET /masar-service/api/v1/reports/inventory?limit=100&offset=0
GET /masar-service/api/v1/reports/inventory-summary
GET /masar-service/api/v1/reports/shipments
GET /masar-service/api/v1/reports/expiry-risk?withinDays=90
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- Tabs (Activity, Inventory, Shipments, Expiry risk) each load their own endpoint; assert a tab does
  not display the previous tab's data.
- `reports/expiry-risk?withinDays=90` is parameterised — vary `withinDays` and confirm the result set
  actually changes.

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
