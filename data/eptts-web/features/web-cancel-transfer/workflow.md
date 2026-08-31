# Cancel Transfer — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Cancel Transfer |
| **Slug** | `web-cancel-transfer` |
| **Feature ID** | `EPTTS_WEB_37` |
| **Module** | product-movement |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/cancellations` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Reverses an already-submitted event, keyed to the ORIGINAL EVENT with a reason and a requester GLN. A cancellation is itself an auditable record rather than a deletion, so the thing to verify is that the original event remains visible in the trace alongside its cancellation.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Cancel Transfer | Heading | — |
| Cancellations | Heading | — |
| AR | Button / action | — |
| Table 1 | Table | columns: TYPE, ORIGINAL EVENT, STATUS, REASON, REQUESTER GLN, AFFECTED PACKS, CREATED AT, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/cancellations`.
4. The page loads with the heading "Cancel Transfer".
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
GET 200 /masar-service/api/v1/cancellations?limit=20
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
