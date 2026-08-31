# Billing Dashboard — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Billing Dashboard |
| **Slug** | `billing-dashboard` |
| **Feature ID** | `EPTTS_BIL_01` |
| **Module** | Billing Portal |
| **Portal** | https://192.168.225.195:8446 |
| **Route** | `Dashboard` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Billing portal landing view - loads a MAH's outstanding dues by GLN.

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
| Load dues | Button / action | — |
| lang-switch | select | options: English, Arabic |
| dues-gln | input | MAH GLN (13 digits) |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8446.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Click **Dashboard** in the portal navigation.
4. The page loads with the heading "Billing Dashboard".

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
