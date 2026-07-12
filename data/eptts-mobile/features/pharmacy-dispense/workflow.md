# Pharmacy — Dispense Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Dispense (Pharmacy) |
| **Slug** | `pharmacy-dispense` |
| **Module** | Pharmacy |
| **Navigation Path** | Pharmacy Home → Dispense |
| **Priority** | P1 |

## Business Purpose

Allows pharmacy staff to record the dispensing of a serialised pharmaceutical pack to a patient. Scanning the pack's GS1 barcode triggers a DSCSA/track-and-trace event that marks the pack as dispensed, removing it from pharmacy inventory and closing the supply chain loop.

## UI Elements

| Element | Type | Description |
|---------|------|-------------|
| Scan/barcode area | Camera input | Tap to scan pack barcode |
| Dispense button / submit | Action | Confirms the dispense event |

## Happy Path

1. From Pharmacy Home, tap **Dispense**.
2. The Dispense screen opens with a barcode scanner prompt.
3. Tap the scan area and point the camera at the pack's GS1/SGTIN barcode.
4. The app reads the barcode and validates that the pack is in this pharmacy's inventory.
5. Confirm the dispense action.
6. A success confirmation is shown; the pack is marked as dispensed in the system.
7. Tap back to return to Pharmacy Home.

## Edge Cases & Validation Rules

- Pack not in pharmacy inventory: display an error ("Pack not found in your stock").
- Pack already dispensed: display an error ("Pack has already been dispensed").
- Pack recalled or flagged: display a warning before allowing dispense.
- Invalid barcode format: display a scan error.
- Network error: graceful error with retry option.

## Notes

- Dispensing is the final step in the pharmaceutical supply chain for pharmacy-to-patient flow.
- Each dispense generates an EPCIS "dispensing" event visible in EPCIS History.
