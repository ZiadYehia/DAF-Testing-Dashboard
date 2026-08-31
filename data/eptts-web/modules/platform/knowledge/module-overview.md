# Platform Dashboard — Module Overview

Main EPTTS dashboard (:8444) — information centre, reporting, analytics, audit, and admin settings.

**Base URL:** https://192.168.225.195:8444

Requires the Citrix VPN. TLS uses a self-signed certificate, so every client must ignore
certificate errors. Authentication is **Keycloak OIDC** (realm `masar`, client
`masar-dashboard`, Authorization Code + PKCE) — the direct password grant is disabled, so
automation must drive the real browser login.

## Features

| Feature ID | Slug | Test cases |
|---|---|---|
| `EPTTS_WEB_01` | `web-information-center` | 7 |
| `EPTTS_WEB_02` | `web-command-center` | 7 |
| `EPTTS_WEB_03` | `web-reporting` | 10 |
| `EPTTS_WEB_04` | `web-analytics` | 8 |
| `EPTTS_WEB_05` | `web-violations` | 7 |
| `EPTTS_WEB_06` | `web-audit-console` | 10 |
| `EPTTS_WEB_07` | `web-master-data` | 7 |
| `EPTTS_WEB_08` | `web-settings-admin` | 10 |
| `EPTTS_WEB_09` | `web-products` | 10 |

## Notes

- Discovered live against production on 2026-08-31.
- All test cases are `new_added`; none has been executed.
