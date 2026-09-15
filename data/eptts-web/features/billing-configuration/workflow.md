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
| lang-switch | select | options: English, Arabic |
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

- **Role-gated, confirmed 2026-09-08.** This page is not reachable as a manufacturer: the
  portal renders only three nav items for that role and Configuration is not among them. The
  UI Elements above are the Platform Admin view.
- The mode is readable from `GET /masar-service/api/v1/billing/posture` on port 8446, which
  answers `{"mode":...,"enforce":...,"record":...}`. Prefer it over the dropdown when asserting
  what the tenant is actually doing.
- The billing portal uses Keycloak client **`billing-portal`**, not `masar-dashboard`.

## Verified live 2026-09-08 (as Platform Admin)

**There is no "Fee Configuration" heading.** The Route row and the UI Elements table above record
one, but the page does not render it. Its actual section headings are:

- `Billing mode — applies live, no redeploy`
- `Pricing equation — price bands`
- `Product catalog`
- `Bank account (for bank transfers)`  ← not previously documented
- `Other billing settings`

That matters beyond tidiness: an absence assertion naming a heading nobody renders passes for
every role, so BIL_CFG_009's role-isolation check was vacuous until it was pointed at
`Billing mode` and `Pricing equation` instead.

**Stable button ids**, all on this one page:

| id | label |
|---|---|
| `save-mode` | Apply mode |
| `band-add` | + Add band |
| `bands-save` | Save bands |
| `catalog-resync` | ↻ Re-sync product catalog |
| `save-bank-account` | Save bank account |
| `save-eservice` | Save |
| `save-cur` | Save |

`#c-mode` option values are `off` / `shadow` / `advisory` / `enforce`, with the labels the UI
Elements table already records.

**`Apply mode` raises a native `window.confirm` ONLY for `enforce`** — the bundle guards it with
`confirm(c("config.billingMode.confirmEnforce"))`. Playwright dismisses dialogs by default, so a
spec switching to Enforce without a dialog handler silently changes nothing.

**The authority is `GET /billing/posture`, not the dropdown.** It answers e.g.
`{"mode":"advisory","record":true,"enforce":false,"serviceEnabled":true,"source":"default(advisory)"}`.
`source` distinguishes an explicitly-set mode from the default. It is **404 on :8444** and **403
to a manufacturer** on :8446 ("available to: Daf admin, support, Finance"), so only an admin
session can read it.

The `Bank account (for bank transfers)` section is where the beneficiary details shown in the
bank-transfer dialog come from — see `billing-payments`.
