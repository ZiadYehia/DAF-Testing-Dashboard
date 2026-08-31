# Transfer History — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Transfer History |
| **Slug** | `web-transfer-history` |
| **Feature ID** | `EPTTS_WEB_38` |
| **Module** | product-movement |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/shipments/history` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

The despatch ledger, and the operational answer to 'where did this consignment go?'. Carries both platform STATUS and DAWANA STATUS with a LAST SYNC column — two systems that can disagree, which makes a stale or diverging Dawana status a real and checkable failure mode.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Transfer History | Heading | — |
| Shipment History | Heading | — |
| AR | Button / action | — |
| New Shipment | Button / action | — |
| Search by invoice number | input[text] | Search by invoice number |
| Table 1 | Table | columns: INVOICE NUMBER, SSCCS, SOURCE BRANCH, DESTINATION, ITEMS, STATUS, DAWANA STATUS, LAST SYNC, CREATED AT, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/shipments/history`.
4. The page loads with the heading "Transfer History".
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
GET 200 /masar-service/api/v1/shipments?limit=25
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
