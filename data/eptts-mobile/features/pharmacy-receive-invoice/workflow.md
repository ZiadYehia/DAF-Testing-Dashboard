# Pharmacy — Receive Invoice Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Receive Invoice (Pharmacy) |
| **Slug** | `pharmacy-receive-invoice` |
| **Module** | Pharmacy |
| **Navigation Path** | Pharmacy Home → Receive Invoice |
| **Priority** | P1 |

## Business Purpose

Enables pharmacy staff to receive an inbound pharmaceutical shipment from a distributor or branch. The pharmacist selects an incoming invoice, then physically scans each serialised pack barcode to confirm receipt. The scan-progress bar tracks completion.

## UI Elements

### Incoming Invoices List
| Element | Description |
|---------|-------------|
| Invoice cards | Invoice number, sender name (↓ arrow), pack count (tappable), date, status badge |
| Status badges | Dispatched, Partially Delivered |

### Receive Shipment Screen
| Element | Description |
|---------|-------------|
| Invoice summary card | Invoice #, From, To, Items, Packs |
| Scan Progress card | Progress bar + "X / Y" counter + percentage |
| Scan Barcode button | Opens camera scanner |
| Scanned tab | List of successfully scanned packs |
| Remaining tab | List of packs not yet scanned |

## Happy Path

1. From Pharmacy Home, tap **Receive Invoice**.
2. **Incoming Invoices** list appears showing all shipments dispatched to this pharmacy.
3. Each card shows: invoice number, sender, pack count, date, and status (e.g. **Dispatched**).
4. Tap an invoice card to open the **Receive Shipment** screen.
5. The screen shows a summary (Invoice, From, To, Items count, Packs count) and a **Scan Progress** bar starting at 0%.
6. Tap **Scan Barcode** to open the camera scanner.
7. Scan each pack barcode on the physical product.
8. Each successful scan increments the progress counter (e.g. 1/3, 2/3) and moves the pack to the **Scanned** tab.
9. The **Remaining** tab shows packs not yet scanned.
10. When all packs are scanned (100%), the shipment can be confirmed/submitted.

## Edge Cases & Validation Rules

- Scanning a barcode that doesn't belong to this shipment: display an error ("Pack not in this shipment").
- Scanning a duplicate pack: display a warning ("Already scanned").
- Network error during scan: graceful error with retry.
- Partial receipt: can submit with fewer than expected packs (results in "Partially Delivered" status).
- Empty invoice list: display an empty-state message.

## Notes

- "Scanned (0)" / "Remaining (0)" tabs update in real time as packs are scanned.
- The progress bar provides a clear visual indicator of receipt completion.
