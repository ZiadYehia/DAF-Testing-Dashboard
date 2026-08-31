# Settings — POS Partners — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — POS Partners |
| **Slug** | `web-settings-pos-partners` |
| **Feature ID** | `EPTTS_WEB_19` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **POS Partners** |
| **Tab bar** | 2 of the Settings page |
| **Priority** | P2 |

## Business Purpose

POS partner integrators, which act on behalf of a pharmacy GLN via actingOnBehalfOfGln. The delegation configured here is a distinct authorization surface from the pharmacy itself.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **POS Partners** tab.
5. The tab becomes selected and loads its own content.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## Notes

- Discovered live on 2026-08-31 by opening the **POS Partners** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_8_tabpanel_pos`), so the elements above belong to this tab and not a sibling.
- No table was captured for this tab: it renders cards or a form rather than a grid, or its data had not loaded. Re-check before writing table-specific cases.
- Test cases are all `Under Testing` — none has been executed.
