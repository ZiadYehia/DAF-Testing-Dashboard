# Command Center — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Command Center |
| **Slug** | `web-command-center` |
| **Feature ID** | `EPTTS_WEB_02` |
| **Module** | Platform Dashboard |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/dashboard` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

The national operations overview: pack counts by lifecycle status, stock value, partner activity and expiry exposure. This is the page a regulator looks at first, so wrong numbers here are worse than a broken page - they are believed.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Statistics | Heading | — |
| National Command Center | Heading | — |
| AR | Button / action | — |
| Refresh | Button / action | — |
| Table 1 | Table | columns: TIER, UNITS, VALUE (EGP) |
| Table 2 | Table | columns: GOVERNORATE, UNITS, VALUE (EGP) |
| Table 3 | Table | columns: PRODUCT, UNITS, VALUE (EGP) |

## Displayed metrics

- 1,849,020 Packs in circulation
- 1,849,015 Active (sellable)
- 0.3M Stock value (EGP)
- 0 Expiring ≤90 days
- 87,819 Network entities
- 6 Products tracked
- Supply-chain flow (net units)
- Network coverage Pharmacy 87,314 Manufacturer 254 Branch 216 Distributor 35
- Network coverage
- Stock by supply-chain tier

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/dashboard`.
4. The page loads with the heading "Command Center".
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
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/reports/dashboard-kpi
GET /masar-service/api/v1/reports/partner-analytics
GET /masar-service/api/v1/reports/activity
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
