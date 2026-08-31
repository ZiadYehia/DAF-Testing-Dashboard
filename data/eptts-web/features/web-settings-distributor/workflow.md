# Settings — Distributor — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — Distributor |
| **Slug** | `web-settings-distributor` |
| **Feature ID** | `EPTTS_WEB_12` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **Distributor** |
| **Tab bar** | 0 of the Settings page |
| **Priority** | P1 |

## Business Purpose

Distributor and branch parties. The platform has no branch-role users — branch behaviour is carried by the distributor role — so this tab is where that conflation is visible and worth verifying.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Export | Button / action | — |
| Add Distributor | Button / action | — |
| Assign to Distributor | Button / action | — |
| Search distributors or branches... | input | Search distributors or branches... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **Distributor** tab.
5. The tab becomes selected and loads its own content.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /registry-service/api/v1/entities?type=distributor&limit=1000
GET /registry-service/api/v1/entities?type=branch&limit=1000
GET /registry-service/api/v1/entities/orphan/branches
```

## Notes

- Discovered live on 2026-08-31 by opening the **Distributor** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_dst`), so the elements above belong to this tab and not a sibling.
- No table was captured for this tab: it renders cards or a form rather than a grid, or its data had not loaded. Re-check before writing table-specific cases.
- Test cases are all `Under Testing` — none has been executed.
