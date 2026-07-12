# Return to Distributor Module — Workflow

> **Scope**: This module covers **pharmacy → branch/distributor** returns only (Active packs being returned to the distribution branch). For patient → pharmacy returns, see `../return/workflow.md`.

---

## Feature Details

| Field | Value |
|-------|-------|
| Feature IDs | EPTTS_FR_15, EPTTS_FR_16, EPTTS_FR_17 |
| Module Path | Main Screen → Switch to RTN BRANCH mode (Ctrl+4) |
| User | Pharmacy User |
| Priority | P2 |
| App Version | v2.3.5 |
| Screenshots | `screenshots/return-to-distributor.jpg` |

---

## Business Purpose

Allow the pharmacy to return **Active** products back to the distribution branch (e.g., recalled products, slow-moving stock, or incorrectly received shipments). The return request is sent to Masar for the branch to accept or reject. On branch acceptance, the pack transitions back to InTransit on the branch side.

---

## Screens & UI Elements

### Main Screen — RTN BRANCH Mode
- **Mode button**: RTN BRANCH (violet) — left side of the UI
- **No sub-mode toggle** — supports both DataMatrix (single pack) and SSCC (shipping container) automatically
- **Item counter**: large number in center (starts at 0)
- **Status dot**: green (online) / grey (offline)
- **X button**: clears the current scanned list without submitting
- **Gear icon**: opens Settings panel
- **Status bar**: `✓ All synced`
- **Counters bar**: `Sold: 0  In: 0  Ret: 0  RTB: 0` — the `RTB` counter reflects confirmed branch returns
- **Scan area**: hidden by default; revealed by double-clicking the white border or pressing Ctrl+V

---

## User Flow — Happy Path (Single Pack)

1. User is on the main screen after login.
2. User clicks the mode button or presses **Ctrl+4** to switch to **RTN BRANCH** (violet) mode.
3. User double-clicks the white border to open the scan input field, or connects the barcode scanner.
4. User scans the **DataMatrix** of the pack to return OR pastes via Ctrl+V.
5. Application validates against Masar:
   - Pack state = Active ✓
   - Pack belongs to this pharmacy GLN ✓
   - Pack is not expired ✓
6. Product is added to the return-to-distributor list; item counter increments.
7. User may scan additional packs (repeat steps 3–6).
8. User confirms with **Ctrl+Shift+D** or clicks the **item counter number**.
9. Transaction submitted to Masar:
   - A return request is sent to the distribution branch.
   - The branch receives a pending return request and can accept or reject it.
   - On **branch acceptance**: packs transition back to **InTransit** on the branch side.
   - On **branch rejection**: packs remain Active at the pharmacy; the transaction is recorded as rejected.
10. Queue entry created (Pending → Synced); RTB counter on the main screen increments.
11. Counter resets to 0; scan list is cleared.

## User Flow — Happy Path (SSCC)

1–3. Same as Single Pack steps above.
4. User scans or pastes an **SSCC** barcode. Application detects SSCC format automatically.
5. ALL inner packs of the SSCC are validated (all must be Active and belong to this pharmacy GLN).
6. All inner packs are added to the return-to-distributor list; counter shows total pack count.
7. User confirms with **Ctrl+Shift+D** or the counter number.
8. One return request is sent for the entire SSCC; branch accepts or rejects the shipment.
9. On branch acceptance: all inner packs transition to **InTransit** on the branch side.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Switch to RTN BRANCH mode | Ctrl+4 |
| Paste DataMatrix / SSCC | Ctrl+V |
| Confirm transaction | Ctrl+Shift+D |
| Clear scanned items | Ctrl+Shift+X |
| Open scan input field | Double-click white border |

---

## Validation Rules

| Rule | Behavior |
|------|----------|
| Pack state = InTransit (not yet received) | Rejected; cannot return an unreceived pack |
| Pack state = Dispensed | Rejected; dispensed packs cannot be returned to distributor |
| Pack state = Returned (patient return) | Rejected; already in returned state |
| Pack does not belong to this pharmacy GLN | Rejected; GLN ownership error |
| Pack is expired | Rejected; expired packs cannot be returned via this flow |
| Same DataMatrix added twice in the same transaction | Rejected; duplicate blocked |
| SSCC contains packs with mixed states (some not Active) | SSCC rejected; all inner packs must be Active |

---

## State Transitions

```
Active (at pharmacy)
  → (RTN BRANCH confirmed, branch accepts) → InTransit (at branch)
  → (RTN BRANCH confirmed, branch rejects) → Active (pack remains at pharmacy)
```

---

## Edge Cases

- **Branch rejection**: If the branch rejects the return, the pack remains Active at the pharmacy. The transaction should be recorded as rejected in History and Queue.
- **Partial SSCC return**: If not all inner packs are Active, the SSCC return is blocked. Only full SSCCs with all Active packs can be returned.
- **Offline return to distributor**: Transaction saved locally, Queue = Pending. On reconnect, the return request is sent to Masar and branch. Note: branch cannot act on a pending request until it is synced.
- **Multiple transactions before branch response**: The pharmacy can submit multiple RTN BRANCH transactions; each is queued independently.
- **Return of a recalled product**: Active recall products must be returned using this flow, not the patient return flow.

---

## Known Defects

- None documented at this time (new feature — DW-### to be assigned if defects found).

---

## Integration Points

- **Masar backend**: Validates pack state and GLN; creates a pending return request for the distribution branch.
- **Branch system**: Branch receives the return request in their Masar interface and can accept or reject.
- **Queue**: Every confirmed RTN BRANCH transaction creates a Queue entry (Pending → Synced).
- **History**: Confirmed branch returns appear under the **RTN BRANCH** tab in Settings → History.
