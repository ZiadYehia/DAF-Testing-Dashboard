# Branch — Create Shipment Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Create Shipment (Branch) |
| **Slug** | `branch-create-shipment` |
| **Module** | Branch |
| **Navigation Path** | Branch Home → Create Shipment |
| **Priority** | P1 |

## Business Purpose

Allows branch staff to initiate a new outbound shipment to a pharmacy. The branch creates a draft by specifying the destination pharmacy (by GLN) and an ERP invoice number, then scans serialised pack barcodes to build the shipment manifest.

## UI Elements

| Element | Type | Description |
|---------|------|-------------|
| Destination GLN field | Search input | "Search by name or GLN" — autocomplete search |
| ERP Invoice Number field | Text input | "Enter invoice number" |
| Create Draft button | Primary action | Creates the draft shipment record |

## Happy Path

1. From Branch Home, tap **Create Shipment**.
2. Create Shipment form appears with:
   - **Destination GLN** — search by pharmacy name or GLN number
   - **ERP Invoice Number** — free text input
3. Enter/select destination GLN via autocomplete.
4. Enter the ERP invoice number.
5. Tap **Create Draft**.
6. Draft shipment is created; proceed to the pack-scanning screen.
7. Scan serialised pack barcodes to populate the shipment.
8. Submit/dispatch when complete.

## Edge Cases & Validation Rules

- Destination GLN: required — cannot create draft without valid selection.
- ERP Invoice Number: required — cannot be blank.
- Duplicate invoice: system should warn if the invoice already exists.
- GLN not found: display "no results" in the autocomplete.
- Network error: graceful error with retry.

## Notes

- This form is identical to the Distributor's Create Shipment form — same fields, same Create Draft button.
- Branch shipments are typically destined for pharmacies (downstream), not distributors.
- After creation, the shipment appears in **My Shipments** with "Draft" status.
