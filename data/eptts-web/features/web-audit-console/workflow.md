# Audit Console — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Audit Console |
| **Slug** | `web-audit-console` |
| **Feature ID** | `EPTTS_WEB_06` |
| **Module** | Platform Dashboard |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/audit` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

The regulatory audit trail across four tabs - Regulatory events, EDA submissions, Master-data changes and Integrity. This is the evidence record: it must be complete, immutable and attributable. It also carries a 'What is not recorded?' disclosure, which is itself worth verifying against reality.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Audit Console | Heading | — |
| Regulatory events | Tab | — |
| EDA submissions | Tab | — |
| Master-data changes | Tab | — |
| Integrity | Tab | — |
| AR | Button / action | — |
| What is not recorded? | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| 4 | Button / action | — |
| 5 | Button / action | — |
| 13-digit GLN | input[text] | 13-digit GLN |
| Pack serial identifier | input[text] | Pack serial identifier |
| Date From | input[text] | Date From |
| Date To | input[text] | Date To |
| Search descriptions | input[text] | Search descriptions |
| Table 1 | Table | columns: EVENT TIME, EVENT TYPE, CATEGORY, SEVERITY, ACTOR, ENTITY GLN, DESCRIPTION |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/audit`.
4. The page loads with the heading "Audit Console".
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
GET /masar-service/api/v1/audit/regulatory?limit=25&page=1&sortBy=eventTime&sortOrder=DESC
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
