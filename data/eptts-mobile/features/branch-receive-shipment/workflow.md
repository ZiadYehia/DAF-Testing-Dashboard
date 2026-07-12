# Branch — Receive Shipment Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Receive Shipment (Branch) |
| **Slug** | `branch-receive-shipment` |
| **Module** | Branch |
| **Navigation Path** | Branch Home → Receive Shipment |
| **Priority** | P1 |

## Business Purpose

Allows branch staff to accept and record incoming pharmaceutical shipments dispatched by manufacturers or distributors. The branch selects the incoming invoice from a list and scans each serialised pack barcode to confirm receipt.

## UI Elements (verified 2026-07-09)

### Incoming Invoices List (Screen 1)
| Element | Description |
|---------|-------------|
| Page title | `Incoming Invoices` (NOT "Receive Shipment") |
| Invoice cards | Composite content-desc — tap opens scan screen directly |
| Card format | `<name>\n<status>\n<sender>\n<pack count>\n<date>` |

### Receive Shipment Scan Screen (Screen 2 — opened by tapping an invoice card)
| Element | Content-Desc | Description |
|---------|-------------|-------------|
| Page title | `Receive Shipment` | heading |
| Invoice summary | `Invoice`, `From`, `To`, `Items`, `Packs` labels | Summary of the selected invoice |
| **Scan Progress** card | `Scan Progress` | Progress bar + X/Y counter |
| Scan circle/button | `Scan Barcode` | Label on the scan button; tap opens camera |
| Scanned tab | `Scanned (0)` | Items scanned so far |
| Remaining tab | `Remaining (0)` | Items not yet scanned |
| Empty state | "No items scanned yet" | Shown until first scan |

**Key note:** "Scan Barcode" is the content-desc used for the scan button in the receive flow — different from "Tap to scan GTIN / SGTIN" used in Dispense/ReturnPack.

## Happy Path

1. From Branch Home, tap **Receive Shipment**.
2. **Incoming Invoices** list appears with all inbound shipments.
3. Each card shows: invoice name, sender party, pack count, date, status (Dispatched).
4. Tap an invoice to open the scan/receive screen (same pattern as Distributor Receive Shipment).
5. Invoice summary displayed (Invoice, From, To, Items, Packs).
6. Scan Progress bar starts at 0%.
7. Tap Scan Barcode to open the camera.
8. Scan each pack; progress increments.
9. At 100% scan completion, submit to confirm receipt.

## Observed Senders in Test Data

| Sender | Example Invoice |
|--------|----------------|
| Bio Egypt | test_dis_09 |
| Janssen | 0541386898796650573sd, 0541386848162808532s |
| Upjohn EESV | INV-SBX-SBX269198 |
| Pharmaoverseas Importer | INV-SBX-SBX540605, testing-6555 |

## Edge Cases & Validation Rules

- Multiple manufacturer senders visible in the list — branch can receive from various upstream parties.
- Scan errors same as Distributor Receive Shipment (duplicate, wrong pack, network error).
- Partial receipt: creates "Partially Delivered" status.

## Notes

- The UI is identical to the Distributor's Receive Shipment screen — same list format and scan flow.
- Branch sits mid-chain between distributors/manufacturers and pharmacies.
