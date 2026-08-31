# Product Destruction — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Product Destruction |
| **Slug** | `web-product-destruction` |
| **Feature ID** | `EPTTS_WEB_44` |
| **Module** | product-actions |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/destruction` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Requests destruction of stock, recording reason, initiator GLN and affected items. Terminal and irreversible: once applied the packs can never re-enter the supply chain. That makes the confirmation step and the role restriction more important to verify than the happy path.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Product Destruction | Heading | — |
| Destruction | Heading | — |
| AR | Button / action | — |
| Initiate Destruction Request | Button / action | — |
| 1 | Button / action | — |
| Table 1 | Table | columns: ID, REASON, STATUS, INITIATOR GLN, ITEMS, CREATED AT, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/destruction`.
4. The page loads with the heading "Product Destruction".
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
GET 200 /masar-service/api/v1/destruction?limit=20&offset=0
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
