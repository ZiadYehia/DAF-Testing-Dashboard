# Product Display — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Product Display |
| **Slug** | `web-products` |
| **Feature ID** | `EPTTS_WEB_09` |
| **Module** | Platform Dashboard |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/products` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Browses the registered product catalogue as the platform sees it. Also unreachable from the navigation menu.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Product Display | Heading | — |
| AR | Button / action | — |
| Export | Button / action | — |
| Import | Button / action | — |
| Add Product | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| 4 | Button / action | — |
| 5 | Button / action | — |
| Search by name, GTIN, or manufacturer... | input | Search by name, GTIN, or manufacturer... |
| Table 1 | Table | columns: GTIN, NAME, MANUFACTURER, PACKAGING, DOSAGE FORM, STRENGTH, DAWANA, DISPENSE, STATUS, PRICING, ACTIONS |

## Displayed metrics

- 662 Total Products 656 Active 6 Inactive
- 662 Total Products
- 662
- Total Products
- 656 Active
- 656
- Active
- 6 Inactive
- 6
- Inactive

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/products`.
4. The page loads with the heading "Product Display".
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
GET /registry-service/api/v1/products?limit=1
GET /registry-service/api/v1/products?isActive=true&limit=1
GET /registry-service/api/v1/products?isActive=false&limit=1
GET /registry-service/api/v1/products
GET /registry-service/api/v1/entities/manufacturers?limit=500
GET /registry-service/api/v1/entities?type=distributor&limit=500
GET /registry-service/api/v1/products?limit=10&offset=0
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
- **Reachability defect:** this page exists and works by direct URL but has no working navigation entry. See the filed bug.
