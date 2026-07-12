# [Feature Name] Workflow

> Copy this file to `features/<name>/workflow.md` and fill in all sections.
> Template location: `.github/templates/workflow-template.md`

---

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | [e.g., Incident Form] |
| **Feature ID** | [from FRs.md, e.g., MGR_FR_29] |
| **Role(s)** | [Manager / Pharmacist / Owner / Inspector / General] |
| **Module / Navigation Path** | [e.g., Home → Incident → Add New] |
| **Priority** | [P1 / P2 / P3 / P4] |
| **App Version Under Test** | [e.g., v5.1.0] |
| **Status** | [Not Started / In Progress / Done] |

---

## Business Purpose

[1–3 sentences describing what this feature does and why it exists in the pharmacy workflow.
Example: "Allows pharmacy managers to report pharmaceutical products that are damaged, expired, or have quantity discrepancies. The report is submitted to EDA via Masar for traceability."]

---

## Screens

### [Screen 1 Name]

[Describe what this screen shows, when it appears, and what the user can do on it.
Example: "Incidents List — shows all submitted incident reports with status badges (Pending/Approved). Has an 'Add New' button at the top right and a filter option."]

### [Screen 2 Name]

[Description...]

### [Screen 3 Name — if applicable]

[Description...]

---

## User Flow

1. [Starting state — where the user is before this feature begins]
2. [Step 1 of the flow]
3. [Step 2...]
4. [Continue until completion]
5. [Ending state — what happens after successful submission/action]

**Example:**
1. Manager is on Home screen
2. Manager taps Incident from bottom navigation
3. Incident List screen opens showing existing incidents
4. Manager taps Add New
5. Incident Form opens
6. Manager selects Reason from dropdown
7. Manager searches and selects a product
8. Manager enters quantity and optionally scans barcode
9. Manager uploads supporting document (optional)
10. Manager taps Submit
11. Incident is created and appears in the list with Pending status

---

## Field Definitions

| Field Name | Input Type | Required | Validation Rules / Notes |
|-----------|-----------|----------|--------------------------|
| [Field Name] | [text / number / dropdown / date / file / barcode-scan] | Yes / No | [e.g., min 1, max 500 chars; Arabic/English allowed] |
| [Field Name] | | | |
| [Field Name] | | | |

**Example rows:**
| Field Name | Input Type | Required | Validation Rules / Notes |
| :--- | :--- | :--- | :--- |
| Reason | dropdown | Yes | Options: Damaged / Expired / Quantity Discrepancy / Other (Arabic labels in UI) |
| Product Name | search/lookup | Yes | Must exist in pharmacy stock |
| Generic Name | text (auto-fill) | No | Auto-populated after product selection, read-only |
| Dosage | text (auto-fill) | No | Auto-populated after product selection |
| Quantity | number | Yes | Must be > 0 and ≤ available stock |
| SGTIN / Barcode | barcode scan or manual | No | Manual: GTIN field + Serial Number field |
| Supporting Document | file upload | No | Image or File; Image: Camera or Gallery |

---

## Business Rules

- [Rule 1: e.g., Only Manager role can submit an incident]
- [Rule 2: e.g., Reason is mandatory and must be selected from the approved list]
- [Rule 3: e.g., Product must exist in the pharmacy's current stock to be selectable]
- [Rule 4: e.g., Submitted incident is sent to Masar for serialization traceability]
- [Rule 5: ...]

---

## Dropdown Options

List all known dropdown values (especially important for Arabic-label dropdowns):

**[Dropdown Name]:**
- [Option 1 — Arabic label if applicable]
- [Option 2]
- [Option 3]

---

## Edge Cases / Known Behaviors

- [Known edge case 1: e.g., If product has no stock, it should not appear in search]
- [Known behavior 2: e.g., Barcode scan is optional; user can enter GTIN + Serial manually]
- [Known issue 3: e.g., After failed scan, product sometimes stays in list — bug DW-XXX]

---

## Open Questions / TBD

- [ ] [Question 1: e.g., What happens when user tries to report a Masar-tracked product vs a non-Masar product?]
- [ ] [Question 2: e.g., Is document upload mandatory or optional?]
- [ ] [Question 3: e.g., Can the same product be reported in multiple incidents on the same day?]

---

## Related Features

| Feature ID | Feature Name | Relationship |
|------------|-------------|--------------|
| [MGR_FR_22] | [First-Time Entry] | [Stock must be set up before incidents can reference products] |
| [MGR_FR_31] | [New Stock] | [Approved stock appears as available for incident reporting] |
| [PHR_FR_46] | [Pharmacist Incident Reporting] | [Same incident concept but from Pharmacist role] |
