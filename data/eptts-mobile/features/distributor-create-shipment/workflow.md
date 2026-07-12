# Distributor — Create Shipment Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Create Shipment (Distributor) |
| **Slug** | `distributor-create-shipment` |
| **Module** | Distributor |
| **Navigation Path** | Distributor Home → Create Shipment |
| **Priority** | P1 |

## Business Purpose

Allows distributor staff to initiate a new outbound shipment to a pharmacy or branch. The distributor creates a draft shipment by specifying the destination (by GLN) and an ERP invoice number, then scans the serialised packs to associate them with the shipment.

## UI Elements

| Element | Type | Description |
|---------|------|-------------|
| Destination GLN field | Search input | "Search by name or GLN" — autocomplete search |
| ERP Invoice Number field | Text input | "Enter invoice number" |
| Create Draft button | Primary action | Creates the draft shipment record |

## Happy Path

1. From Distributor Home, tap **Create Shipment**.
2. Create Shipment form appears with two fields:
   - **Destination GLN** — search field (by name or GLN number)
   - **ERP Invoice Number** — free text input
3. Tap the Destination GLN field; type a pharmacy name or GLN number; select from the autocomplete suggestions.
4. Enter the **ERP Invoice Number** from the distributor's ERP system.
5. Tap **Create Draft**.
6. A draft shipment is created; the screen transitions to the pack-scanning screen.
7. Scan each pack barcode to add serialised packs to the shipment.
8. When packing is complete, submit/dispatch the shipment.

## Edge Cases & Validation Rules

- Destination GLN field: required — cannot create draft without a valid GLN selected.
- ERP Invoice Number: required — cannot be empty.
- GLN search with no results: display a "no results" message.
- Duplicate invoice number: system should warn if the ERP invoice already exists.
- Network error: graceful error with retry.

## Notes

- The GLN (Global Location Number) uniquely identifies the destination pharmacy/branch in the GS1 system.
- After creating a draft, the shipment appears in **My Shipments** with "Draft" status.
