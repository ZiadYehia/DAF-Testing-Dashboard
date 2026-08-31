# Receiving — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Receiving |
| **Slug** | `web-receiving` |
| **Feature ID** | `EPTTS_WEB_33` |
| **Module** | product-movement |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/shipments/receive` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

The other half of a transfer, and the step that actually moves custody. Lists invoices in `dispatched,in_transit` and lets the holder confirm them. Six filters (invoice, SSCC, GLN, destination, date range) matter because a receiver who cannot find an inbound shipment cannot accept stock, and the stock stays unusable while it waits.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Receiving | Heading | — |
| Receive Shipment | Heading | — |
| AR | Button / action | — |
| Pending | Button / action | — |
| Received | Button / action | — |
| Search | Button / action | — |
| Reset | Button / action | — |
| Receive | Button / action | — |
| Search by invoice number... | input | Search by invoice number... |
| Search by SSCC... | input | Search by SSCC... |
| Search by GLN... | input | Search by GLN... |
| Search by destination... | input | Search by destination... |
| From... | input[text] | From... |
| To... | input[text] | To... |
| Table 1 | Table | columns: INVOICE NUMBER, FROM, DISPATCH DATE, ITEMS, STATUS, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/shipments/receive`.
4. The page loads with the heading "Receiving".
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
GET 200 /masar-service/api/v1/shipments/receive/invoices?limit=20&status=dispatched,in_transit
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
