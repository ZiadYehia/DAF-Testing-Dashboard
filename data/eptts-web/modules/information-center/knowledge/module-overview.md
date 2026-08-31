# Information Center — Module Overview

| | |
|---|---|
| Sidebar group | INFORMATION CENTER |
| Portal | Masar Platform dashboard · https://192.168.225.195:8444 |
| Features | 1 |

## Why this module exists

Platform announcements, guidance and reference material pushed to trade partners. Read-only for everyone except platform staff, which makes it the cleanest place to test that a role sees only what it should.

## Access

Dashboard authentication is **Keycloak OIDC** (realm `masar`, client `masar-dashboard`,
Authorization Code + PKCE). The direct password grant is disabled, so automation must drive
the real login form. The host is reachable **only over the Citrix VPN** and serves a
self-signed certificate, so every client needs `ignoreHTTPSErrors`.

Coverage is exercised as **admin** (`admin@devsim.local`) and **manufacturer**
(`manufacturer@devsim.local`). The distributor and pharmacy dashboard passwords are not
known — an admin reset returned 503 — so role isolation is currently tested across those two
roles only. That is a real limitation of the coverage, not of the platform.

## Relationship to the API

Every page here talks to the same endpoints the **`eptts-api`** app covers directly, so a
defect found on one side is worth checking on the other. Each feature's workflow lists the
XHR calls observed on that page, which is what makes the cross-check possible.
