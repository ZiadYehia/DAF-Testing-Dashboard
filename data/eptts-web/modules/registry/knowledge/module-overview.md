# Master Data Registry — Module Overview

Registry portal (:8445) — trade parties, GS1 prefixes, products, pharmacy onboarding, and B2B API keys.

**Base URL:** https://192.168.225.195:8445

Requires the Citrix VPN. TLS uses a self-signed certificate, so every client must ignore
certificate errors. Authentication is **Keycloak OIDC** (realm `masar`, client
`masar-dashboard`, Authorization Code + PKCE) — the direct password grant is disabled, so
automation must drive the real browser login.

## Features

| Feature ID | Slug | Test cases |
|---|---|---|

## Notes

- Discovered live against production on 2026-08-31.
- All test cases are `new_added`; none has been executed.
