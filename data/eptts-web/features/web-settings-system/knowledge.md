# web-settings-system — Feature Knowledge

## Why this feature matters

Integrator accounts and **their API keys**. This tab surfaces credentials, so its access control matters more than its display: anyone who can read this page can act as an integrator.

## What will bite you

- This is a **tab**, not a route: it lives at `/admin` and is only reachable by clicking **System**. There is no deep link, so a test must navigate then click.
- The Settings page mounts several tab bars at once, so several tab panels are in the DOM simultaneously. Scope assertions to this tab's own panel (via the tab's `aria-controls`) or you will assert against a sibling tab's table.
- PrimeNG renders an icon inside the tab, so the tab's `innerText` has a leading space. Match on trimmed `textContent`, or an anchored selector will never hit.
- **Credentials are on screen here.** Key rotation is irreversible and the platform cannot re-display an existing key, so never trigger a rotation casually.

## Endpoints this tab depends on

```
GET /registry-service/api/v1/admin/integrators
```

Check the endpoint directly before concluding the tab itself is at fault.

## What every case here has to account for

- **The Citrix VPN is a hard precondition.** Without it every request fails after a uniform ~10 s connect timeout, which looks exactly like a hung server.
- **TLS is self-signed** — Playwright needs `ignoreHTTPSErrors: true`, curl needs `-k`.
- **Keycloak's direct password grant is disabled**, so automation must drive the real browser login.
- **Secrets never go in `data/`** — it is committed. Reference the env key name.
