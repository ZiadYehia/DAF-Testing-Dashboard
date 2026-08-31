# web-settings-government — Feature Knowledge

## Why this feature matters

Government/regulator user accounts. Small list, high privilege — an account here can see across every tenant, so account lifecycle (create, deactivate, last-login visibility) is the whole risk.

## What will bite you

- This is a **tab**, not a route: it lives at `/admin` and is only reachable by clicking **Government**. There is no deep link, so a test must navigate then click.
- The Settings page mounts several tab bars at once, so several tab panels are in the DOM simultaneously. Scope assertions to this tab's own panel (via the tab's `aria-controls`) or you will assert against a sibling tab's table.
- PrimeNG renders an icon inside the tab, so the tab's `innerText` has a leading space. Match on trimmed `textContent`, or an anchored selector will never hit.

## What every case here has to account for

- **The Citrix VPN is a hard precondition.** Without it every request fails after a uniform ~10 s connect timeout, which looks exactly like a hung server.
- **TLS is self-signed** — Playwright needs `ignoreHTTPSErrors: true`, curl needs `-k`.
- **Keycloak's direct password grant is disabled**, so automation must drive the real browser login.
- **Secrets never go in `data/`** — it is committed. Reference the env key name.
