# Webhook History — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Webhook History |
| **Slug** | `web-webhook-history` |
| **Feature ID** | `EPTTS_WEB_55` |
| **Module** | monitoring |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/webhook-history` |
| **Text direction** | ltr |
| **Priority** | P3 |

## Business Purpose

Outbound webhook delivery attempts and their outcomes. Silent failure here means a partner system is out of step with the platform and nobody has been told, which is why delivery status and retry behaviour matter more than the page's own presentation.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Webhook History | Heading | — |
| AR | Button / action | — |
| Table 1 | Table | columns: PARTNER, EVENT, STATUS, HTTP, ATTEMPTS, CREATED, COMPLETED |

## Displayed metrics

- Showing: 0

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/webhook-history`.
4. The page loads with the heading "Webhook History".
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
GET 200 https://192.168.225.195:8445/registry-service/api/v1/admin/b2b-partners/webhook-deliveries?limit=25
GET 200 https://192.168.225.195:8445/registry-service/api/v1/admin/b2b-partners
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
