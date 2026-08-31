# Pharmacy Stock — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Pharmacy Stock |
| **Slug** | `web-pharmacy-stock` |
| **Feature ID** | `EPTTS_WEB_50` |
| **Module** | master-data |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/pharmacy-stock` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Aggregate stock per pharmacy, splitting RECEIVED from IN TRANSIT against a TOTAL. That split is the point: it is where the custody-moves-on-receipt rule becomes visible to an operator, and a figure landing in the wrong column means the rule was applied wrongly.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Pharmacy Stock | Heading | — |
| Pharmacy Stock Overview | Heading | — |
| AR | Button / action | — |
| Export CSV | Button / action | — |
| Search | Button / action | — |
| Previous | Button / action | — |
| Next | Button / action | — |
| e.g. 6281234567890 | input | e.g. 6281234567890 |
| e.g. INV-2024-001 | input | e.g. INV-2024-001 |
| SGTIN URN or scan DataMatrix | input | SGTIN URN or scan DataMatrix |
| e.g. 362230019200... | input | e.g. 362230019200... |
| Table 1 | Table | columns: PHARMACY, GLN, PRODUCT, ITEM CODE, INVOICE, RECEIVED, IN TRANSIT, TOTAL |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/pharmacy-stock`.
4. The page loads with the heading "Pharmacy Stock".
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
GET 200 /masar-service/api/v1/reports/pharmacy-stock?limit=50
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
