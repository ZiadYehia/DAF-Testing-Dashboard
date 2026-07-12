# EPTTS Masar Agent — Test Case Writing Rules

Extracted and codified for the Masar Agent (EPTTS) QA platform.
Read this file completely before generating or editing any test case.

---

## 1. Table Structure

Every test case file begins with a single H1 heading (module name), then a markdown table.

**Exact 13-column order — case-sensitive, preserve all typos:**

`Feature ID | TestCase ID | Tester | Validity | Test Cases Title / Objective | Environment | Pre-condition | Test Data | Steps | Expected Results | Status | Attachment | Type`

---

## 2. TestCase ID Conventions

Masar Agent has no role system. All TestCase IDs use a flat module-prefix format with no role component.

| Module | Prefix | Example |
|--------|--------|---------|
| Authentication & Activation | `AUTH_` | `AUTH_001` |
| Receive | `RCV_` | `RCV_001` |
| Sell / Dispense | `SEL_` | `SEL_001` |
| Return (patient → pharmacy) | `RET_` | `RET_001` |
| Return to Distributor (pharmacy → branch) | `RTD_` | `RTD_001` |
| Queue | `QUE_` | `QUE_001` |

### Rules
- Always 3-digit zero-padded counter: `_001`, `_002`, ..., `_099`, `_100`
- Counter resets to `_001` for each new feature module file
- Counter is sequential — never skip numbers
- Do NOT use role prefixes (no MGR_, OWN_, PHR_, etc.)

---

## 3. Tester

Always: `Ziad Yehia`

---

## 4. Validity

Exactly one of two values:
- `Positive` — validates something works (happy path, valid inputs, valid edge cases)
- `Negative` — validates something is blocked or shows an error (invalid inputs, wrong state, network failure)

---

## 5. Test Case Title / Objective

**Positive pattern:** `Validate that user can {action} {context}`
**Negative pattern:** `Validate that user can't {action} {context}`
**System-level:** `Validate that {system behavior} {context}`

### Rules
- Always starts with "Validate that"
- Use "can't" (not "cannot") for negative cases
- Actor: "user" or "system" — there are no named roles in Masar Agent
- Be specific about screen and action
- No trailing punctuation
- Keep under ~100 characters

### Good Examples
- `Validate that user can open the Receive screen`
- `Validate that user can sell a pack using Pack Mode`
- `Validate that user can't sell an InTransit pack`
- `Validate that system prevents duplicate DataMatrix in the same sell transaction`
- `Validate that system shows correct sync status in Queue after offline sell`

---

## 6. Environment

**Exact format (preserve all spacing):**
`Platform: Windows 10/11 , App: Masar Agent v2.3.5`

All EPTTS features use a single fixed version: **v2.3.5**

---

## 7. Pre-condition

### Standard Template

For all modules except Authentication:

`1. Install Masar Agent 2. Access to Internet (Wifi or Ethernet) 3. Launch the app 4. Login with a valid pharmacy account 5. OTP verified 6. Activation key validated 7. Open {Module Name} module 8. User is on {Screen Name} screen`

For **Authentication** module tests (login, OTP, activation):

`1. Install Masar Agent 2. Access to Internet (Wifi or Ethernet) 3. Launch the app 4. User is on {Screen Name} screen`

For **offline / network failure** tests:

`1. Install Masar Agent 2. Launch the app 3. Login with a valid pharmacy account 4. OTP verified 5. Activation key validated 6. Disable internet connection 7. Open {Module Name} module 8. User is on {Screen Name} screen`

### Pre-condition Rules
- All steps on a SINGLE line separated by numbered steps (no line breaks inside table cells)
- "Wifi" not "WiFi"
- Always ends with "User is on {Screen Name} screen" or "Open {Module} module"
- OTP step always comes **before** activation key step
- Add specific pre-existing state when needed:
  - e.g., "At least one received pack exists in inventory"
  - e.g., "At least one dispensed pack exists in history"
  - e.g., "Queue has at least one Pending transaction"

---

## 8. Test Data

**When no specific data is needed:** `Not Applicable`
**Never use "N/A"** — always write out "Not Applicable"

**Format for specific values:** `FieldName: value`
**Multiple values:** separated by semicolons: `DataMatrix: <valid_datamatrix>; Quantity: 2`

### Standard Test Values

| Scenario | Value |
|----------|-------|
| Valid DataMatrix (example format) | `01{GTIN}21{SSN}10{Batch}17{Expiry}` |
| Invalid DataMatrix (wrong format) | `INVALID_BARCODE_123` |
| Wrong GLN pack | DataMatrix belonging to a different pharmacy GLN |
| Already received pack | DataMatrix for a pack already in Active state |
| InTransit pack | DataMatrix for a pack not yet received |
| Expired pack | DataMatrix for a pack with passed expiry date |
| Already dispensed pack | DataMatrix for a pack in Dispensed state |
| Valid quantity (pack mode) | `1` |
| Quantity exceeding max | `{maxQty + 1}` |
| Zero quantity | `0` |
| Negative quantity | `-1` |
| Decimal quantity | `2.5` |
| SQL injection | `' OR 1=1 --` |
| XSS injection | `<script>alert(1)</script>` |
| Whitespace only | `   ` (spaces) |
| Emoji in field | `123😀` |

---

## 9. Steps

**Format:** Numbered list on a single line inside the cell.
`1. {Action}. 2. {Action}. 3. {Action}.`

**Action verbs:** `Click`, `Enter`, `Select`, `Scan`, `Copy`, `Paste`, `Observe`, `Navigate`, `Open`, `Disable`, `Enable`, `Leave`, `Wait`, `Scroll`, `Retry`, `Confirm`, `Minimize`, `Restore`, `Pull to refresh`

> Use "Paste" for DataMatrix copy/paste input. Use "Scan" for barcode scanner input.
> Desktop app — do NOT use "Tap". Use "Click" instead.

### Rules
- Each step = ONE atomic action
- "Observe {UI element/behavior}" for passive checks
- "Leave {field} empty" for empty field tests
- Maximum ~10 steps (split test if more needed)
- "Repeat steps X-Y" is acceptable for repetitive actions
- Do NOT repeat pre-condition steps in the Steps column
- Steps must flow logically from the pre-condition ending state

---

## 10. Expected Results

**Format:** Single declarative sentence in present tense.

### Rules
- NEVER use modal verbs: no "should", "will", "would", "shall"
- Subject: "System", "[Screen name]", "User", "Validation message"
- Be specific — name the exact behavior, not just "an error is shown"
- For business rules that are unclear, append "(as per business rules)" or "(TBD with PO)"

### Sentence Templates

| Scenario | Template |
|----------|----------|
| Screen opens | `{Screen Name} is displayed successfully.` |
| Navigation back | `User returns to {previous screen} without crash.` |
| Successful receive | `Pack state changes to Active and transaction appears in History and Queue.` |
| Successful sell | `Pack state changes to Dispensed (or Partial Dispensed) and transaction appears in History and Queue.` |
| Successful return | `Pack state changes to Returned and transaction appears in History and Queue.` |
| Mandatory field empty | `Mandatory validation message is displayed and {action} is not submitted.` |
| Format invalid | `{Field} format validation message is displayed and {action} is not submitted.` |
| Wrong state pack | `System rejects the pack and displays an invalid state error.` |
| Wrong GLN pack | `System rejects the pack and displays a GLN ownership error.` |
| Duplicate DataMatrix | `System prevents duplicate {entity} from being added to the same transaction.` |
| Network error | `System shows a clear network error and the transaction is saved to Queue as Pending.` |
| Queue retry success | `Transaction status changes from Failed to Synced after successful retry.` |
| Quantity exceeded | `System blocks submission and shows quantity limit message.` |
| Offline operation | `Transaction is saved locally, Queue shows Pending status, and UI counters update immediately.` |
| Deactivation blocked | `System force logs out user and blocks new operations upon pharmacy deactivation or device unlink.` |
| Activation key reuse | `System rejects the activation key and displays an already-used or expired error.` |

---

## 11. Status

| Value | When to Use |
|-------|-------------|
| `Pass` | Test executed and passed |
| `Fail` | Test executed and failed (must have bug ID in Attachment) |
| `Blocked/Skipped` | Cannot test yet (pending backend, TBD rule, environment unavailable, confirmed future work) |
| `Under Testing` | Currently being actively tested |

---

## 12. Attachment

- **Empty** when Status = `Pass`, `Blocked/Skipped`, or `Under Testing`
- **Bug ID** when Status = `Fail`: format `DW-{###}` (e.g., `DW-320`)
  - EPTTS and Dawana share the same Jira board — use the same `DW-` prefix
- Multiple bugs space-separated: `DW-320 DW-321`
- A Fail status without an Attachment is an error

---

## 13. Type

Always: `Functional`

---

## 14. Test Case Ordering Within a Feature File

Generate test cases in this order — do not reorder:

1. **Navigation / Access** — Can open screen, can navigate back, screen header/title visible
2. **Core Positive** — Main happy path with all valid data (complete the full workflow end-to-end)
3. **Variation Positive** — Different valid input combinations (SSCC vs single pack, pack mode vs strip mode, multiple items)
4. **Downstream Effects** — State changes after successful action (pack state updated, History reflects new record, Queue shows Synced, counter updates)
5. **Positive Edge Cases** — Boundary valid values, maximum allowed quantity, minimum quantity (1 strip)
6. **UX / Desktop Positive** — App minimize/restore, window resize, clipboard paste, network reconnect mid-operation
7. **Mandatory Field Validation** — One empty field per test, rest filled correctly (one test per mandatory field)
8. **Format / Range Validation** — Invalid DataMatrix format, out-of-range quantity, whitespace-only, special characters
9. **State Validation** — Wrong pack state (InTransit, already received, already dispensed, already returned), wrong GLN ownership
10. **Access Control** — Pharmacy deactivated, device unlinked, session expired, activation key already used
11. **Network Failure** — Offline scenario, transaction saved to Queue as Pending, retry after reconnect, no crash
12. **Concurrent / Sync** — Retry must not duplicate business action in Masar, failed sync remains visible, Queue integrity after multiple retries
13. **Security / Injection** — SQL injection strings, XSS strings, emoji in fields, max-length overflow in text fields

---

## 15. Feature ID Linking

Every test case must reference a valid Feature ID from `data/eptts/requirements/FRs.md`.

- General navigation or cross-feature test → use the closest matching Feature ID
- Test spans multiple features → list all IDs space-separated: `EPTTS_FR_01 EPTTS_FR_02`

---

## 16. Coverage Checklist

Verify every generated feature file covers:
- [ ] Screen renders (all major UI elements visible)
- [ ] Navigation (open, back)
- [ ] Every required (*) field — empty validation
- [ ] Every required field — invalid format/range
- [ ] Every scan/paste method — DataMatrix via paste; invalid DataMatrix rejected
- [ ] SSCC input where applicable — SSCC receive activates all inner packs
- [ ] Happy path end-to-end (one complete successful transaction)
- [ ] State change downstream (pack state updated, History record created, Queue updated)
- [ ] Wrong pack state blocked (InTransit, already received, already dispensed, etc.)
- [ ] Wrong GLN pack blocked
- [ ] Network failure (offline → transaction saved as Pending, retry → Synced)
- [ ] Sync retry does NOT create duplicate business action in Masar
- [ ] Access control (deactivation or device unlink blocks operations)
- [ ] Security — injection strings, emoji, whitespace-only, max-length
