# registry-parties — Feature Knowledge

## Why this feature matters

The authoritative trade-party register, and **the only place B2B API keys are issued**. That makes it the gateway to all API testing: no key, no API coverage. It is also where GCP length is set, which determines how every SGTIN and SSCC for that partner is parsed.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /registry-service/api/v1/admin/mdm/parties?limit=50
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- **The "B2B Key" action is destructive.** Its tooltip is "Generate / rotate B2B API key" and the
  platform *cannot display an existing key* — only replace it (`generate-key` 409s if one exists;
  `regenerate-key` supersedes it). Rotating breaks whatever currently uses that key. Never click it
  casually on a party that is not yours.
- Endpoints behind the row actions: `POST /b2b/partner/generate-key`,
  `POST /b2b/partner/regenerate-key`, `POST /admin/b2b-partners/by-gln/{gln}/regenerate-key`.
- 50+ parties, paginated by cursor — a party absent from page 1 is not absent from the registry.
- Role vocabulary: entity type `branch` exists (8 of them) but there are **zero `branch`-role
  users**; branch behaviour is carried by the `distributor` role.

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
