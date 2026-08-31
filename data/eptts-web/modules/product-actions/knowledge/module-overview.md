# Product Actions — Module Overview

| | |
|---|---|
| Sidebar group | PRODUCT ACTIONS |
| Portal | Masar Platform dashboard · https://192.168.225.195:8444 |
| Features | 0 |

## Why this module exists

Operations performed on a pack in place rather than moving it: scanning to look one up, verifying authenticity, destroying it, and recall. Destruction and recall are terminal and irreversible, which makes their confirmation steps and role restrictions the highest-value things to test here.

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
