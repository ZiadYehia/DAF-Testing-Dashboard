# Information Center — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Information Center |
| **Slug** | `web-information-center` |
| **Feature ID** | `EPTTS_WEB_01` |
| **Module** | Platform Dashboard |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/information-center` |
| **Text direction** | ltr |
| **Priority** | P3 |

## Business Purpose

The post-login landing page. Publishes platform announcements, upcoming compliance dates, guides and support contacts to trade partners. Read-only for every role, and the only page every role can reach - which makes it the de-facto fallback route when navigation fails.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Information Center | Heading | — |
| Latest Updates | Heading | — |
| Upcoming Dates | Heading | — |
| Guides and Resources | Heading | — |
| Support and Help | Heading | — |
| AR | Button / action | — |
| Search... | input[text] | Search... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/information-center`.
4. The page loads with the heading "Information Center".

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET /masar-service/api/v1/users/me
GET /masar-service/api/v1/information-center/announcements/urgent
GET /masar-service/api/v1/information-center/announcements/pinned
GET /masar-service/api/v1/information-center/announcements
GET /masar-service/api/v1/information-center/announcements/upcoming-dates
GET /masar-service/api/v1/information-center/announcements?category=training
GET /masar-service/api/v1/information-center/announcements?category=user_guides
GET /masar-service/api/v1/information-center/announcements?category=integration
GET /masar-service/api/v1/information-center/announcements?category=system
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases are all `new_added` — none has been executed yet.
