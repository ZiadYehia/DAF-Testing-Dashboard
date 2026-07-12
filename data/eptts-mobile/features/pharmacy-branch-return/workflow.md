# Pharmacy — Branch Return Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Branch Return (Pharmacy) |
| **Slug** | `pharmacy-branch-return` |
| **Module** | Pharmacy |
| **Navigation Path** | Pharmacy Home → Branch Return |
| **Priority** | P2 |

## Business Purpose

Allows pharmacy staff to process an incoming return from a branch. When a branch sends serialised pharmaceutical packs back to the pharmacy, the pharmacist uses this screen to scan and accept those returned items back into pharmacy inventory.

## UI Elements

| Element | Type | Description |
|---------|------|-------------|
| Incoming returns list | List | Returns initiated by branches awaiting pharmacy acceptance |
| Scan area | Camera input | Scan pack barcodes to confirm receipt of returned items |
| Accept / Confirm action | Button | Confirms the branch return is received |

## Happy Path

1. From Pharmacy Home, tap **Branch Return**.
2. The Branch Return screen appears, showing pending returns from branch(es).
3. Select a return to process.
4. Scan each returned pack barcode to verify them.
5. Confirm receipt — packs are moved back into pharmacy inventory.
6. Return to Pharmacy Home.

## Edge Cases & Validation Rules

- No pending branch returns: display an empty-state message.
- Scanned pack doesn't match the return: display an error.
- Partial acceptance: behaviour when not all packs are scanned needs validation.
- Network error: graceful error with retry.

## Notes

- This flow is the pharmacy's side of the branch-to-pharmacy return loop.
- Distinct from **Return Pack** (which is pharmacy-to-upstream, e.g. to distributor).
