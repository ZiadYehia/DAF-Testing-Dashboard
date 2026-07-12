# New Stock (Receiving) — Workflow

> This file is a living document. Add workflow steps, edge cases, and validation rules as you discover them through testing.
> Reference: `examples/newstock-testcases.md` for generated test cases on this feature.

---

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | New Stock |
| **Feature ID** | MGR_FR_23 |
| **Role(s)** | Manager |
| **Module / Navigation Path** | Home → New Stock → Select Invoice |
| **Priority** | P1 |
| **App Version Under Test** | v5.2.9 |

---

## Business Purpose

The New Stock module allows a Pharmacy Manager to receive pharmaceutical products via invoices from Masar or EDA (Egyptian Drug Authority). Receiving can be done by scanning individual SGTINs or entire SSCCs.

---

## Happy Path

_Document the step-by-step flow here as you discover it._

---

## Edge Cases & Validation Rules

_Add known edge cases and validation behaviors here._

---

## Known Business Rules

- An invoice may contain multiple SSCCs and multiple products
- Partial Approve: approve some products and reject others — both Dawana and Masar must reflect the same final state
- Invoice source (Masar vs EDA) affects the scanning and approval flow

---

## Related Bugs

| Bug File | Description |
|----------|-------------|
| `bugs/new-stock/cancelled-masar-bill-retains-shipment-details-causing-duplication-error.md` | Cancelled Masar bill retains shipment details |

---

## Notes

_Add any additional observations, API endpoints, or integration points here._
