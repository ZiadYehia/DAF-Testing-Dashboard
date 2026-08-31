# Settings — System — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — System |
| **Slug** | `web-settings-system` |
| **Feature ID** | `EPTTS_WEB_14` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **System** |
| **Tab bar** | 0 of the Settings page |
| **Priority** | P1 |

## Business Purpose

Integrator accounts and **their API keys**. This tab surfaces credentials, so its access control matters more than its display: anyone who can read this page can act as an integrator.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: NAME, CONTACT, API KEY, STATUS, CREATED, ACTIONS |
| New POS Partner | Button / action | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **System** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.
- **Credential exposure** — the API Key column must not render a complete usable key, and rotation must confirm first because it is irreversible.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /registry-service/api/v1/admin/integrators
```

## Notes

- Discovered live on 2026-08-31 by opening the **System** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_sys`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
