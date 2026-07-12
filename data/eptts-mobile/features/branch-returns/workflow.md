# Branch — Returns Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Returns (Branch) |
| **Slug** | `branch-returns` |
| **Module** | Branch |
| **Navigation Path** | Branch Home → Returns |
| **Priority** | P2 |

## Business Purpose

Provides the branch with a sub-menu for managing all return flows — initiating returns to the manufacturer, viewing the branch's own return history, and processing incoming returns from pharmacies.

## Sub-Features

| Tile | Colour | Purpose |
|------|--------|---------|
| **Manufacturer Return** | Blue | Initiate a return of packs/SSCCs from branch back to manufacturer |
| **My Returns** | Green | View history of returns the branch has initiated (branch → manufacturer) |
| **Incoming Returns** | Yellow/Tan | Process returns received from pharmacies (pharmacy → branch) |

---

## Manufacturer Return (verified 2026-07-09)

### UI Elements
| Element | Content-Desc | Type | Notes |
|---------|-------------|------|-------|
| Scan circle | *(no content-desc)* | `android.view.View` clickable | Circle has no identifier; tap label to propagate click |
| Scan label | `Tap to scan pack / SSCC` | `android.view.View` | Label below the scan circle |
| Note field | `Note (optional)` | `android.widget.EditText` | Optional return reason |
| Initiate Return button | `Initiate Return` | `android.widget.Button` | Submits the return |

### Happy Path
1. Tap **Manufacturer Return** from Returns sub-menu
2. Scan the pack or SSCC barcode
3. Optionally type a note (return reason)
4. Tap **Initiate Return** → return is created with PENDING status

---

## My Returns (verified 2026-07-09)

### List Screen
| Element | Content-Desc | Notes |
|---------|-------------|-------|
| Page title | `My Returns` | heading |
| Filter button | `Filter` | Opens date range + status filter panel |
| Return cards | Composite multi-line content-desc | Return #, Status, From/To GLN, Items, Created |

### Filter Panel (opened by tapping Filter)
| Field | Description |
|-------|-------------|
| From Date | Date picker |
| To Date | Date picker |
| Status | Dropdown (All, CONFIRMED, CANCELLED, PENDING) |
| Apply Filter | Submits filter |

### Return Detail Screen (tap any card)
| Field | Value example | Notes |
|-------|--------------|-------|
| Return # | `RET-2026-000006` | |
| Status | `CONFIRMED` (green) | or CANCELLED, PENDING |
| From | GLN number | Branch GLN |
| To | GLN number | Manufacturer GLN |
| Items | 1 | Item count |
| **Type** | `branch to manufacturer` | Direction of return |
| **Note** | "test" | Optional reason entered at creation |
| Created | `9/6/2026 09:34` | |
| Confirmed | `9/6/2026 09:35` | Only present for CONFIRMED returns |
| Items section | SSCC code + "SSCC" label | The scanned item(s) |

- CONFIRMED and CANCELLED returns are **read-only** — no action buttons
- Page title: `"Return Details"`

---

## Incoming Returns (verified 2026-07-09)

### List Screen
| Element | Content-Desc | Notes |
|---------|-------------|-------|
| Page title | `Incoming Returns` | heading |
| Filter button | `Filter` | Same filter panel as My Returns |
| Return cards | Composite multi-line content-desc | |
| Statuses observed | PENDING (yellow), CANCELLED (pink), CONFIRMED (green) | |

### Return Detail Screen — PENDING (actionable)
| Field | Value example | Notes |
|-------|--------------|-------|
| **Type** | `pharmacy to branch` | Return is FROM pharmacy TO this branch |
| Note | "expired" | Reason from pharmacy |
| **Confirm Return** | Green button | Accepts the return — moves inventory to branch |
| **Cancel Return** | Red outline button | Rejects the return |

- PENDING incoming returns have **two action buttons** (`Confirm Return` + `Cancel Return`)
- Once confirmed or cancelled, these buttons disappear (returns become read-only)
- Page title: `"Return Details"` (same component as My Returns detail)

## Edge Cases & Validation Rules

- Identical edge cases to Distributor Returns.
- PENDING incoming returns require branch action.

## Notes

- Returns UI is visually identical to the Distributor's Returns screen — same 3 sub-tiles, same colours.
- The branch acts as both sender (to manufacturer) and receiver (from pharmacies) in the returns chain.
