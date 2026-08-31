# Settings — Platform — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — Platform |
| **Slug** | `web-settings-platform` |
| **Feature ID** | `EPTTS_WEB_15` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **Platform** |
| **Tab bar** | 0 of the Settings page |
| **Priority** | P1 |

## Business Purpose

Platform staff accounts by role (admin, support, finance, pricing_team). Role assignment here is what grants privilege everywhere else in the product.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: EMAIL, NAME, ROLE, STATUS, LAST LOGIN, CREATED, ACTIONS |
| New platform user | Button / action | — |
| Search by email or name… | input | Search by email or name… |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **Platform** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /masar-service/api/v1/users?limit=25&roles=admin%2Csupport%2Cfinance%2Cpricing_team
```

## Notes

- Discovered live on 2026-08-31 by opening the **Platform** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_platform`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
