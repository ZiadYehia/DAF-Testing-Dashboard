# Distributor — EPCIS History Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | EPCIS History (Distributor) |
| **Slug** | `distributor-epcis-history` |
| **Module** | Distributor |
| **Navigation Path** | Distributor Home → EPCIS History |
| **Priority** | P2 |

## Business Purpose

Shows the distributor's full EPCIS event log — every supply-chain event (shipping, receiving, unpacking) that was submitted to the national EPTTS registry on behalf of this distributor. Provides visibility into EPCIS submission success/failure for compliance monitoring.

## UI Elements

| Element | Type | Description |
|---------|------|-------------|
| Status filter dropdown | Dropdown | "All statuses" → filter by Completed / Failed |
| Event list cards | List | Event hash ID, Event type label, Sender, Receiver, Items, (Failed count), Event Time, Status badge |
| Status badges | Labels | Completed (green), Failed (red/orange) |
| "N of N events failed" | Summary text | Appears on Failed entries |
| "View event errors" link | Tappable link | Opens error detail for failed EPCIS submissions |

## EPCIS Event Types Observed

| Event Type | Description |
|------------|-------------|
| **RECEIVING** | Pack/shipment received by this distributor |
| **SHIPPING** | Pack/shipment dispatched from this distributor |
| **UNPACKING** | Container/case was unpacked at this distributor |

## Happy Path

1. From Distributor Home, tap **EPCIS History**.
2. EPCIS History screen opens with a **Status** dropdown (default: "All statuses").
3. Event list shows EPCIS transactions ordered by event time (newest first).
4. Each card shows: UUID event hash, event type (**RECEIVING** / **SHIPPING** / **UNPACKING**), Sender name, Receiver name, Items count, Event Time.
5. Status badge shows **Completed** (green) or **Failed** (red).
6. For **Failed** entries, tap the card to open an error detail **bottom sheet** (NOT a new page).
7. Bottom sheet shows Sequence#, event type, error code, error message.
8. Tap **×** to dismiss.

## Edge Cases & Validation Rules

- Failed events should have actionable error details via "View event errors".
- Empty list: show an appropriate empty-state message.
- Network error: show a retry option.

## Notes

- EPCIS event IDs are UUIDs (hex strings, e.g. `9836703d37524caea8e115caf675c0c0`).
- Receiver names in test data include Arabic pharmacy names (e.g. `صيدلية د. هشام ابراهيم`), indicating multi-language support.
- Observed test parties: "New Branch", "Janssen", "provision hospitals cairo tender".
