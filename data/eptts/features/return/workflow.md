# Return Module — Workflow

> **Scope**: This module covers **patient → pharmacy** returns only (packs previously dispensed to a patient being returned to the pharmacy). For pharmacy → distributor/branch returns, see `../return-to-distributor/workflow.md`.

---

## Feature Details

| Field | Value |
|-------|-------|
| Feature IDs | EPTTS_FR_13, EPTTS_FR_14 |
| Module Path | Main Screen → Switch to RETURN mode (Ctrl+3) |
| User | Pharmacy User |
| Priority | P2 |
| App Version | v2.3.5 |
| Screenshots | `screenshots/Return.jpg` |

---

## Business Purpose

Accept pharmaceutical products returned by patients back to the pharmacy. Only packs previously dispensed (Dispensed or Partial Dispensed) can be returned. Currently, all returns are full — partial quantity returns are not supported.

---

## Screens & UI Elements

### Main Screen — RETURN Mode
- **Mode button**: RETURN (orange) — left side of the UI
- **No sub-mode toggle** — no Pack/Strip distinction for returns
- **Item counter**: large number in center (starts at 0)
- **Status dot**: green (online) / grey (offline)
- **X button**: clears the current scanned list without submitting
- **Gear icon**: opens Settings panel
- **Status bar**: `✓ All synced`
- **Counters bar**: `Sold: 0  In: 0  Ret: 0  RTB: 0` — the `Ret` counter reflects confirmed patient returns
- **Scan area**: hidden by default; revealed by double-clicking the white border or pressing Ctrl+V

---

## User Flow — Happy Path

1. User is on the main screen after login.
2. User clicks the mode button or presses **Ctrl+3** to switch to **RETURN** (orange) mode.
3. User double-clicks the white border to open the scan input field, or connects the barcode scanner.
4. User scans the **DataMatrix** of the returned pack OR pastes via Ctrl+V.
5. Application validates against Masar:
   - Pack state = Dispensed or Partial Dispensed ✓
   - Pack belongs to this pharmacy GLN ✓
   - Pack has not already been returned ✓
6. Product is added to the return list; item counter increments.
7. User may scan additional returned packs (repeat steps 3–6).
8. User confirms with **Ctrl+Shift+D** or clicks the **item counter number**.
9. Transaction submitted:
   - **Online**: packs transition to **Returned** → Queue entry created (Synced) → History updated (Returns).
   - **Offline**: saved locally → Queue = Pending → synced on reconnect.
10. Green toast confirms success; counter resets to 0.

> **Note on partial returns**: Scanning a Partial Dispensed pack returns the entire pack regardless of how many strips were originally dispensed. No quantity selection is presented. Full return only.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Switch to RETURN mode | Ctrl+3 |
| Paste DataMatrix | Ctrl+V |
| Confirm transaction | Ctrl+Shift+D |
| Clear scanned items | Ctrl+Shift+X |
| Open scan input field | Double-click white border |

---

## Validation Rules

| Rule | Behavior |
|------|----------|
| Pack state = Active (never dispensed) | Rejected; cannot return a pack that was never dispensed to a patient |
| Pack state = InTransit | Rejected; cannot return an unreceived pack |
| Pack state = Returned (already returned) | Rejected; duplicate return blocked |
| Pack does not belong to this pharmacy GLN | Rejected; GLN ownership error |
| Invalid DataMatrix format | Rejected; format validation error |
| Same DataMatrix added twice in the same transaction | Rejected; duplicate blocked |
| SSCC barcode scanned | Rejected; SSCC is not supported in Return mode |

---

## State Transitions

```
Dispensed
  → (return confirmed) → Returned

Partial Dispensed
  → (return confirmed) → Returned  [full return — no partial return supported currently]
```

---

## Edge Cases

- **Partial return not supported**: A Partial Dispensed pack is always returned fully. Future quantity-based partial returns may be added (TBD with PO).
- **Multiple packs in one return transaction**: User can scan multiple different packs before confirming.
- **Offline return**: Saved locally, Queue = Pending; synced automatically on reconnect.
- **Return of a pack belonging to a different pharmacy**: GLN validation must reject it.

---

## Known Defects

- None documented at this time.

---

## Integration Points

- **Masar backend**: Validates pack state and GLN ownership; processes Dispensed/Partial Dispensed → Returned transition.
- **Queue**: Every confirmed return creates a Queue entry (Pending → Synced).
- **History**: Confirmed returns appear under the **Returns** tab in Settings → History.
