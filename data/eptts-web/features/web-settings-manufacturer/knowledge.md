# web-settings-manufacturer — Feature Knowledge

## Why this feature matters

Manufacturer trade parties with their GLN, SGLN and GS1 prefix. The SGLN and prefix shown here determine how every EPC that partner submits is parsed, so a wrong value silently breaks their entire API integration rather than failing visibly.

## What will bite you

- This is a **tab**, not a route: it lives at `/admin` and is only reachable by clicking **Manufacturer**. There is no deep link, so a test must navigate then click.
- The Settings page mounts several tab bars at once, so several tab panels are in the DOM simultaneously. Scope assertions to this tab's own panel (via the tab's `aria-controls`) or you will assert against a sibling tab's table.
- PrimeNG renders an icon inside the tab, so the tab's `innerText` has a leading space. Match on trimmed `textContent`, or an anchored selector will never hit.

## Endpoints this tab depends on

```
GET /registry-service/api/v1/entities/manufacturers?limit=1
GET /registry-service/api/v1/entities/manufacturers?isActive=true&limit=1
GET /registry-service/api/v1/entities/manufacturers?isActive=false&limit=1
GET /registry-service/api/v1/entities/manufacturers?limit=25&offset=0
```

Check the endpoint directly before concluding the tab itself is at fault.

## What every case here has to account for

- **The Citrix VPN is a hard precondition.** Without it every request fails after a uniform ~10 s connect timeout, which looks exactly like a hung server.
- **TLS is self-signed** — Playwright needs `ignoreHTTPSErrors: true`, curl needs `-k`.
- **Keycloak's direct password grant is disabled**, so automation must drive the real browser login.
- **Secrets never go in `data/`** — it is committed. Reference the env key name.
