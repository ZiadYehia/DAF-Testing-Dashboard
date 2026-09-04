# web-master-data — Feature Knowledge

## Why this feature matters

How integrators obtain the signed master-data manifest. Files are SHA-256 stamped and the manifest is HMAC-signed, so integrity verification is part of the published contract rather than an optional extra — which makes signature and hash correctness in scope for testing, not just presence.

## Endpoints this page depends on

Captured from the browser during discovery, so this is what the page really calls:

```
GET /masar-service/api/v1/users/me
GET /registry-service/api/v1/master-data/versions
GET /registry-service/api/v1/onboarding/integration/info
```

A failure in any of these surfaces here, so check the endpoint directly before concluding the
page is at fault.

## What will bite you

- **Two filed defects live on this page.** It raises *"Cannot GET this resource"* on load with all
  tiles empty, and its sidebar group renders no child item so the page is unreachable by clicking.
- Master data is served by **registry-service** (`/master-data/versions`);
  `masar-service/master-data/snapshot/latest` is a 404. The page may be calling the wrong service.
- "Generate Now" writes a real snapshot — treat as a write action, not a read.

## Known defects filed against this feature

- **P2 – High** — [Navigation] All seven collapsible sidebar groups render with no child items, leaving Master Data Snapshots unreachable from the menu
- **P2 – High** — [Master Data] Master Data Snapshots page shows a "Cannot GET this resource" error toast on load

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

The source spreadsheet recorded these statuses against **staging**, by a different tester: Under Testing 7. Those are retained here as history only — they are not evidence of coverage in this environment, so they are deliberately not carried into the Status column.

## Retest log

**2026-09-02 — draft dropped: "All seven collapsible sidebar groups render with no child items".**
Retested against v1.0.2 as Platform Admin from `/dashboard`, following the draft's own steps. Each
of the seven group headers was clicked once and the links it ADDED were measured, so an
already-expanded group could not be mistaken for an empty one — which is how the original
observation most likely arose. Every group expands:

| Group | Children added on expand |
|---|---|
| Product Movement | 8 |
| Product Structure | 3 |
| Product Actions | 4 |
| File Upload | 2 |
| Master Data | 5, including `/products` and `/master-data`'s siblings |
| Monitoring | 4 |
| Administration | 3 |

The draft was never filed in Jira, declared no covered test cases, and no longer reproduces, so it
was dropped per bug-format.md's "Verify before filing". Evidence:
`screenshots/retest-2026-09-02-sidebar-groups-expand.jpg`.
