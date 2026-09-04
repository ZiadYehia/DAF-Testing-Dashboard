# Monitoring — Module Overview

| | |
|---|---|
| Sidebar group | MONITORING |
| Portal | Masar Platform dashboard · https://192.168.225.195:8444 |
| Features | 0 |

## Why this module exists

The operator's window into what the platform actually received and did: pack trace, B2B EPCIS messages, the message log, and webhook delivery history. This is where an async failure is diagnosed, which makes it the most useful module for confirming that a defect found elsewhere is visible to whoever has to support it.

## Access

Dashboard authentication is **Keycloak OIDC** (realm `masar`, client `masar-dashboard`,
Authorization Code + PKCE). The direct password grant is disabled, so automation must drive
the real login form. The host is reachable **only over the Citrix VPN** and serves a
self-signed certificate, so every client needs `ignoreHTTPSErrors`.

Coverage is exercised as **admin** (`admin@devsim.local`), **manufacturer**
(`manufacturer@devsim.local`), **distributor** and **pharmacy**. All four dashboard logins were
verified live against Keycloak on 2026-09-02. The distributor and pharmacy credentials are the
`EPTTS_EF_DISTRIBUTOR_*` and `EPTTS_EF_PHARMACY_*` keys in `automation-hub/.env` — issued as B2B
API identities, but the `masar-dashboard` OIDC client accepts them. Prefer those keys: the older
`EPTTS_WEB_BRANCH_PASSWORD` and `EPTTS_WEB_PHARMACY_PASSWORD` hold different values and are not
known to work. An earlier note here said these two passwords were unknown because an admin reset
returned 503; that is no longer the limitation it describes.

## Relationship to the API

Every page here talks to the same endpoints the **`eptts-api`** app covers directly, so a
defect found on one side is worth checking on the other. Each feature's workflow lists the
XHR calls observed on that page, which is what makes the cross-check possible.
