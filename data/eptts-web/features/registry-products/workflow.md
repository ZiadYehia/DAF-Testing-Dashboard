# Registry Products — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Registry Products |
| **Slug** | `registry-products` |
| **Feature ID** | `EPTTS_REG_04` |
| **Module** | Master Data Registry |
| **Portal** | https://192.168.225.195:8445 |
| **Route** | `Products` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

The authoritative product catalogue: GTIN, name, manufacturer, MAH GLN, unit price, dispense type and the Dawana-integration flag. Two fields here drive API behaviour directly - dispenseType decides whether partial dispensing is possible at all, and the Dawana flag blocks dispensing through the B2B API entirely. The GTIN/name field-swap defect is visible on this page.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Master Data Registry | Heading | — |
| ☰ | Button / action | — |
| 🏢 Parties (50+) | Button / action | — |
| 🔢 Prefixes (50+) | Button / action | — |
| 📦 Products (50+) | Button / action | — |
| ➕ Register Pharmacy | Button / action | — |
| Logout | Button / action | — |
| 🔄 Refresh | Button / action | — |
| ⏳ Sync mirror | Button / action | — |
| ⬆️ Bulk upload (JSON) | Button / action | — |
| ✅ Activate All | Button / action | — |
| + Add Product | Button / action | — |
| ✏️ | Button / action | — |
| 🚫 | Button / action | — |
| 📜 | Button / action | — |
| lang-switch | select | options: English, العربية |
| f-search | input | Search GTIN, name, manufacturer |
| f-status | select | options: All statuses, Active, Suspended, Expired, Revoked, Pending approval |
| f-disp | select | options: Any dispense, Full pack, Partial |
| f-dawana | select | options: Any Dawana, Dawana on, Dawana off |
| f-mah | input | MAH GLN (exact) |
| Table 1 | Table | columns: GTIN, NAME, MANUFACTURER, MAH GLN, UNIT PRICE, DISPENSE, DAWANA, STATUS, SYNCED, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8445.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Click **Products** in the portal navigation.
4. The page loads with the heading "Registry Products".
5. The table populates with records (or shows an empty state).

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Empty state** — filtering to zero results must clear previous rows and show an empty state.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET /registry-service/api/v1/admin/mdm/products?limit=50
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
