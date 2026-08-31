# Settings — System Configuration — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — System Configuration |
| **Slug** | `web-settings-system-configuration` |
| **Feature ID** | `EPTTS_WEB_16` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **System Configuration** |
| **Tab bar** | 0 of the Settings page |
| **Priority** | P1 |

## Business Purpose

Platform-wide configuration. A change here affects every tenant at once, which makes it the highest-blast-radius surface in the dashboard and the one where a mis-saved value is hardest to notice.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Save changes | Button / action | — |
| AUTH_LOGIN_ENABLED | input[checkbox] | — |
| AUTH_MAINTENANCE_MESSAGE | textarea | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **System Configuration** tab.
5. The tab becomes selected and loads its own content.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /masar-service/api/v1/administration/settings
```

## Notes

- Discovered live on 2026-08-31 by opening the **System Configuration** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_settings`), so the elements above belong to this tab and not a sibling.
- No table was captured for this tab: it renders cards or a form rather than a grid, or its data had not loaded. Re-check before writing table-specific cases.
- Test cases are all `Under Testing` — none has been executed.
