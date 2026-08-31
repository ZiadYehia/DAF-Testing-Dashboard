# Operations — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Operations |
| **Slug** | `web-operations` |
| **Feature ID** | `EPTTS_WEB_39` |
| **Module** | product-movement |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/operations` |
| **Text direction** | ltr |
| **Priority** | P3 |

## Business Purpose

A flat feed of every action this portal has submitted, with its reference and status. Useful as the cross-check for asynchronous work: an action that succeeded on screen but never reached a terminal state here is exactly the class of bug the API's 202-means-queued behaviour produces.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Operations | Heading | — |
| AR | Button / action | — |
| (unlabelled) | input[checkbox] | — |
| Table 1 | Table | columns: ACTION, REFERENCE, STATUS, SUBMITTED, DETAILS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/operations`.
4. The page loads with the heading "Operations".
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
GET 200 /masar-service/api/v1/portal/operations?limit=100
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
