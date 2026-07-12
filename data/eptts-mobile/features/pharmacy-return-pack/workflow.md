# Pharmacy — Return Pack Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Return Pack (Pharmacy) |
| **Slug** | `pharmacy-return-pack` |
| **Module** | Pharmacy |
| **Navigation Path** | Pharmacy Home → Return Pack |
| **Priority** | P2 |

## Business Purpose

Allows pharmacy staff to initiate the return of a serialised pharmaceutical pack upstream (to the distributor or manufacturer). Typically used for expired, damaged, or recalled products. The pharmacist scans the pack barcode, adds a note, and initiates the return.

## UI Elements

| Element | Type | Description |
|---------|------|-------------|
| Scan area | Camera input | "Tap to scan pack / SSCC" |
| Note field | Optional text input | Free-text note for the return reason |
| Initiate Return button | Primary action | Submits the return request |

## Happy Path

1. From Pharmacy Home, tap **Return Pack**.
2. The Return Pack screen opens with a barcode scan area and a **Note (optional)** text field.
3. Tap the scan area to open the camera; scan the pack's GS1/SGTIN barcode.
4. Optionally type a return reason in the **Note** field.
5. Tap **Initiate Return**.
6. A success confirmation is shown; the return request is created.
7. Return to Pharmacy Home.

## Edge Cases & Validation Rules

- Invalid or unrecognised barcode: display an error.
- Pack not in pharmacy inventory: display an error.
- Pack already returned: display an error.
- Note is optional — should not block submission when empty.
- Network error: show a retry option.

## Notes

- This is a pharmacy-to-upstream return (pharmacy returns to distributor/manufacturer).
- The return will appear in **My Returns** after submission.
- Distinct from **Branch Return**, which handles returns coming from a branch.
