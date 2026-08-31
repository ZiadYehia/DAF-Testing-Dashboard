# Message Log — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Message Log |
| **Slug** | `web-message-log` |
| **Feature ID** | `EPTTS_WEB_54` |
| **Module** | monitoring |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/message-log` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Integration audit log at the HTTP level: channel, direction, method, path, status and processing time. Where an integration failure is actually diagnosed, and the only place a 5xx or a slow endpoint becomes visible after the fact.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Message Log | Heading | — |
| Integration Audit Log | Heading | — |
| AR | Button / action | — |
| Refresh | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| 4 | Button / action | — |
| 5 | Button / action | — |
| Start Date | input[text] | Start Date |
| End Date | input[text] | End Date |
| Table 1 | Table | columns: CREATED AT, CHANNEL, ACTIVITY TYPE, DIRECTION, STATUS, HTTP METHOD, REQUEST PATH, HTTP STATUS, PROCESSING TIME |

## Displayed metrics

- 503
- 202
- 200

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/message-log`.
4. The page loads with the heading "Message Log".
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
GET 200 /masar-service/api/v1/message-log?limit=20&offset=0
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
