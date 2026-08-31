# Repack — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Repack |
| **Slug** | `web-repack` |
| **Feature ID** | `EPTTS_WEB_42` |
| **Module** | product-structure |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/repack-ingest` |
| **Text direction** | ltr |
| **Priority** | P3 |

## Business Purpose

Bulk 3PL repack ingestion: a logistics provider uploads the result of physically rebuilding containers, and the platform reconciles the new parent/child structure. Asynchronous with a job list, so the RESULT column, not the upload response, is what says whether it worked.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Repack | Heading | — |
| 3PL Repack Ingest | Heading | — |
| Recent uploads | Heading | — |
| AR | Button / action | — |
| Upload & Process | Button / action | — |
| Refresh | Button / action | — |
| Table 1 | Table | columns: CREATED, STATUS, SSCCS, PACKS, RESULT |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/repack-ingest`.
4. The page loads with the heading "Repack".
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
GET 200 /masar-service/api/v1/repack-ingest/jobs?limit=20
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
