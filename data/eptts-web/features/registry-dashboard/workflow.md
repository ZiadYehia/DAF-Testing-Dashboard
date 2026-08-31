# Registry Dashboard — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Registry Dashboard |
| **Slug** | `registry-dashboard` |
| **Feature ID** | `EPTTS_REG_01` |
| **Module** | Master Data Registry |
| **Portal** | https://192.168.225.195:8445 |
| **Route** | `Dashboard` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Registry portal landing view - opens directly onto the Parties register.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Master Data Registry | Heading | — |
| ☰ | Button / action | — |
| 🏢 Parties (50+) | Button / action | — |
| 🔢 Prefixes (0) | Button / action | — |
| 📦 Products (0) | Button / action | — |
| ➕ Register Pharmacy | Button / action | — |
| Logout | Button / action | — |
| 🔄 Refresh | Button / action | — |
| ⏳ Sync mirror | Button / action | — |
| ⬆️ Bulk upload (JSON) | Button / action | — |
| ✅ Activate All | Button / action | — |
| + Add Party | Button / action | — |
| ✏️ | Button / action | — |
| 👥 Accounts | Button / action | — |
| 🔑 B2B Key | Button / action | — |
| lang-switch | select | options: English, العربية |
| f-search | input | Search GLN, name |
| f-status | select | options: All statuses, Active, Suspended, Expired, Revoked, Pending approval, Blocked |
| f-type | select | options: All types, Manufacturer, Distributor, Branch, Pharmacy |
| Table 1 | Table | columns: GLN, NAME, TYPE, GROUP, PREFIX, GCP, STATUS, LICENSE STATUS, PARENT, SYNCED, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8445.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Click **Dashboard** in the portal navigation.
4. The page loads with the heading "Registry Dashboard".
5. The table populates with records (or shows an empty state).

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Empty state** — filtering to zero results must clear previous rows and show an empty state.

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
