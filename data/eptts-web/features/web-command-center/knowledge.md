# web-command-center — Feature Knowledge

## Why this feature matters

The national operations overview, and the first page a regulator looks at. Wrong numbers here are worse than a broken page, because a broken page is obvious and a wrong number is believed. Every figure traces back to EPCIS events, so a discrepancy is either an aggregation bug or a real traceability gap — both worth chasing.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/reports/dashboard-kpi
GET /masar-service/api/v1/reports/partner-analytics
GET /masar-service/api/v1/reports/activity
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- Cross-check the headline figures against the API rather than trusting the page: `reports/dashboard-kpi`
  returned `active: 1,683,142`, `dispensed: 24,002`, `in_transit: 5`, `total_packs: 1,707,149` at
  discovery. A UI/API mismatch is the defect worth finding here.
- `total_products: 6` in the KPI payload while the registry holds far more — investigate what that
  figure actually counts before reporting it as wrong.

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

The source spreadsheet recorded these statuses against **staging**, by a different tester: Under Testing 7. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.
