# Pharmacy — EPCIS History Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | EPCIS History (Pharmacy) |
| **Slug** | `pharmacy-epcis-history` |
| **Module** | Pharmacy |
| **Navigation Path** | Pharmacy Home → EPCIS History |
| **Priority** | P2 |

## Business Purpose

Shows the pharmacy's full Electronic Product Code Information Services (EPCIS) event log. Each entry represents a supply-chain event (shipping, receiving, unpacking, dispensing) that was submitted to the national EPTTS registry. Allows the pharmacist to verify EPCIS submission statuses and diagnose failures.

## UI Elements

| Element | Type | Description |
|---------|------|-------------|
| Status filter dropdown | Dropdown | "All statuses" → filter by Completed / Failed |
| Event list cards | List | Event hash ID, Event type label, Sender, Receiver, Items, Event Time, Status badge |
| Status badges | Labels | Completed (green), Failed (red) |
| "View event errors" link | Link | Appears on Failed entries; taps to show error details |

## EPCIS Event Types Observed

| Event Type | Description |
|------------|-------------|
| **SHIPPING** | Pack was shipped from one party to another |
| **RECEIVING** | Pack was received by a party |
| **UNPACKING** | Container/case was unpacked |
| **DISPENSING** | Pack was dispensed to a patient |

## Happy Path

1. From Pharmacy Home, tap **EPCIS History**.
2. EPCIS History screen opens with a **Status** dropdown (default: "All statuses").
3. The event list shows EPCIS transactions ordered by event time (newest first).
4. Each card shows: truncated event hash ID, event type (e.g. **SHIPPING**), Sender, Receiver, Items count, Event Time.
5. Status badge shows **Completed** (green) or **Failed** (red).
6. For **Failed** entries, tap the card to open an error detail **bottom sheet** (NOT a new page).
7. Bottom sheet shows: event UUID title, Sequence#, event type, error code (e.g. `INTEGRITY_ERROR`), error message.
8. Tap **×** to dismiss the bottom sheet.
9. Use the Status dropdown to filter by Completed or Failed.

## EPCIS Error Bottom Sheet (verified 2026-07-09)

Tapping a Failed event card opens a bottom sheet:
- Title: event UUID hash
- Per-sequence entries: Sequence #, event type, error code, error message
- Close button (×)
- "View event errors" text is embedded in the card composite content-desc — the whole **card** is tapped (no separate link element)

## Edge Cases & Validation Rules

- Failed events include a "1 of N events failed" summary and a "View event errors" link.
- Empty list: show an appropriate empty-state message.
- Network error: show a retry option.
- Filter by Failed with no failures: show an empty filtered state.

## Notes

- EPCIS event hashes are UUIDs used as transaction identifiers in the EPTTS registry.
- Both the pharmacy's own events (as sender or receiver) appear in this list.
