# Queue & Settings Module — Workflow

---

## Feature Details

| Field | Value |
|-------|-------|
| Feature IDs | EPTTS_FR_18, EPTTS_FR_19, EPTTS_FR_20, EPTTS_FR_21, EPTTS_FR_22, EPTTS_FR_23, EPTTS_FR_24 |
| Module Path | Main Screen → Gear icon → Settings panel (5 tabs) |
| User | Pharmacy User |
| Priority | P1 (Queue) / P2–P3 (Settings tabs) |
| App Version | v2.3.5 |
| Screenshots | `screenshots/queue.jpg`, `screenshots/settings-overview.jpg`, `screenshots/settings-history.jpg`, `screenshots/settings-products.jpg`, `screenshots/settings-shortcuts.jpg`, `screenshots/keyboard-default-shortcuts.jpg` |

---

## Business Purpose

**Queue** is the technical synchronization log — every transaction performed (Receive, Sell, Return, RTN BRANCH) is saved locally first, then synced to Masar. Queue tracks the lifecycle of each sync attempt.

**Settings** provides operational tools: pharmacy overview counters, manual sync triggers, product catalog, history log, and customizable keyboard shortcuts.

---

## Opening Settings

1. User clicks the **gear icon** on the main screen (top right area).
2. Settings panel slides open showing:
   - **Pharmacy name** (header)
   - **Email** (sub-header)
   - **Location ID** (GLN)
   - **5 tabs**: OVERVIEW · PRODUCTS · QUEUE · HISTORY · SHORTCUTS

---

## Tab: QUEUE (EPTTS_FR_18, EPTTS_FR_19, EPTTS_FR_20)

### UI Elements
- **Summary bar**: `↻ {n} pending  ✗ {n} failed  ✓ {n} synced` (orange / red / green)
- **Search field**: `Search queue...`
- **Filter tabs**: ALL · PENDING · FAILED · SYNCED
- **Transaction list**: each item shows type (Sell/Receive/Return/RTN Branch), date/time, status
- **Retry button**: appears on each FAILED item
- **Retry All button**: retries all FAILED items in one action

### Queue Transaction Lifecycle

```
Transaction performed (online or offline)
  → Saved locally → Queue entry: PENDING
  → Internet available → Auto-sync or manual Sync Now
  → Masar accepts → Queue status: SYNCED
  → Masar rejects / timeout → Queue status: FAILED
  → (on FAILED) User clicks Retry or Retry All
  → Masar accepts → SYNCED
```

### User Flow — Viewing Queue
1. Click gear icon → Settings panel opens.
2. Click **QUEUE** tab.
3. Summary bar shows `↻ {pending}  ✗ {failed}  ✓ {synced}`.
4. Use filter tabs (PENDING / FAILED / SYNCED / ALL) to filter the list.
5. Use the search field to find a specific transaction.

### User Flow — Retry Failed Transaction
1. On the QUEUE tab, locate a FAILED item.
2. Click the **Retry** button on that item.
3. System resends the transaction to Masar.
4. Success → item status changes to SYNCED.
5. Failure → item remains FAILED; user can retry again later.

### User Flow — Retry All
1. On the QUEUE tab with multiple FAILED items visible.
2. Click **Retry All**.
3. System retries all FAILED items in sequence.
4. Each success → SYNCED. Each remaining failure → stays FAILED.

---

## Tab: OVERVIEW (EPTTS_FR_21)

### UI Elements
- **Transaction counters**: SOLD (green) · RECEIVED (blue) · RETURNED (orange) · RTN BRANCH (violet)
- **Sync summary**: `✓ {n}` (synced) / `↻ {n}` (pending) / `✗ {n}` (failed) / `{n} today`
- **Sync Now button**: manually triggers sync of all Pending transactions
- **Check Updates button**: checks for a new Masar Agent app version
- **Export Log button**: exports a diagnostic log file to disk
- **Test Connection button**: sends a ping to the Masar server and reports latency/status
- **Server Address field**: editable; shows current Masar API URL
- **Scanner Speed (ms) field**: configurable input delay for barcode scanner
- **Logout button**: at the bottom of the panel (scroll down to reveal)

### User Flow — Sync Now
1. On the OVERVIEW tab.
2. Click **Sync Now**.
3. All PENDING Queue items are processed immediately.
4. Items move to SYNCED (success) or FAILED (error).

### User Flow — Test Connection
1. On the OVERVIEW tab.
2. Click **Test Connection**.
3. App sends a test request to the Masar server.
4. Success: shows response time or "Connection OK".
5. Failure: shows error message; user should check network or Server Address.

---

## Tab: HISTORY (EPTTS_FR_23)

### UI Elements
- **Filter tabs**: ALL · SALES · RECEIVED · RETURNS · RTN BRANCH
- Lists confirmed operations with date, type, product details, and result
- Empty state: `No transactions yet. Items appear here after you confirm a sale, receive, or return.`

> **Queue vs History**: Queue tracks technical sync state. History shows confirmed business operations. A transaction appears in History once it is confirmed; it appears in Queue from the moment it is submitted until sync completes.

---

## Tab: PRODUCTS (EPTTS_FR_22)

### UI Elements
- **Search field**: `Search by code or name...`
- **Refresh button**: fetches the latest product list from Masar
- **Columns**: CODE · PRODUCT NAME
- Shows all products linked to this pharmacy GLN in the Masar system

### User Flow — Refresh Products
1. On the PRODUCTS tab.
2. Click **Refresh** (or the refresh icon).
3. App fetches the updated product catalog from Masar.
4. Product list updates with any new or removed products.

---

## Tab: SHORTCUTS (EPTTS_FR_24)

### UI Elements (Default Shortcuts)
| Action | Default Binding |
|--------|----------------|
| Confirm Transaction | Ctrl+Shift+D |
| Pack / Strip Mode toggle | Ctrl+Shift+S |
| Clear Items | Ctrl+Shift+X |

### Per-binding Controls
- **Change button**: opens binding editor for that specific shortcut
- **Save button**: saves all modified shortcuts
- **Reset button**: reverts all shortcuts to factory defaults

### User Flow — Change a Shortcut
1. On the SHORTCUTS tab.
2. Click **Change** next to the shortcut to modify.
3. Press the desired new key combination.
4. Click **Save** to apply all changes.
5. Click **Reset** to revert to defaults at any time.

---

## Keyboard Shortcuts (Main Screen)

| Action | Shortcut |
|--------|----------|
| Switch to SELL mode | Ctrl+1 |
| Switch to RECEIVE mode | Ctrl+2 |
| Switch to RETURN mode | Ctrl+3 |
| Switch to RTN BRANCH mode | Ctrl+4 |
| Confirm transaction | Ctrl+Shift+D |
| Toggle Pack / Strip sub-mode | Ctrl+Shift+S |
| Clear scanned items | Ctrl+Shift+X |
| Paste DataMatrix / SSCC | Ctrl+V |
| Open scan input field | Double-click white border |

---

## Validation Rules

| Rule | Behavior |
|------|----------|
| Retry creates a duplicate Masar transaction | Must NOT happen — idempotency required |
| FAILED item disappears on retry failure | Must NOT happen — item must remain visible |
| PENDING items lost on app restart | Must NOT happen — local persistence required |
| Sync Now while offline | Error shown; Pending items remain |
| Custom shortcut conflicts with OS or app shortcut | System should warn or prevent the binding |

---

## Edge Cases

- **Retry deduplication**: A failed transaction retried after backend already processed it must not duplicate the business action.
- **Rapid offline/online cycling**: Must not produce duplicate sync attempts.
- **Large offline queue**: Bulk sync of many accumulated transactions must complete without data loss or app freeze.
- **Partial sync failure**: Some items sync, others fail — both states must be reflected accurately.
- **Product count mismatch**: Product list count may differ between Masar backend and what the Products tab shows — known sync issue.

---

## Known Defects

- **Product count mismatch**: Product list count can differ between Masar backend and the Products tab; a known sync issue.

---

## Integration Points

- **Masar backend**: All Queue sync operations target the Masar API; product list sourced from Masar.
- **Local storage**: Transactions persisted locally before sync; must survive app restart.
- **History**: Successfully synced transactions are reflected in History under the appropriate type tab.
