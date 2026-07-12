# Pharmacy — My Returns Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | My Returns (Pharmacy) |
| **Slug** | `pharmacy-my-returns` |
| **Module** | Pharmacy |
| **Navigation Path** | Pharmacy Home → My Returns |
| **Priority** | P2 |

## Business Purpose

Provides pharmacy staff with a history of all return requests they have initiated. Allows tracking of return statuses (Pending, Confirmed, Cancelled) and review of individual return details.

## UI Elements

| Element | Type | Description |
|---------|------|-------------|
| Filter button | Dropdown | Filter returns by status |
| Return list cards | List items | Return #, From GLN, To GLN, Items count, Created date, Status badge |
| Status badges | Labels | CONFIRMED (green), PENDING (yellow/orange), CANCELLED (red) |
| Return card tap | Navigation | Opens return detail view |

## Happy Path

1. From Pharmacy Home, tap **My Returns**.
2. Returns list appears showing all return requests created by this pharmacy.
3. Each card shows: Return number (e.g. `RET-2026-000019`), From (source GLN), To (destination GLN), Items count, Created date, and status badge.
4. Use **Filter** to narrow by status.
5. Tap a return card to view its detail.

## Edge Cases & Validation Rules

- Empty list: show an empty-state message.
- Cancelled returns cannot be reactivated.
- Filter with no matching returns: show an empty filtered state.

## Notes

- Observed statuses in test data: **CONFIRMED**, **CANCELLED**.
- Return numbers follow the format `RET-YYYY-NNNNNN`.
- GLN values are numeric identifiers for supply chain parties.
