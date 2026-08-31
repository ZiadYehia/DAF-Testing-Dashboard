# web-audit-console — Feature Knowledge

## Why this feature matters

The evidence record. It must be complete, immutable and attributable — those three properties are the feature. It also ships a **"What is not recorded?"** disclosure, which is itself a testable claim: verify the disclosure matches what the system actually omits.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/audit/regulatory?limit=25&page=1&sortBy=eventTime&sortOrder=DESC
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- Four tabs: Regulatory events, EDA submissions, Master-data changes, Integrity.
- `audit/regulatory` returns real entries with `auditKey`, `eventType`, `severity`, `entityGln`,
  `userId`. Cross-check that an action taken through the API appears here — a missing audit entry is
  the highest-value defect this page can surface.
- Immutability matters: confirm no UI path edits or deletes an audit row.

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
