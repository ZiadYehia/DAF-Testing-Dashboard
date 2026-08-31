# registry-products — Feature Knowledge

## Why this feature matters

Two fields on this page directly control API behaviour, which makes it a test-data control panel as much as a catalogue: `dispenseType` decides whether partial dispensing is possible at all, and the Dawana flag decides whether a product can be dispensed through the B2B API.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /registry-service/api/v1/admin/mdm/products?limit=50
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- **Both API dispensing blockers originate here.** All 30 devsim products are `dispenseType: "full"`
  (so partial dispensing is untestable) and 27 of 30 are Dawana-integrated (so undispensable via the
  API). Fixing the test-data gap means adding a product here.
- One record has `gtin` and `name` transposed in the API response while this page renders it
  correctly — filed. The GTIN field accepts non-numeric text, which is the underlying issue.
- Columns: GTIN, NAME, MANUFACTURER, MAH GLN, UNIT PRICE, DISPENSE, DAWANA, STATUS, SYNCED, ACTIONS.

## Known defects filed against this feature

- **P2 – High** — [Product Registry] A product is stored with a non-numeric GTIN — one record has its GTIN and name transposed

All are `draft` status: filed in-repo, not yet raised in Jira.

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
