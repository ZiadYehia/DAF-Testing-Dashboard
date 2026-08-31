# Inventory — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Inventory |
| **Slug** | `web-inventory` |
| **Feature ID** | `EPTTS_WEB_49` |
| **Module** | master-data |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/inventory` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Pack-level stock for the current party: SGTIN, DataMatrix, batch, expiry, status and location. The operational source of truth for 'what do I hold?', and the natural place to confirm that a movement elsewhere actually changed holdings. CSV export makes it the reconciliation tool too.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Inventory | Heading | — |
| AR | Button / action | — |
| Export CSV | Button / action | — |
| Apply | Button / action | — |
| Exact SGTIN or GTIN | input | Exact SGTIN or GTIN |
| Filter by GTIN | input | Filter by GTIN |
| Filter by Batch | input | Filter by Batch |
| Table 1 | Table | columns: SGTIN, DATAMATRIX, PRODUCT, GTIN, SERIAL, BATCH, EXPIRY DATE, STATUS, LOCATION, CREATED AT, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/inventory`.
4. The page loads with the heading "Inventory".
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
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
