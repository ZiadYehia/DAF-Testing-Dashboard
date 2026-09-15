# Invoices — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Invoices |
| **Slug** | `billing-invoices` |
| **Feature ID** | `EPTTS_BIL_03` |
| **Module** | Billing Portal |
| **Portal** | https://192.168.225.195:8446 |
| **Route** | `Invoices` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Issued invoices with piece counts, billing charge, e-service fee, total and payment state. These are financial records - arithmetic correctness and immutability after payment are the whole point.

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
| Apply | Button / action | — |
| Clear | Button / action | — |
| 📋 Details | Button / action | — |
| CSV | Button / action | — |
| PDF | Button / action | — |
| No more results | Button / action | — |
| lang-switch | select | options: English, Arabic |
| f-search | input | Invoice #, idempotency key, external ref |
| f-status | select | options: All statuses, Pending, Paid, Cancelled, Overdue |
| f-gln | input | MAH GLN |
| f-from | input[date] | — |
| f-to | input[date] | — |
| Table 1 | Table | columns: INVOICE #, MAH GLN, PIECES, BILLING CHARGE, ESERVICE, TOTAL, STATUS, CREATED, PAID, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8446.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Click **Invoices** in the portal navigation.
4. The page loads with the heading "Invoices".
5. The table populates with records (or shows an empty state).

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Empty state** — filtering to zero results must clear previous rows and show an empty state.

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.

- **Re-documented 2026-09-08 as the manufacturer.** The UI Elements and column list above were
  captured as Platform Admin and describe that role's view. As a manufacturer the table has 9
  columns (no `MAH GLN`), there is no `f-gln` filter, and every `Pending` invoice carries a
  fourth row action, `Pay`, which an admin never sees. Payment itself is documented as its own
  feature, `billing-payments` (`EPTTS_BIL_06`).
- The column labels render Title Case; the ALL-CAPS above is a CSS `text-transform`.
- The billing portal uses Keycloak client **`billing-portal`** and serves its own API at
  `https://192.168.225.195:8446/masar-service/api/v1`.
