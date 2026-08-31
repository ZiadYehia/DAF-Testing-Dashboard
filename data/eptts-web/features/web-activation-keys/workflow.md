# Activation Keys — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Activation Keys |
| **Slug** | `web-activation-keys` |
| **Feature ID** | `EPTTS_WEB_62` |
| **Module** | desktop-agent |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/activation-keys` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Issues and revokes the keys that let a desktop agent connect. Security-relevant: a key that stays valid after revocation is an access-control defect, and the platform generally cannot re-display an issued key, so the one-time-display behaviour is worth verifying explicitly.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Desktop Agent - Activation Keys | Heading | — |
| Activation Keys | Heading | — |
| AR | Button / action | — |
| Generate Keys | Button / action | — |
| All (0) | Button / action | — |
| Active (0) | Button / action | — |
| Used (0) | Button / action | — |
| Expired (0) | Button / action | — |
| Revoked (0) | Button / action | — |
| Table 1 | Table | columns: KEY, PHARMACY GLN, STATUS, CREATED DATE, EXPIRY DATE, DEVICE, ACTIONS |

## Displayed metrics

- 0 TOTAL 0 ACTIVE 0 USED 0 EXPIRED 0 REVOKED
- 0 TOTAL
- 0 ACTIVE
- 0 USED
- 0 EXPIRED
- 0 REVOKED
- All (0) Active (0) Used (0) Expired (0) Revoked (0)
- All (0)
- Active (0)
- Used (0)

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/activation-keys`.
4. The page loads with the heading "Activation Keys".
5. The table populates with records (or shows an empty state).

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Empty state** — filtering to zero results must clear previous rows and show an empty state.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET 200 /masar-service/api/v1/users/me
GET 200 /masar-service/api/v1/agent/activation-keys
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
