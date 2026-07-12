# Distributor — Returns Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Returns (Distributor) |
| **Slug** | `distributor-returns` |
| **Module** | Distributor |
| **Navigation Path** | Distributor Home → Returns |
| **Priority** | P2 |

## Business Purpose

Provides the distributor with a sub-menu for managing all return flows — initiating returns back to the manufacturer, viewing the distributor's own return history, and processing incoming returns from pharmacies/branches.

## Sub-Features

| Tile | Colour | Purpose |
|------|--------|---------|
| **Manufacturer Return** | Blue | Initiate a return of packs from distributor back to manufacturer |
| **My Returns** | Green | View history of returns the distributor has created |
| **Incoming Returns** | Yellow/Tan | View and process returns received from pharmacies/branches |

---

## Manufacturer Return

### UI Elements
| Element | Type | Description |
|---------|------|-------------|
| Scan area | Camera input | "Tap to scan pack / SSCC" |
| Note field | Optional text | "Note (optional)" — reason for return |
| Initiate Return button | Primary action | Submits the return request |

### Happy Path
1. From Returns menu, tap **Manufacturer Return**.
2. Screen shows a barcode scan prompt and optional **Note** field.
3. Tap the scan area; scan the pack barcode or SSCC (container code).
4. Optionally enter a note (reason for return).
5. Tap **Initiate Return** to submit.
6. Success confirmation shown; return appears in My Returns.

---

## My Returns

### UI Elements
| Element | Description |
|---------|-------------|
| Filter button | Filter returns by status |
| Return cards | Return #, From GLN (↑), To GLN (↓), Items count, Created date, Status badge |
| Status badges | CONFIRMED (green), CANCELLED (red/pink) |

### Happy Path
1. From Returns menu, tap **My Returns**.
2. List of all return requests created by this distributor.
3. Each card: Return number (e.g. `RET-2026-000019`), From/To GLN, Items, Created date, status.
4. Use **Filter** to narrow results.
5. Tap a return to see detail.

---

## Incoming Returns

### UI Elements
| Element | Description |
|---------|-------------|
| Filter button | Filter by status |
| Return cards | Return #, From GLN, To GLN, Items, Created date, Status badge |
| Status badges | PENDING (yellow/orange), CANCELLED (red/pink) |

### Happy Path
1. From Returns menu, tap **Incoming Returns**.
2. List of returns sent to this distributor by downstream parties (pharmacies/branches).
3. Observe statuses: **PENDING** (awaiting action), **CANCELLED**.
4. Tap a return to review and accept/reject it.

## Edge Cases & Validation Rules

- Manufacturer Return: scan required — note is optional.
- Invalid barcode: error message.
- Cancelled returns cannot be reactivated.
- PENDING incoming returns require action before they expire.

## Notes

- Return IDs: `RET-2026-NNNNNN` format (sequential) or `AGENT-RTB-<UUID>` format (agent-generated).
- GLN values in observed test data: `6224010009998`, `5413868000009`, `6224010004313`.
- Observed statuses: **CONFIRMED**, **CANCELLED**, **PENDING**.
