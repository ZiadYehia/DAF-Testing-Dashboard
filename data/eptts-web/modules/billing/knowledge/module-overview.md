# Billing Portal — Module Overview

Billing portal (:8446) — unbilled operations, invoices, revenue reports, and fee configuration.

**Base URL:** https://192.168.225.195:8446

Requires the Citrix VPN. TLS uses a self-signed certificate, so every client must ignore
certificate errors. Authentication is **Keycloak OIDC** (realm `masar`, client
`masar-dashboard`, Authorization Code + PKCE) — the direct password grant is disabled, so
automation must drive the real browser login.

## Features

| Feature ID | Slug | Test cases |
|---|---|---|
| `EPTTS_BIL_01` | `billing-dashboard` | 3 |
| `EPTTS_BIL_02` | `billing-unbilled-operations` | 3 |
| `EPTTS_BIL_03` | `billing-invoices` | 8 |
| `EPTTS_BIL_04` | `billing-reports` | 6 |
| `EPTTS_BIL_05` | `billing-configuration` | 7 |

## Notes

- Discovered live against production on 2026-08-31.
- All test cases are `new_added`; none has been executed.
