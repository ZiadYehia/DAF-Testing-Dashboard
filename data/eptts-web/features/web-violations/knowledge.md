# web-violations — Feature Knowledge

## Why this feature matters

Drives regulatory follow-up. A violation that fails to appear is a compliance failure, not a display bug, which is why the empty state deserves suspicion: at discovery every severity bucket read zero, and "no violations" and "violations not loading" look identical.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/reports/violations
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- All buckets were 0 in devsim. Before accepting that, confirm `reports/violations` really returns an
  empty set rather than failing silently.

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
