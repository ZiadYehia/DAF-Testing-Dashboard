# Commissioning and Packing CSV — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Commissioning and Packing CSV |
| **Slug** | `web-commissioning-packing-csv` |
| **Feature ID** | `EPTTS_WEB_48` |
| **Module** | file-upload |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/import-jobs` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

CSV import for commissioning and packing, with source and destination GLNs and a job list carrying DURATION and RESULT. The GLN pair is what makes an import attributable; a job that completes with the wrong source GLN writes events against the wrong party.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Commissioning and Packing CSV | Heading | — |
| Import Jobs | Heading | — |
| AR | Button / action | — |
| Upload CSV | Button / action | — |
| Upload EPCIS Document | Button / action | — |
| Templates | Button / action | — |
| Refresh | Button / action | — |
| 1 | Button / action | — |
| Table 1 | Table | columns: STATUS, TYPE, FILES, SOURCE GLN, DESTINATION GLN, CREATED BY, CREATED AT, DURATION, RESULT, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/import-jobs`.
4. The page loads with the heading "Commissioning and Packing CSV".
5. The table populates with records (or shows an empty state).

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Empty state** — filtering to zero results must clear previous rows and show an empty state.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET 200 /masar-service/api/v1/users/me
GET 200 /masar-service/api/v1/aggregation/import-jobs?limit=20&offset=0
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
