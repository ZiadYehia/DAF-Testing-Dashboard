# MDM Registry — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | MDM Registry |
| **Slug** | `web-mdm-registry` |
| **Feature ID** | `EPTTS_WEB_51` |
| **Module** | master-data |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/mdm-registry` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

The master-data authority behind every validation, in three tabs — Parties, Prefixes, Products. Carries GCP LEN, which decides how an SGTIN URN is parsed: a wrong prefix length silently produces valid-looking identifiers that resolve to nothing. Also offers bulk JSON upload and re-sync, so drift between this and the trading data is itself a failure mode.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| MDM Registry | Heading | — |
| Parties (200) | Tab | — |
| Prefixes (200) | Tab | — |
| Products (200) | Tab | — |
| AR | Button / action | — |
| Refresh | Button / action | — |
| Re-sync from existing | Button / action | — |
| Bulk upload (JSON) | Button / action | — |
| Add Party | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| 4 | Button / action | — |
| 5 | Button / action | — |
| Load more | Button / action | — |
| Table 1 | Table | columns: GLN, NAME, TYPE, PREFIX, GCP LEN, STATUS, LICENSE, SYNCED, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/mdm-registry`.
4. The page loads with the heading "MDM Registry".
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
GET 200 /masar-service/api/v1/users/me
GET 200 https://192.168.225.195:8445/registry-service/api/v1/admin/mdm/prefixes?limit=200
GET 200 https://192.168.225.195:8445/registry-service/api/v1/admin/mdm/products?limit=200
GET 200 https://192.168.225.195:8445/registry-service/api/v1/admin/mdm/parties?limit=200
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
