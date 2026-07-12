# Distributor — Receive Shipment Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Receive Shipment (Distributor) |
| **Slug** | `distributor-receive-shipment` |
| **Module** | Distributor |
| **Navigation Path** | Distributor Home → Receive Shipment |
| **Priority** | P1 |

## Business Purpose

Allows distributor staff to accept and record incoming pharmaceutical shipments from manufacturers. The distributor selects the incoming invoice from a list and scans each serialised pack barcode to confirm receipt, progressing the shipment from "Dispatched" to "Delivered" (or "Partially Delivered") status.

## UI Elements

### Incoming Invoices List (Screen 1)
| Element | Description |
|---------|-------------|
| Invoice list cards | Invoice number, sender name (↓ arrow), pack count (as tappable link), date, status badge |
| Status badges | Dispatched (blue), Partially Delivered (teal/green) |

### Receive Shipment (Scan Screen — Screen 2)
| Element | Description |
|---------|-------------|
| Invoice summary card | Invoice #, From, To, Items count, Packs count |
| Scan Progress card | Progress bar + "X / Y" counter + percentage |
| Scan Barcode button | Circular icon — opens camera scanner |
| Scanned tab | List of successfully scanned packs |
| Remaining tab | List of packs not yet scanned |
| "No items scanned yet" | Empty-state placeholder in the Scanned tab |

## Happy Path

1. From Distributor Home, tap **Receive Shipment**.
2. **Incoming Invoices** list appears showing all inbound shipments.
3. Each entry shows: invoice name (e.g. `Invtest182`, `DESADV-RFtest-006`), sender (e.g. ↓ Janssen), pack count, date, status badge.
4. Tap an invoice to open the **Receive Shipment** scan screen.
5. Screen shows the invoice summary (Invoice, From, To, Items, Packs) and a **Scan Progress** bar at 0 / N.
6. Tap the **Scan Barcode** button; camera opens.
7. Scan each pack barcode on the physical delivery.
8. Each successful scan increments the progress counter and moves the pack to the **Scanned** tab.
9. **Remaining** tab shows outstanding packs.
10. Once 100% complete, submit to confirm receipt.

## Edge Cases & Validation Rules

- Scanning a barcode not in the invoice: error ("Pack not in this shipment").
- Scanning a duplicate: warning ("Already scanned").
- Partial receipt: submit creates "Partially Delivered" status.
- Network error: graceful error + retry.
- Invoices from multiple manufacturers appear in the list (Janssen, Bio Egypt, etc.).

## Notes

- Observed invoice statuses: **Dispatched** (most common), **Partially Delivered**.
- Invoice formats in test data: `Invtest182`, `INV2837`, `DESADV-RFtest-006`, `DESADV-REFtest-001`.
- The "To" party for distributor-received shipments is "New Branch" or the distributor's own entity.
