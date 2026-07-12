# Distributor — My Shipments Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | My Shipments (Distributor) |
| **Slug** | `distributor-my-shipments` |
| **Module** | Distributor |
| **Navigation Path** | Distributor Home → My Shipments |
| **Priority** | P1 |

## Business Purpose

Allows distributor staff to view and manage all outbound shipments they have created. Provides visibility into shipment status (Draft, Dispatched, Delivered), contents, and the ability to act on pending shipments.

## UI Elements

### Shipments List
| Element | Description |
|---------|-------------|
| Shipment list cards | Invoice number, source (↑ From), destination (↓ To), items + packs count, date, status badge |
| Status badges | Draft (orange), Dispatched (blue/grey), Delivered (green) |
| Filter by status | Dropdown to filter the list |
| Tap card | Opens shipment detail |

### Shipment Detail
| Element | Description |
|---------|-------------|
| Invoice summary | Invoice number, From/To parties, Items, Packs |
| Pack list | Serialised pack items with their statuses |
| Status badge | Current shipment status |
| Actions | Context-dependent (e.g. dispatch button for Draft, no actions for Delivered) |

## Happy Path

1. From Distributor Home, tap **My Shipments**.
2. Shipments list appears with all outbound shipments, sorted by date (newest first).
3. Each card shows: invoice/shipment name, sender (↑ arrowhead), receiver (↓ arrowhead), items × packs, date, status.
4. Use the **Filter by status** dropdown to narrow results.
5. Tap a shipment to open **Shipment Detail**.
6. Detail shows the full shipment summary and line-item packs.

## Edge Cases & Validation Rules

- Draft shipments can be edited (add/remove packs) or dispatched.
- Dispatched shipments are read-only until confirmed as delivered.
- Delivered shipments are fully read-only.
- Empty list: show an empty-state message.
- Filter with no results: show an empty filtered state.

## Notes

- Observed statuses in test data: **Draft**, **Dispatched**, **Delivered**.
- Shipment names in test data follow free-text ERP invoice number format (e.g. `test-963147`, `test-96324`).
