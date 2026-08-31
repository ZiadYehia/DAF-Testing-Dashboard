# Return Receiving — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Return Receiving |
| **Slug** | `web-return-receiving` |
| **Feature ID** | `EPTTS_WEB_36` |
| **Module** | product-movement |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/pending-returns` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Accepting returned stock, split into Incoming Returns and My Returns. This is the ONLY transition that moves packs out of a terminal-looking state back into sellable inventory, so a defect here silently resurrects stock that should not be re-sold. The table exposes a DAWANA PRODUCT column, meaning Dawana-integrated items are handled differently on this path.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Return Receiving | Heading | — |
| Returns | Heading | — |
| AR | Button / action | — |
| Incoming Returns | Button / action | — |
| My Returns | Button / action | — |
| Search | Button / action | — |
| Clear | Button / action | — |
| 1 | Button / action | — |
| Filter by sender GLN... | input | Filter by sender GLN... |
| (unlabelled) | input[text] | — |
| (unlabelled) | input[text] | — |
| Table 1 | Table | columns: RETURN #, DATE, TYPE, SENDER, RECEIVER, DAWANA PRODUCT, ITEMS, NOTE, STATUS, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/pending-returns`.
4. The page loads with the heading "Return Receiving".
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
GET 200 /masar-service/api/v1/shipments/returns?page=1&limit=20
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
