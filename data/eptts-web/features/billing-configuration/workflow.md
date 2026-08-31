# Fee Configuration — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Fee Configuration |
| **Slug** | `billing-configuration` |
| **Feature ID** | `EPTTS_BIL_05` |
| **Module** | Billing Portal |
| **Portal** | https://192.168.225.195:8446 |
| **Route** | `Configuration` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Price-band table driving per-unit fees (from-price, to-price, fee per unit). Changing a band changes what every partner is charged, so boundary behaviour at band edges is the critical case.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Billing Portal | Heading | — |
| Billing mode — applies live, no redeploy | Heading | — |
| Pricing equation — price bands | Heading | — |
| Product catalog | Heading | — |
| Other billing settings | Heading | — |
| ☰ | Button / action | — |
| 🧾 Unbilled Operations | Button / action | — |
| 📄 Invoices | Button / action | — |
| 📊 Reports | Button / action | — |
| ⚙️ Configuration | Button / action | — |
| Logout | Button / action | — |
| Apply mode | Button / action | — |
| 🗑 | Button / action | — |
| + Add band | Button / action | — |
| Save bands | Button / action | — |
| ↻ Re-sync product catalog | Button / action | — |
| Save | Button / action | — |
| lang-switch | select | options: English, العربية |
| c-mode | select | options: Off — no billing interaction, Shadow — record only (no invoices, no block), Advisory — invoices visible, no block, Enforce — block shipping on unpaid clearance |
| (unlabelled) | input[number] | — |
| e.g. 10 | input[number] | e.g. 10 |
| 2 | input[number] | 2 |
| optional | input | optional |
| (unlabelled) | input[number] | — |
| e.g. 10 | input[number] | e.g. 10 |
| 2 | input[number] | 2 |
| optional | input | optional |
| (unlabelled) | input[number] | — |
| e.g. 10 | input[number] | e.g. 10 |
| 2 | input[number] | 2 |
| optional | input | optional |
| Table 1 | Table | columns: FROM (PRICE), TO (PRICE — BLANK = AND UP), FEE PER UNIT, NOTES |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8446.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Click **Configuration** in the portal navigation.
4. The page loads with the heading "Fee Configuration".
5. The table populates with records (or shows an empty state).

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Empty state** — filtering to zero results must clear previous rows and show an empty state.

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
