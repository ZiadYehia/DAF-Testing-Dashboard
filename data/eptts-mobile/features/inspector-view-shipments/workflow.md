# Inspector — View Shipments Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | View Shipments (Inspector) |
| **Slug** | `inspector-view-shipments` |
| **Module** | Inspector |
| **Navigation Path** | Inspector Home → View Shipments |
| **Priority** | P1 |

## Business Purpose

Allows the Inspector to browse all shipments in the system across all parties. Provides read-only visibility into shipment status, contents, and associated invoices for regulatory oversight and audit purposes.

## UI Elements

## UI Elements (Verified 2026-07-09)

### Shipments List
| Element | Content-Desc | Notes |
|---------|--------------|-------|
| Page title | `Shipments` | heading |
| Back button | `Back` | `android.widget.Button` |
| Filter dropdown | `Filter by status` | tap to open status filter |
| Shipment card | One composite content-desc per card (all fields joined by `\n`) | e.g. `#test-96324100\nDispatched\nMain warehouse\nصيدليات الخليل\nItems: 1  •  Packs: 6\n09/07/2026` |

**Observed statuses:** Dispatched, Delivered, Draft

### Shipment Detail
| Element | Content-Desc | Notes |
|---------|--------------|-------|
| Page title | `Shipment Details` | heading |
| Back button | `Back` | |
| View Invoice button | `View Invoice` | tappable action button |
| Field labels | `From`, `To`, `Items`, `Packs`, `Dispatched`, `Created` | non-clickable labels |
| Section header | `Shipment Items` | |
| Pack item | SSCC/GTIN value string (e.g. `035045800000002043`) + status (`6 pack(s)  •  in_transit`) | |

## Happy Path

1. From Inspector Home, tap **View Shipments**.
2. Shipments list loads with all recorded shipments, sorted by date (newest first).
3. Each card shows: invoice number, source (↓ Sender name), pack count as a tappable link, and date.
4. Tap a shipment card to open the **Shipment Detail** view.
5. Detail shows invoice header (Invoice, From, To, Items, Packs) and line items.
6. Tap the invoice reference to view the **Invoice** inline.
7. Use the back button to navigate up through the hierarchy.

## Edge Cases & Validation Rules

- Empty state: if no shipments exist, display an appropriate empty-state message.
- Network error: show a retry option.
- Partially Delivered shipments show a different status badge colour.
- Long invoice numbers should be truncated with ellipsis in the list view.

## Notes

- Inspector cannot modify, accept, or reject shipments — view only.
- Pack count links (e.g. "1 packs", "18 packs") open the serialised pack list.
- Observed statuses in test data: **Dispatched**, **Partially Delivered**.
