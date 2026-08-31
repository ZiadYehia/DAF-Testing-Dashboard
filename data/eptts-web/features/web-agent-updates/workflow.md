# Desktop Agent Updates — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Desktop Agent Updates |
| **Slug** | `web-agent-updates` |
| **Feature ID** | `EPTTS_WEB_63` |
| **Module** | desktop-agent |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/agent-updates` |
| **Text direction** | ltr |
| **Priority** | P3 |

## Business Purpose

Publishes agent builds and controls rollout. A bad update reaches every pharmacy counter running the agent, so rollout scoping and rollback are the parts that matter.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Desktop Agent - Updates | Heading | — |
| Agent Updates | Heading | — |
| AR | Button / action | — |
| Publish Update | Button / action | — |
| Table 1 | Table | columns: VERSION, PLATFORM, ROLLOUT %, MINIMUM, PUBLISH DATE, ACTIVE, ACTIONS |

## Displayed metrics

- 0 TOTAL UPDATES 0 ACTIVE N/A LATEST VERSION
- 0 TOTAL UPDATES
- 0 ACTIVE

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/agent-updates`.
4. The page loads with the heading "Desktop Agent Updates".
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
GET 200 /masar-service/api/v1/agent/updates/list
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
