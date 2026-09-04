# Reports — Module Overview

| | |
|---|---|
| Sidebar group | REPORTS |
| Portal | Masar Platform dashboard · https://192.168.225.195:8444 |
| Features | 13 |

## Why this module exists

Aggregate views over the traceability graph: the command centre, reporting, analytics, violations and the audit console. Numbers here are derived, so the thing to test is whether they agree with the underlying events — a total that disagrees with the trace is a worse defect than a page that fails to load.

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
