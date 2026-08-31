# GS1 Prefixes — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | GS1 Prefixes |
| **Slug** | `registry-prefixes` |
| **Feature ID** | `EPTTS_REG_03` |
| **Module** | Master Data Registry |
| **Portal** | https://192.168.225.195:8445 |
| **Route** | `Prefixes` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

GS1 Company Prefixes and their owning GLN. The GCP length here determines how every SGTIN and SSCC for that partner is parsed, so a wrong prefix silently corrupts EPC interpretation across the whole platform.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Master Data Registry | Heading | — |
| ☰ | Button / action | — |
| 🏢 Parties (50+) | Button / action | — |
| 🔢 Prefixes (50+) | Button / action | — |
| 📦 Products (0) | Button / action | — |
| ➕ Register Pharmacy | Button / action | — |
| Logout | Button / action | — |
| 🔄 Refresh | Button / action | — |
| ⏳ Sync mirror | Button / action | — |
| ⬆️ Bulk upload (JSON) | Button / action | — |
| ✅ Activate All | Button / action | — |
| Load more | Button / action | — |
| lang-switch | select | options: English, العربية |
| f-search | input | Search prefix, owner GLN |
| f-owner | input | Filter by owner GLN (exact) |
| Table 1 | Table | columns: PREFIX, OWNER GLN, GCP LENGTH, STATUS, SYNCED |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8445.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Click **Prefixes** in the portal navigation.
4. The page loads with the heading "GS1 Prefixes".
5. The table populates with records (or shows an empty state).

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Empty state** — filtering to zero results must clear previous rows and show an empty state.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET /registry-service/api/v1/admin/mdm/prefixes?limit=50
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
