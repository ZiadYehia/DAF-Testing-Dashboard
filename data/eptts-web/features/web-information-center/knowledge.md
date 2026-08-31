# web-information-center — Feature Knowledge

## Why this feature matters

The only page every role can reach, which makes it the platform's de-facto fallback route. That matters for testing beyond its own content: when navigation fails, this is where the user lands, so "ended up on Information Center" is a signal that something else broke.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/information-center/announcements/urgent
GET /masar-service/api/v1/information-center/announcements/pinned
GET /masar-service/api/v1/information-center/announcements
GET /masar-service/api/v1/information-center/announcements/upcoming-dates
GET /masar-service/api/v1/information-center/announcements?category=training
GET /masar-service/api/v1/information-center/announcements?category=user_guides
GET /masar-service/api/v1/information-center/announcements?category=integration
GET /masar-service/api/v1/information-center/announcements?category=system
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- Read-only for all roles; there is no state to corrupt, which makes this a safe smoke target.
- Announcements were empty in devsim at discovery time, so an empty state is normal here and is not
  evidence of a fault.

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
