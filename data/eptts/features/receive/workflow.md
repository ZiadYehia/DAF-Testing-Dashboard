# Receive Module — Workflow

---

## Feature Details

| Field | Value |
|-------|-------|
| Feature IDs | EPTTS_FR_07, EPTTS_FR_08, EPTTS_FR_09 |
| Module Path | Main Screen → Switch to RECEIVE mode (Ctrl+2) |
| User | Pharmacy User |
| Priority | P1 |
| App Version | v2.3.5 |
| Screenshots | `screenshots/Receive.jpg` |

---

## Business Purpose

Convert pharmaceutical products shipped to the pharmacy from **InTransit** to **Active** state so they become available for dispensing. Supports both individual pack (DataMatrix) and full shipping container (SSCC) receive in a single workflow.

---

## Screens & UI Elements

### Main Screen — RECEIVE Mode
- **Mode button**: RECEIVE (blue) — left side of the UI
- **Item counter**: large number in center (starts at 0; increments per item added to the list)
- **Status dot**: green (online) / grey (offline)
- **X button**: clears all scanned items from the current list without submitting
- **Gear icon**: opens Settings panel
- **Status bar**: `✓ All synced` (or sync-in-progress indicator)
- **Counters bar**: `Sold: 0  In: 0  Ret: 0  RTB: 0` — the `In` counter reflects confirmed received packs
- **Scan area**: hidden by default (white border visible); revealed by double-clicking the border or pressing Ctrl+V
- **Toast notification**: `ℹ Switched to Receive` — appears briefly when mode is activated

### Scan Input
- Hidden text field — user **double-clicks the white border** of the main area to open it
- Alternatively, press **Ctrl+V** to paste a DataMatrix or SSCC string directly
- A connected barcode scanner (USB/HID) inputs directly into the active field

---

## User Flow — Happy Path (Single Pack)

1. User is on the main screen after login.
2. User clicks the mode button or presses **Ctrl+2** to switch to **RECEIVE** (blue) mode.
3. Toast `ℹ Switched to Receive` confirms the mode switch.
4. User double-clicks the white border to open the scan input field, or connects the barcode scanner.
5. User scans the **DataMatrix** of the pack OR pastes the DataMatrix string via Ctrl+V.
6. Application validates the pack against Masar:
   - Pack belongs to this pharmacy GLN ✓
   - Pack is in InTransit state ✓
   - Pack is not expired ✓
   - Pack has not already been received ✓
7. Product is added to the scanned list; item counter increments to 1.
8. User may scan additional packs (repeat steps 4–7); counter increments for each.
9. When ready, user confirms the transaction by pressing **Ctrl+Shift+D** or clicking the **item counter number**.
10. Transaction is submitted:
    - **Online**: Masar processes the receive → all scanned packs transition to **Active** → Queue entry created (Synced) → History updated (Received).
    - **Offline**: Transaction saved locally → Queue entry created (Pending) → synced automatically when internet is restored.
11. Item counter resets to 0; scan list is cleared.

## User Flow — Happy Path (SSCC)

1–4. Same as Single Pack steps above.
5. User scans or pastes an **SSCC** barcode. Application detects SSCC format automatically.
6. ALL inner packs of the SSCC are validated and added to the receive list; counter shows total inner pack count.
7. User confirms with **Ctrl+Shift+D** or clicks the counter number.
8. All inner packs transition from **InTransit → Active** in one operation.
9. One transaction entry appears in Queue and History representing the full SSCC receive.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Switch to RECEIVE mode | Ctrl+2 |
| Paste DataMatrix / SSCC | Ctrl+V |
| Confirm transaction | Ctrl+Shift+D |
| Clear scanned items | Ctrl+Shift+X |
| Open scan input field | Double-click white border |

---

## Validation Rules

| Rule | Behavior |
|------|----------|
| Pack does not belong to this pharmacy GLN | Rejected; error shown; pack not added to list |
| Pack is not in InTransit state (already Active) | Rejected; cannot receive an already-received pack |
| Pack is expired | Rejected; expired product cannot be received |
| Pack does not exist in Masar | Rejected; unknown pack or invalid DataMatrix |
| DataMatrix format is invalid | Rejected; format validation error shown |
| Same DataMatrix added twice in the same transaction | Rejected; duplicate scan blocked |
| SSCC contains packs in invalid states | SSCC rejected or specific inner packs rejected (TBD with PO) |

---

## State Transitions

```
InTransit
  → (receive confirmed, online) → Active
  → (receive confirmed, offline) → Active (after Queue sync)
```

---

## Edge Cases

- **SSCC with already-received packs**: Behavior when some inner packs are already Active — TBD with PO.
- **Partial SSCC receive**: Not supported. Either all inner packs are received or the whole operation fails.
- **Single pack vs SSCC**: Known issue — single pack receive may fail with "Pack URN not found" while receiving the same pack via its parent SSCC succeeds.
- **Offline receive**: Transaction saved locally, Queue = Pending. On reconnect, Masar processes the receive and Queue updates to Synced.
- **Large SSCC**: SSCCs with many inner packs should not freeze the UI or cause a timeout.
- **Clear mid-session**: Pressing Ctrl+Shift+X discards all scanned items without submitting any transaction.

---

## Known Defects

- **Single pack receive — "Pack URN not found"**: Receiving an individual pack via DataMatrix may fail with this error even though the pack is valid. SSCC receive for the same pack typically succeeds.

---

## Integration Points

- **Masar backend**: Validates pack ownership (GLN), state (InTransit), and expiry; processes InTransit → Active transition.
- **Queue**: Every confirmed receive creates a Queue entry (Pending → Synced).
- **History**: Confirmed receives appear under the **Received** tab in Settings → History.
