# Reports — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Reports |
| **Slug** | `web-reporting` |
| **Feature ID** | `EPTTS_WEB_03` |
| **Module** | Platform Dashboard |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/reporting` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Stock and shipment reporting with a date-range filter, search, pagination and CSV export. The export is what partners reconcile against, so column fidelity matters as much as the on-screen totals.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Reports | Heading | — |
| Stock & Shipment Report | Heading | — |
| AR | Button / action | — |
| Export CSV | Button / action | — |
| Refresh | Button / action | — |
| Last 7 days | Button / action | — |
| Last 30 days | Button / action | — |
| Last 90 days | Button / action | — |
| Last year | Button / action | — |
| Search | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| Filter by GTIN... | input | Filter by GTIN... |
| Search branch or GLN... | input[text] | Search branch or GLN... |
| Search destination or GLN... | input[text] | Search destination or GLN... |
| Filter by invoice... | input | Filter by invoice... |
| From date... | input[text] | From date... |
| To date... | input[text] | To date... |
| Table 1 | Table | columns: GLN, BRANCH NAME, GTIN, PRODUCT NAME, STOCK QTY, SHIPPED QTY |

## Displayed metrics

- 1,849,015 Total Current Stock 96,076 Total Shipped
- 1,849,015 Total Current Stock
- 1,849,015
- Total Current Stock
- 96,076 Total Shipped
- 96,076
- Total Shipped

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/reporting`.
4. The page loads with the heading "Reports".
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
GET /masar-service/api/v1/reports/stock-shipment/summary
GET /masar-service/api/v1/reports/stock-shipment?offset=0&limit=50
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
