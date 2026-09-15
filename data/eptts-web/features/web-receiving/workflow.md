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

## Measured against devsim on 2026-09-09

Driven end to end as `testdistributor3@eptts.com`. This supersedes the 2026-08-31 notes above
where the two disagree.

The flow is: the pending list, filtered; `Receive` on a row, which replaces the list with a SCAN
panel (`#barcodeInput`, placeholder "Focus and scan barcode...", a running "0 / 1 item(s)
scanned" counter and the products expected); scanning the SSCC, after which the panel reads "SSCC
scanned successfully — packs included"; then `Complete Receiving`, which raises a PrimeNG confirm
("Confirm receiving all items?", accepted via `.p-confirmdialog-accept-button`).

**The rows carry no SSCC.** The table's columns are Invoice Number, From, Dispatch Date, Items,
Status, Actions. There is a "Search by SSCC..." filter box, but nothing in a row lets a caller
confirm which consignment it selected — so a specific consignment must be addressed by its
**invoice number**, which is displayed, and which the dispatching party chooses. On a tenant with
dozens of shipments awaiting receipt, "the first row" belongs to somebody else. `WEB_RCV_010`
consequently dispatches its own consignment under a per-run invoice number rather than consuming
another case's.

**An empty filter result removes the filter bar with the list.** Typing a value that matches
nothing swaps the whole block — Search button included — for the empty state, so a click on
`Search` immediately after filling a filter throws "waiting for
getByRole('button', { name: /^Search$/ })". Treat a missing row as a value to interpret, not as a
failure, and fall back to pressing Enter.

**Completion is asynchronous and the screen reports nothing either way.**
`POST /masar-service/api/v1/portal/operations/receive/shipment/{shipmentId}` answers **202** and
the verdict arrives on `/portal/operations/{id}`. The 202 is not success: on this tenant the
operation resolves `{"status":"FAILED","retryable":false,
"detail":"PORTAL_COMMAND_ENVELOPE_MALFORMED"}` while the interface shows no error at all. See
`bugs/web-receiving/receiving-a-shipment-fails-with-portal-command-envelope-malformed-and-reports-nothing.md`.

**Judge custody from the record, not the screen or the list.** Two weaker judgements were tried
and both reported a completed receive on a shipment the platform had not touched: "the row no
longer says Dispatched" (any other label, or a cell that had not painted, counted as success) and
"the row has left the pending list" (identical to a filter that matched nothing). The reliable
answer is `GET /masar-service/api/v1/shipments`, read through the receiver's own session, where a
real receive shows the status leaving `dispatched` **and** `deliveredAt` **and**
`receivedByUserId` both set. Half of that is not enough.

