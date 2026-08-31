# Settings — Pharmacy Admins — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — Pharmacy Admins |
| **Slug** | `web-settings-pharmacy-admins` |
| **Feature ID** | `EPTTS_WEB_18` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **Pharmacy Admins** |
| **Tab bar** | 1 of the Settings page |
| **Priority** | P2 |

## Business Purpose

Pharmacy administrator accounts and the pharmacy each is bound to. An admin bound to the wrong pharmacy is a cross-tenant access problem, not a data-entry slip.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: Name, GLN, SGLN, Address, Login, Status, Actions |
| Add Pharmacy Admin | Button / action | — |
| 1 | Button / action | — |
| Search by name or GLN... | input | Search by name or GLN... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **Pharmacy Admins** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.
- **GLN validity** — check-digit validation matters here: a bad GLN corrupts every event addressed to that party.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /masar-service/api/v1/users?limit=200&roles=pharmacy_admin
GET /registry-service/api/v1/entities?type=pharmacy&isMainBranch=true&limit=1
GET /registry-service/api/v1/entities?type=pharmacy&isActive=true&isMainBranch=true&limit=1
GET /registry-service/api/v1/entities?type=pharmacy&isActive=false&isMainBranch=true&limit=1
GET /registry-service/api/v1/geography/areas
GET /registry-service/api/v1/geography/governorates
GET /registry-service/api/v1/entities?type=pharmacy&isMainBranch=true&limit=25&offset=0
```

## Notes

- Discovered live on 2026-08-31 by opening the **Pharmacy Admins** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_7_tabpanel_pharmacyAdmins`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
