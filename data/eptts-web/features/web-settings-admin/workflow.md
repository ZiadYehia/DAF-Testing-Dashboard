# Settings (Administration) — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings (Administration) |
| **Slug** | `web-settings-admin` |
| **Feature ID** | `EPTTS_WEB_08` |
| **Module** | Platform Dashboard |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/admin` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

The full platform administration surface: 15 tabs covering partner types (Government, Manufacturer, Distributor, Dispenser), Pharmacies and Pharmacy Admins, POS Partners, B2B Partners, Platform Staff, User Locks, Geography and System Configuration. The highest-privilege page in the product - and currently unreachable from the navigation menu.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Settings | Heading | — |
| Administration | Heading | — |
| Government | Tab | — |
| Manufacturer | Tab | — |
| Distributor | Tab | — |
| Dispenser | Tab | — |
| System | Tab | — |
| Platform | Tab | — |
| System Configuration | Tab | — |
| Pharmacies | Tab | — |
| Pharmacy Admins | Tab | — |
| POS Partners | Tab | — |
| AR | Button / action | — |
| Import | Button / action | — |
| Refresh | Button / action | — |
| Add Inspector | Button / action | — |
| Search by name or email... | input | Search by name or email... |
| Table 1 | Table | columns: NAME, EMAIL, STATUS, LAST LOGIN, ACTIONS |

## Displayed metrics

- 0 All Inspectors 0 Active 0 Inactive
- 0 All Inspectors
- 0
- All Inspectors
- 0 Active
- Active
- 0 Inactive
- Inactive
- No inspectors Add Inspector

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. The page loads with the heading "Settings (Administration)".
5. The table populates with records (or shows an empty state).

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Empty state** — filtering to zero results must clear previous rows and show an empty state.
- **Tab isolation** — switching tabs must not show the previous tab's data.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/users?limit=25&roles=inspector
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
- **Reachability defect:** this page exists and works by direct URL but has no working navigation entry. See the filed bug.
