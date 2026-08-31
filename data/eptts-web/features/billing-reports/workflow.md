# Billing Reports — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Billing Reports |
| **Slug** | `billing-reports` |
| **Feature ID** | `EPTTS_BIL_04` |
| **Module** | Billing Portal |
| **Portal** | https://192.168.225.195:8446 |
| **Route** | `Reports` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Revenue and billing reporting across MAHs and periods.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Billing Portal | Heading | — |
| ☰ | Button / action | — |
| 🧾 Unbilled Operations | Button / action | — |
| 📄 Invoices | Button / action | — |
| 📊 Reports | Button / action | — |
| ⚙️ Configuration | Button / action | — |
| Logout | Button / action | — |
| Run report | Button / action | — |
| ⬇ Excel | Button / action | — |
| ⬇ CSV | Button / action | — |
| ⬇ PDF | Button / action | — |
| lang-switch | select | options: English, العربية |
| r-report | select | options: Invoice Register, Revenue Summary (by status), Revenue by Period, AR — Outstanding by MAH, Outstanding & Aging, Reconciliation (Invoices ↔ Payments), Payments, Billing Sheet Export |
| r-status | input | Status (comma-sep: PENDING,PAID) |
| r-gln | input | MAH GLN |
| r-currency | input | Currency |
| r-gateway | input | Gateway (payments) |
| r-gtin | input | GTIN |
| r-amin | input[number] | Min amount |
| r-amax | input[number] | Max amount |
| r-from | input[date] | — |
| r-to | input[date] | — |
| r-granularity | select | options: Monthly, Daily, Weekly, Quarterly, Yearly |
| r-basis | select | options: Issued, Cash (paid) |
| r-asof | input[date] | — |

## Displayed metrics

- INVOICES 4
- AWAITING PAYMENT 0
- PAID 4
- UNPAID BALANCE 0.00 EGP
- TOTAL PAID 72050.00 EGP

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8446.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Click **Reports** in the portal navigation.
4. The page loads with the heading "Billing Reports".

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
