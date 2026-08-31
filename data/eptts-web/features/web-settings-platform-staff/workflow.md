# Settings — Platform Staff — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — Platform Staff |
| **Slug** | `web-settings-platform-staff` |
| **Feature ID** | `EPTTS_WEB_21` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **Platform Staff** |
| **Tab bar** | 3 of the Settings page |
| **Priority** | P2 |

## Business Purpose

Staff account list. Overlaps the Platform tab, so worth confirming which is authoritative and whether they can disagree.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **Platform Staff** tab.
5. The tab becomes selected and loads its own content.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## Notes

- Discovered live on 2026-08-31 by opening the **Platform Staff** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_9_tabpanel_staff`), so the elements above belong to this tab and not a sibling.
- No table was captured for this tab: it renders cards or a form rather than a grid, or its data had not loaded. Re-check before writing table-specific cases.
- Test cases are all `Under Testing` — none has been executed.
