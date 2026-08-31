# Product Recall — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Product Recall |
| **Slug** | `web-product-recall` |
| **Feature ID** | `EPTTS_WEB_46` |
| **Module** | product-actions |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/recalls` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Regulator-facing: withdraws a GTIN or lot from circulation against a circular number, with a PROGRESS column tracking how much of the affected stock has been accounted for. Scope is the critical field — recalling a whole GTIN when only one lot is affected is as damaging as missing the recall.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Product Recall | Heading | — |
| Recalls | Heading | — |
| AR | Button / action | — |
| Initiate Recall | Button / action | — |
| Apply | Button / action | — |
| Filter by GTIN | input | Filter by GTIN |
| Table 1 | Table | columns: SCOPE, GTIN, LOT NUMBER, CIRCULAR NUMBER, STATUS, PROGRESS, CREATED AT, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/recalls`.
4. The page loads with the heading "Product Recall".
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
GET 200 /masar-service/api/v1/recalls?limit=20
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
