# Settings — Dispenser — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — Dispenser |
| **Slug** | `web-settings-dispenser` |
| **Feature ID** | `EPTTS_WEB_13` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **Dispenser** |
| **Tab bar** | 0 of the Settings page |
| **Priority** | P1 |

## Business Purpose

Pharmacy (dispenser) parties, including the linked admin and login state. A pharmacy with no linked admin cannot be administered, which makes the LINKED ADMIN column a real integrity check rather than decoration.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: NAME, GLN, SGLN, ADDRESS, LINKED ADMIN, LOGIN, STATUS, ACTIONS |
| Export | Button / action | — |
| Bulk Import | Button / action | — |
| Add Pharmacy | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| 4 | Button / action | — |
| 5 | Button / action | — |
| Search by name, GLN, or address... | input | Search by name, GLN, or address... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **Dispenser** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.
- **GLN validity** — check-digit validation matters here: a bad GLN corrupts every event addressed to that party.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /registry-service/api/v1/entities?type=pharmacy&isMainBranch=false&limit=1
GET /registry-service/api/v1/entities?type=pharmacy&isActive=true&isMainBranch=false&limit=1
GET /registry-service/api/v1/entities?type=pharmacy&isActive=false&isMainBranch=false&limit=1
GET /masar-service/api/v1/users?limit=200&roles=pharmacy%2Cpharmacy_admin
GET /registry-service/api/v1/geography/areas
GET /registry-service/api/v1/geography/governorates
GET /registry-service/api/v1/entities?type=pharmacy&isMainBranch=false&limit=25&offset=0
```

## Notes

- Discovered live on 2026-08-31 by opening the **Dispenser** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_dsp`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
