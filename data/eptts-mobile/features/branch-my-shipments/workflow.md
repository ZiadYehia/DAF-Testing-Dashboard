# Branch — My Shipments Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | My Shipments (Branch) |
| **Slug** | `branch-my-shipments` |
| **Module** | Branch |
| **Navigation Path** | Branch Home → My Shipments |
| **Priority** | P1 |

## Business Purpose

Allows branch staff to view and manage all outbound shipments created by this branch. Provides status tracking (Draft, Dispatched, Delivered) and visibility into which pharmacies have received shipments.

## UI Elements (verified 2026-07-09)

### Shipments List
| Element | Description |
|---------|-------------|
| Page title | `My Shipments` heading |
| Filter dropdown | `Filter by status` |
| Shipment cards | Composite content-desc — tap opens Shipment Detail |
| Status badges | Draft, Dispatched, Delivered |

### Shipment Detail (tap a card → `Shipment Details` page)
| Field | Description |
|-------|-------------|
| Summary card | Name, status, From, To, Items, Packs, Dispatched date, Created date |
| Items section | SSCC codes + status (e.g. `6 pack(s)  •  in_transit`) |
| **Cancel Shipment** button | Red — appears for Dispatched only; allows cancelling the dispatch |

**Note:** Tapping an item inside Shipment Details does NOT navigate deeper.

## Happy Path

1. From Branch Home, tap **My Shipments**.
2. Shipments list appears with all branch-created shipments.
3. Each card shows: shipment name, sender ("Main warehouse" or Janssen), receiver (pharmacy name), items × packs, date, status.
4. Use the **Filter by status** dropdown to narrow results.
5. Tap a shipment to open detail view.

## Observed Data in Screenshots

| Shipment | Status | From | To |
|----------|--------|------|----|
| test-963147 | Delivered | Main warehouse | PH Sydy Bishr esaaf 24 |
| test-96324 | Delivered | Janssen | Main warehouse |
| test-96321 | Draft | Janssen | Main warehouse |
| test_ph_20 | Dispatched | Main warehouse | PH Sydy Bishr esaaf 24 |
| test_ph_16 | Dispatched | Main warehouse | PH Sydy Bishr esaaf 24 |

## Edge Cases & Validation Rules

- Draft shipments: can be edited (add packs) or dispatched.
- Dispatched: read-only until confirmed as delivered by recipient.
- Delivered: fully read-only.
- Empty list: show empty-state message.

## Notes

- Observed statuses: **Draft**, **Dispatched**, **Delivered**.
- Both inbound (from Janssen) and outbound (to pharmacy) shipments appear in the list.
