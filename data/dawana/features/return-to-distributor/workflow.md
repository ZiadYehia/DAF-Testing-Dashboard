# Return to Distributor — Workflow

> This file is a living document. Add workflow steps, edge cases, and validation rules as you discover them through testing.

---

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Return to Distributor |
| **Feature ID** | MGR_FR_25 |
| **Role(s)** | Manager |
| **Module / Navigation Path** | Home → Return to Distributor |
| **Priority** | P2 |
| **App Version Under Test** | v5.2.9 |

---

## Business Purpose

The Return to Distributor module allows returning pharmaceutical products from pharmacy stock back to the distributor. Both Dawana inventory and Masar traceability must be updated correctly.

---

## Happy Path

_Document the step-by-step flow here as you discover it._

---

## Edge Cases & Validation Rules

_Add known edge cases and validation behaviors here._

---

## Known Business Rules

- Returning a product must decrement Dawana stock
- Masar must reflect the return as a trace transaction
- SSCC hierarchy must remain consistent after a return

---

## Related Bugs

| Bug File | Description |
|----------|-------------|
| `bugs/return-to-distributor/sscc-remains-pending-after-masar-cancels-return.md` | SSCC remains pending after Masar cancels return |

---

## Notes

_Add any additional observations, API endpoints, or integration points here._
