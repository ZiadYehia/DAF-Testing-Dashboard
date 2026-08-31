# Aggregation — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Aggregation |
| **Slug** | `web-aggregation` |
| **Feature ID** | `EPTTS_WEB_41` |
| **Module** | product-structure |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/aggregation` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Nesting packs into an SSCC container, with a LEVEL column for multi-level hierarchies and a Reaggregate action. A completed packing event SEALS the container, so appending to one is refused — deliberate, and it stops stock being added to something that may already have shipped. Reaggregate exists precisely because sealing is one-way.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Aggregation | Heading | — |
| Aggregation Packs | Heading | — |
| AR | Button / action | — |
| Reaggregate | Button / action | — |
| New Aggregation | Button / action | — |
| Add | Button / action | — |
| Search | Button / action | — |
| 1 | Button / action | — |
| SSCC 1 | input | SSCC 1 |
| Date From | input[text] | Date From |
| Date To | input[text] | Date To |
| Table 1 | Table | columns: SSCC, LEVEL, FROM, TO, STATUS, ITEMS, CREATED AT, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/aggregation`.
4. The page loads with the heading "Aggregation".
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
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=distributor&isActive=true
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities/manufacturers?isActive=true
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=branch&isActive=true
GET 200 /masar-service/api/v1/aggregation?sortBy=createdAt&sortOrder=DESC
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
