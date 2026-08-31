# Master Data Snapshots — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Master Data Snapshots |
| **Slug** | `web-master-data` |
| **Feature ID** | `EPTTS_WEB_07` |
| **Module** | Platform Dashboard |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/master-data` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Generates and distributes full master-data snapshots and incremental deltas that integrators pull via the manifest endpoint. Each file is SHA-256 stamped and the manifest is HMAC-signed, so integrity verification is part of the contract rather than optional.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Master Data Snapshots | Heading | — |
| Versions (0 most recent) | Heading | — |
| How it works | Heading | — |
| AR | Button / action | — |
| Generate Now | Button / action | — |
| Table 1 | Table | columns: VERSION, TYPE, FROM → TO, RECORDS, SIZE, STATUS, GENERATED, SHA-256, ACTIONS |

## Displayed metrics

- — LATEST VERSION — LAST GENERATED OFF AUTO-SCHEDULER (15 MIN) 0 B TOTAL STORED
- — LATEST VERSION
- — LAST GENERATED
- OFF AUTO-SCHEDULER (15 MIN)
- OFF
- 0 B TOTAL STORED

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/master-data`.
4. The page loads with the heading "Master Data Snapshots".
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
GET /masar-service/api/v1/users/me
GET /registry-service/api/v1/master-data/versions
GET /registry-service/api/v1/onboarding/integration/info
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
- **Reachability defect:** this page exists and works by direct URL but has no working navigation entry. See the filed bug.
