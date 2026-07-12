# Sell / Dispense Module — Workflow

---

## Feature Details

| Field | Value |
|-------|-------|
| Feature IDs | EPTTS_FR_10, EPTTS_FR_11, EPTTS_FR_12 |
| Module Path | Main Screen → Switch to SELL mode (Ctrl+1) |
| User | Pharmacy User |
| Priority | P1 |
| App Version | v2.3.5 |
| Screenshots | `screenshots/Sell.jpg` |

---

## Business Purpose

Dispense pharmaceutical products to patients by converting **Active** packs to **Dispensed** (full pack) or **Partial Dispensed** (partial strips/tablets). Supports both Pack Mode and Strip Mode within the same scan-and-confirm workflow.

---

## Screens & UI Elements

### Main Screen — SELL Mode
- **Mode button**: SELL (green) — left side of the UI
- **Sub-mode buttons**: **PACK** (white/active) and **STRIP** — immediately to the right of the SELL button
- **Item counter**: large number in center (starts at 0; increments per item added)
- **Status dot**: green (online) / grey (offline)
- **X button**: clears the current scanned item list without submitting
- **Gear icon**: opens Settings panel
- **Status bar**: `✓ All synced`
- **Counters bar**: `Sold: 0  In: 0  Ret: 0  RTB: 0` — the `Sold` counter reflects confirmed sales
- **Scan area**: hidden by default; revealed by double-clicking the white border or pressing Ctrl+V

### Strip Mode — Quantity Selection
- After scanning a pack in Strip Mode, a quantity selector appears.
- System shows the **maximum allowed quantity** for the product as stored in Masar (e.g., 10 strips).
- User selects quantity from **1 to max**.
- Quantity applies to the currently scanned pack only.

---

## User Flow — Happy Path (Pack Mode)

1. User is on the main screen after login.
2. User clicks the mode button or presses **Ctrl+1** to switch to **SELL** (green) mode.
3. Verify the sub-mode shows **PACK** (Pack Mode is the default).
4. User double-clicks the white border to open the scan input field, or connects the barcode scanner.
5. User scans the **DataMatrix** of the pack OR pastes via Ctrl+V.
6. Application validates against Masar:
   - Pack state = Active ✓
   - Pack belongs to this pharmacy GLN ✓
   - Pack is not expired ✓
   - Pack is not already dispensed ✓
7. Product is added to the sell list; item counter increments.
8. User may scan additional packs (repeat steps 4–7).
9. User confirms with **Ctrl+Shift+D** or clicks the **item counter number**.
10. Transaction submitted:
    - **Online**: packs transition to **Dispensed** → Queue entry created (Synced) → History updated (Sales).
    - **Offline**: saved locally → Queue = Pending → synced on reconnect.
11. Green toast confirms success; counter resets to 0.

## User Flow — Happy Path (Strip Mode)

1–3. Same as Pack Mode, but user clicks the **PACK** sub-mode button to toggle to **STRIP**, or presses **Ctrl+Shift+S**.
4. User scans or pastes the DataMatrix of the pack.
5. Quantity selection field appears; system shows the maximum allowed quantity.
6. User enters or selects the desired quantity (1 to max).
7. Product is added to the sell list with the selected quantity; counter increments.
8. User may add more products.
9. User confirms with **Ctrl+Shift+D** or the counter.
10. Pack transitions to **Partial Dispensed**; recorded in Queue and History (Sales).

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Switch to SELL mode | Ctrl+1 |
| Toggle Pack / Strip sub-mode | Ctrl+Shift+S |
| Paste DataMatrix | Ctrl+V |
| Confirm transaction | Ctrl+Shift+D |
| Clear scanned items | Ctrl+Shift+X |
| Open scan input field | Double-click white border |

---

## Validation Rules

| Rule | Behavior |
|------|----------|
| Pack state = InTransit (not yet received) | Rejected; cannot sell an unreceived pack |
| Pack state = Dispensed (already dispensed) | Rejected; already dispensed |
| Pack state = Returned | Rejected; returned packs cannot be re-sold |
| Pack does not belong to this pharmacy GLN | Rejected; GLN ownership error |
| Pack is expired | Rejected |
| Quantity = 0 | Blocked; must be at least 1 |
| Quantity > max allowed by Masar | Blocked; system enforces the maximum quantity limit |
| Same DataMatrix added twice in the same transaction | Rejected; duplicate blocked |
| SSCC barcode scanned in Sell mode | Rejected; SSCC is not supported in Sell mode |

---

## State Transitions

```
Active
  → (Pack Mode sell confirmed) → Dispensed
  → (Strip Mode sell confirmed) → Partial Dispensed
```

---

## Edge Cases

- **Pack after Strip (high-risk)**: After a Partial Dispensed sell, attempting a full Pack Mode dispense on the same pack may be blocked or may succeed inconsistently. Behavior must be verified with PO.
- **Multiple products in one transaction**: User can scan multiple different products before confirming; all are submitted as one transaction.
- **Offline sell**: Local save → Queue Pending → sync on reconnect. Masar state transition happens only after sync.
- **Max quantity enforcement**: If the product max is 10 strips but user enters 11, the system must block submission.
- **Clear mid-transaction**: Ctrl+Shift+X removes all items from the current list without submitting.
- **Mixed Pack and Strip in one transaction**: Not currently supported — sub-mode applies to the whole transaction, not per item.

---

## Known Defects

- **Strip/Pack rule inconsistency (high-risk)**: After a strip dispense sets a pack to Partial Dispensed, full pack dispense behavior is inconsistent and considered a high-risk area.

---

## Integration Points

- **Masar backend**: Validates pack state, GLN ownership, and max strip quantity; processes Dispensed or Partial Dispensed transition.
- **Queue**: Every confirmed sell creates a Queue entry (Pending → Synced).
- **History**: Confirmed sells appear under the **Sales** tab in Settings → History.
