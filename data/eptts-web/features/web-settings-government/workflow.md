# Settings — Government — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — Government |
| **Slug** | `web-settings-government` |
| **Feature ID** | `EPTTS_WEB_10` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **Government** |
| **Tab bar** | 0 of the Settings page |
| **Priority** | P2 |

## Business Purpose

Government/regulator user accounts. Small list, high privilege — an account here can see across every tenant, so account lifecycle (create, deactivate, last-login visibility) is the whole risk.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: NAME, EMAIL, STATUS, LAST LOGIN, ACTIONS |
| Refresh | Button / action | — |
| Add Inspector | Button / action | — |
| Search by name or email... | input | Search by name or email... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **Government** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## Notes

- Discovered live on 2026-08-31 by opening the **Government** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_gov`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
