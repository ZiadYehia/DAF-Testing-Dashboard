# web-settings-admin — Feature Knowledge

## Why this feature matters

The highest-privilege page in the product: 15 tabs covering every partner type, pharmacy admins, POS partners, B2B partners, platform staff, user locks and system configuration. Anything reachable here can change how the whole platform behaves, so role isolation is the dominant concern.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/users?limit=25&roles=inspector
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- **Unreachable from the navigation** — no sidebar entry in any role. Filed.
- **Admin password reset is broken** (`503`, Keycloak update fails). Filed, and it blocks dashboard
  testing as the distributor and pharmacy roles entirely.
- 15 tabs is a large surface; treat each as its own sub-area rather than one page.
- Test role isolation by **direct URL** as a non-admin. Hiding a menu entry is not access control —
  and here there is no menu entry even for admin, so the URL is the only route in.

## Known defects filed against this feature

- **P1 – Critical** — [BLOCKER][Administration] Admin password reset returns 503 "Could not update the password in Keycloak"
- **P2 – High** — [Navigation] Settings (/admin) and Product Display (/products) have no sidebar entry in any role, leaving the 15-tab administration surface unreachable

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

The source spreadsheet recorded these statuses against **staging**, by a different tester: Under Testing 10. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.
