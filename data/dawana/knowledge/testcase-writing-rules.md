# Dawana Test Case Writing Rules

Extracted and codified from 450+ existing test cases across all feature modules.
Read this file completely before generating or editing any test case.

---

## 1. Table Structure

Every test case file begins with a single H1 heading (module name), then a markdown table.

**Exact 13-column order — case-sensitive, preserve all typos:**

`Feature ID | TestCase ID | Tester | Validity | Test Cases Title / Objective | Environment | Pre-condition | Test Data | Steps | Expected Results | Status | Attachment | Type`

---

## 2. TestCase ID Conventions

### Cross-role / General Features
When a feature is used by multiple roles or belongs to no single role:
- `LGN_{###}` — Login
- `DSP_{###}` — Dispense
- `REG_{###}` — Registration
- `FRPW_{###}` — Forget Password

### Role-Specific Features
When a feature belongs to a single role, prefix with role abbreviation + feature abbreviation:
- `MGR_FTE_{###}` — Manager First-Time Entry
- `MGR_NST_{###}` — Manager New Stock
- `MGR_INC_{###}` — Manager Incident Form (MGR_FR_29)
- `OWN_RCH_{###}` — Owner Request Change
- `PHR_INC_{###}` — Pharmacist Incident Reporting (PHR_FR_46)

### Rules
- Always 3-digit zero-padded counter: `_001`, `_002`, ..., `_099`, `_100`
- Counter resets to `_001` for each new feature module file
- Counter is sequential — never skip numbers
- When one file covers both Manager + Pharmacist incident roles, use the primary role prefix (e.g., `MGR_INC_`)

---

## 3. Tester

Always: `Ziad Yehia`

---

## 4. Validity

Exactly one of two values:
- `Positive` — validates something works (happy path, valid inputs, valid edge cases)
- `Negative` — validates something is blocked or shows an error (invalid inputs, empty fields, wrong role, network failure)

---

## 5. Test Case Title / Objective

**Positive pattern:** `Validate that {actor} can {action} {context}`
**Negative pattern:** `Validate that {actor} can't {action} {context}`
**System-level:** `Validate that {system behavior} {context}`

### Rules
- Always starts with "Validate that"
- Use "can't" (not "cannot") for negative cases
- Actor: "user", "Owner", "Manager", "Pharmacist", "Inspector" — use the most specific role when testing role-specific behavior
- Be specific about screen and action
- No trailing punctuation
- Keep under ~100 characters

### Good Examples
- `Validate that user can open Incident form screen`
- `Validate that Manager can submit an incident with a valid product and reason`
- `Validate that user can't submit when Reason dropdown is empty`
- `Validate that system shows correct status labels on incidents list`
- `Validate that system prevents duplicate barcode scan for the same SGTIN`

---

## 6. Environment

**Exact format (preserve all spacing and typos):**
`Device: Samsung Note 10 plus , OS: Android v12 , app: v{version}`

**Version by feature generation:**
- Early features (Login, Registration, Forget Password): `v4.9.8`
- Mid features (Dispense, First-Time Entry, Request Change): `v5.0.3` or `v5.0.5`
- Newer features (New Stock Masar, Incident): `v5.1.0`
- When uncertain, use latest known version: `v5.1.0`

---

## 7. Pre-condition

### Base Templates by Role

**Manager:**
`1. Install Dawana App -> Test APK 2. Access to Wifi or Mobile data (prefered 4G or above) 3. Launch the app 4. Select Pharmacy Role 5. Select Pharmacy Manager 6. Tap Get Started button 7. Login with a Pharmacy Manager account 8. Open {Module Name} module`

**Owner:**
`1. Install Dawana App -> Test APK 2. Access to Wifi or Mobile data (prefered 4G or above) 3. Launch the app 4. Select Pharmacy Role 5. Select Pharmacy Owner 6. Tap Get Started button 7. Login with a Pharmacy Owner account 8. {Navigation to screen} 9. User is on {Screen Name} screen`

**Pharmacist:**
`1. Install Dawana App -> Test APK 2. Access to Wifi or Mobile data (prefered 4G or above) 3. Launch the app 4. Select Pharmacy Role 5. Select Pharmacist 6. Tap Get Started button 7. Login with a Pharmacist account 8. {Navigation to screen} 9. User is on {Screen Name} screen`

**Inspector:**
`1. Install Dawana App -> Test APK 2. Access to Wifi or Mobile data (prefered 4G or above) 3. Launch the app 4. Select Inspector Role 5. Tap Get Started button 6. Login with a valid Inspector account 7. {Navigation to screen} 8. User is on {Screen Name} screen`

### Pre-condition Rules
- All steps on a SINGLE line separated by numbered steps (no line breaks inside table cells)
- "Wifi" not "WiFi"
- "prefered" not "preferred"
- "Test APK" (no URL required)
- Always ends with "User is on {Screen Name} screen" or "Open {Module} module"
- Add specific pre-existing state when needed: e.g., "At least one incident exists", "Manager account; pharmacy has no stock on system"
- For role-isolation tests: the pre-condition describes the WRONG role that will be used

---

## 8. Test Data

**When no specific data is needed:** `Not Applicable`
**Never use "N/A"** — always write out "Not Applicable"

**Format for specific values:** `FieldName: value`
**Multiple values:** separated by semicolons: `Email: existing email; Password: Aa1!aaaa`

### Standard Test Values
- Valid password (all rules met): `Aa1!aaaa`
- Too short (7 chars): `Aa1!aaa`
- No uppercase: `aa1!aaaa`
- No lowercase: `AA1!AAAA`
- No number: `Aa!aaaaa`
- No special char: `Aa1aaaaa`
- Has spaces: `Aa1! aaA`
- Zero quantity: `0`
- Negative quantity: `-5`
- Decimal quantity: `2.5`
- Scientific notation: `1e3`
- SQL injection: `' OR 1=1 --`
- XSS injection: `<script>alert(1)</script>`
- Emoji in field: `123😀`
- Whitespace only: `   ` (spaces)

---

## 9. Steps

**Format:** Numbered list on a single line inside the cell.
`1. {Action}. 2. {Action}. 3. {Action}.`

**Action verbs:** `Tap`, `Enter`, `Select`, `Upload`, `Observe`, `Scan`, `Open`, `Navigate`, `Disable`, `Enable`, `Leave`, `Wait`, `Rotate`, `Paste`, `Copy`, `Scroll`, `Repeat`, `Confirm`, `Pull to refresh`

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
- Subject: "System", "[Screen name]", "[Actor]", "Validation message"
- Be specific — name the exact behavior, not just "an error is shown"
- For business rules that are unclear, append "(as per business rules)" or "(TBD with PO)"

### Sentence Templates
| Scenario | Template |
|----------|----------|
| Screen opens | `{Screen Name} is displayed successfully.` |
| Navigation back | `User returns to {previous screen} without crash.` |
| Successful save | `{Entity} is saved successfully and {downstream effect}.` |
| Mandatory field empty | `Mandatory validation message is displayed and {action} is not submitted.` |
| Format invalid | `{Field} format validation message is displayed and {action} is not submitted.` |
| Role blocked | `{Module} module is not accessible for {Role} role.` |
| Network error | `System shows a clear network error and {stays on screen / allows retry}.` |
| Duplicate blocked | `System prevents duplicate {entity} or merges according to business rules with clear behavior.` |
| Loading state | `Loading indicator is shown until {operation} completes.` |
| Quantity exceeded | `System blocks submission and shows quantity limit message.` |

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
- Multiple bugs space-separated: `DW-320 DW-321`
- A Fail status without an Attachment is an error

---

## 13. Type

Always: `Functional`

---

## 14. Test Case Ordering Within a Feature File

Generate test cases in this order — do not reorder:

1. **Navigation / Access** — Can open screen, can navigate back, screen header/title visible
2. **Core Positive** — Main happy path with all valid data (complete the full workflow)
3. **Variation Positive** — Different valid input combinations (different ID types, modes, multiple items)
4. **Downstream Effects** — State changes after successful action (stock updated, list reflects new item, status changes)
5. **Positive Edge Cases** — Boundary valid values, optional fields omitted, large but valid quantities
6. **Device / UX Positive** — Device rotation, app background/foreground, clipboard paste, incoming call interruption
7. **Mandatory Field Validation** — One empty field per test, rest filled correctly (one test per mandatory field)
8. **Format / Range Validation** — Invalid formats, out-of-range values, special characters, whitespace-only
9. **Role Isolation** — Wrong role cannot access module (test at least Owner, Pharmacist, and one other wrong role)
10. **Network Failure** — Offline scenario, retry after reconnect, no crash
11. **Concurrent / State** — Race conditions (approval while form open), duplicate submission prevention
12. **Security / Injection** — SQL injection strings, XSS strings, emoji in restricted fields, max-length overflow

---

## 15. Feature ID Linking

Every test case must reference a valid Feature ID from `requirements/FRs.md`.

- Cross-role test (e.g., general navigation) → `GEN_FR_00`
- Single-role test → the specific Feature ID (e.g., `MGR_FR_29`)
- Test spans multiple features → list all IDs space-separated: `OWN_FR_05 MGR_FR_21`

---

## 16. Coverage Checklist

Verify every generated feature file covers:
- [ ] Screen renders (all major UI elements visible)
- [ ] Navigation (open, back, deep links)
- [ ] Every required (*) field — empty validation
- [ ] Every required field — invalid format/range
- [ ] Every dropdown — can select available option
- [ ] Every upload — valid file accepted; invalid format rejected; oversized file rejected
- [ ] Every barcode scan method — QR camera scan; manual GTIN+serial entry; invalid barcode rejected
- [ ] Happy path end-to-end (one complete successful transaction)
- [ ] State change downstream (inventory, list, status badge reflects change)
- [ ] Role isolation (at least one wrong-role test per module)
- [ ] Network failure (offline → error shown, retry → success)
- [ ] Duplicate submission prevented
- [ ] Security — injection strings, emoji, whitespace-only, max-length
