# Desktop Agent Monitoring — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Desktop Agent Monitoring |
| **Slug** | `web-agent-monitoring` |
| **Feature ID** | `EPTTS_WEB_60` |
| **Module** | desktop-agent |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/agent-monitoring` |
| **Text direction** | ltr |
| **Priority** | P3 |

## Business Purpose

Health of the deployed Windows Masar Agent fleet (the separate `eptts` app). Tested here from the administrator's side: what the dashboard reports about agents, not what the agent does.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Desktop Agent - Monitoring | Heading | — |
| Agent Monitoring | Heading | — |
| AR | Button / action | — |
| Apply | Button / action | — |
| Filter by GLN | input | Filter by GLN |
| Table 1 | Table | columns: STATUS, DEVICE NAME, PHARMACY GLN, VERSION, LAST ACTIVITY, REGISTRATION DATE, ACTIONS |

## Displayed metrics

- 0 ONLINE 0 OFFLINE 0 TOTAL DEVICES
- 0 ONLINE
- 0 OFFLINE
- 0 TOTAL DEVICES

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/agent-monitoring`.
4. The page loads with the heading "Desktop Agent Monitoring".
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
GET 200 /masar-service/api/v1/agent/devices
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
