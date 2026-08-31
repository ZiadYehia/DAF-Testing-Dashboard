# Settings — Geography — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — Geography |
| **Slug** | `web-settings-geography` |
| **Feature ID** | `EPTTS_WEB_23` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **Geography** |
| **Tab bar** | 4 of the Settings page |
| **Priority** | P3 |

## Business Purpose

Governorates and areas with bilingual names. Feeds address validation on pharmacy registration, so a missing area blocks onboarding somewhere far from this page.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: Code, Name (EN), Name (AR) |
| Table | Table | columns: Code, Name (EN), Name (AR), Area |
| Select .xlsx | Button / action | — |
| Import | Button / action | — |
| Cancel | Button / action | — |
| Add area | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| Add district | Button / action | — |
| Browse Files | input[file] | — |
| Browse Files | input[file] | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **Geography** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /registry-service/api/v1/geography/areas
GET /registry-service/api/v1/geography/governorates
```

## Notes

- Discovered live on 2026-08-31 by opening the **Geography** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_10_tabpanel_geography`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
