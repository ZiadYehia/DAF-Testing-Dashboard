# billing-invoices — Feature Knowledge

## Why this feature matters

Financial records. Arithmetic correctness and immutability after payment are the whole feature — a recalculated paid invoice is a far more serious defect than a rendering fault.

## What will bite you

- Columns: INVOICE #, MAH GLN, PIECES, BILLING CHARGE, ESERVICE, TOTAL, STATUS, CREATED, PAID.
- Verify `subtotal + fees = total` independently rather than trusting the displayed total, and that
  `sgtinCount` matches the pieces billed.
- Confirm a `PAID` invoice cannot be edited or re-totalled.

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
