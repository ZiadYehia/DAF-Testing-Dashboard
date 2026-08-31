# Violations — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Violations |
| **Slug** | `web-violations` |
| **Feature ID** | `EPTTS_WEB_05` |
| **Module** | Platform Dashboard |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/violations` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Compliance violations raised against trade partners, bucketed by severity. Drives regulatory follow-up, so a missed violation is a compliance failure rather than a display bug.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Statistics | Heading | — |
| Regulatory Violations & Suspect Products | Heading | — |
| AR | Button / action | — |
| Refresh | Button / action | — |
| 0 Total open | Button / action | — |
| 0 Critical | Button / action | — |
| 0 High | Button / action | — |
| 0 Medium | Button / action | — |
| 0 Low | Button / action | — |
| urn:… or 013… or GLN | input[text] | urn:… or 013… or GLN |
| Table 1 | Table | columns: SEVERITY, RULE, SUBJECT, ACTOR, EVIDENCE, EVENT TIME |

## Displayed metrics

- By category No violations detected 🎉
- By category
- Filters Search (serial / GTIN / actor GLN)
- Filters
- Findings (showing 0 of 0)

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/violations`.
4. The page loads with the heading "Violations".
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
GET /masar-service/api/v1/reports/violations
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
