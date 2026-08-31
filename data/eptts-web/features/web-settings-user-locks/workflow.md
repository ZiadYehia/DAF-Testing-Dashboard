# Settings — User Locks — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — User Locks |
| **Slug** | `web-settings-user-locks` |
| **Feature ID** | `EPTTS_WEB_22` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **User Locks** |
| **Tab bar** | 3 of the Settings page |
| **Priority** | P1 |

## Business Purpose

Account lockout state across all users. This is the brute-force defence: a lock that cannot be applied, or that silently expires, is a security control that only appears to work.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: Email, Entity, Role, Lock Status, Actions |
| Refresh | Button / action | — |
| Search by email... | input | Search by email... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **User Locks** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /masar-service/api/v1/users?limit=25
```

## Notes

- Discovered live on 2026-08-31 by opening the **User Locks** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_9_tabpanel_locks`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
