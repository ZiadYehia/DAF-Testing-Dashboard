# Analytics — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Analytics |
| **Slug** | `web-analytics` |
| **Feature ID** | `EPTTS_WEB_04` |
| **Module** | Platform Dashboard |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/analytics` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Four analytical views over the same traceability data - Activity, Inventory, Shipments and Expiry risk. Expiry risk is the commercially significant one: it drives write-off decisions.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Statistics | Heading | — |
| Analytics | Heading | — |
| Activity | Tab | — |
| Inventory | Tab | — |
| Shipments | Tab | — |
| Expiry risk | Tab | — |
| AR | Button / action | — |
| Refresh | Button / action | — |
| Activity | Button / action | — |
| Inventory | Button / action | — |
| Shipments | Button / action | — |
| Expiry risk | Button / action | — |
| Table 1 | Table | columns: BUSINESS STEP, NET UNITS, GROSS EVENTS |

## Displayed metrics

- 177,681,322 Commissioned
- 181,141,942 Packed
- 96,080 Shipped
- 1,849,015 On-hand units
- 312,200 Stock value (EGP)
- 0 Expiring ≤30d

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/analytics`.
4. The page loads with the heading "Analytics".
5. The table populates with records (or shows an empty state).

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Empty state** — filtering to zero results must clear previous rows and show an empty state.
- **Tab isolation** — switching tabs must not show the previous tab's data.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/reports/activity
GET /masar-service/api/v1/reports/inventory?limit=100&offset=0
GET /masar-service/api/v1/reports/inventory-summary
GET /masar-service/api/v1/reports/shipments
GET /masar-service/api/v1/reports/expiry-risk?withinDays=90
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
