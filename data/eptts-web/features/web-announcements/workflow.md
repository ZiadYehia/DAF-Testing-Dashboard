# Announcements — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Announcements |
| **Slug** | `web-announcements` |
| **Feature ID** | `EPTTS_WEB_56` |
| **Module** | administration |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/admin/announcements` |
| **Text direction** | ltr |
| **Priority** | P3 |

## Business Purpose

Authoring side of the Information Center: platform staff publish notices that every trade partner reads. The pairing to test is publication — what is created here must appear there, with the right audience and the right urgency.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Announcements | Heading | — |
| AR | Button / action | — |
| New Announcement | Button / action | — |
| Search... | input[text] | Search... |
| Table 1 | Table | columns: TITLE, CATEGORY, PRIORITY, STATUS, VIEWS, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin/announcements`.
4. The page loads with the heading "Announcements".
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
GET 200 /masar-service/api/v1/admin/information-center/announcements?limit=25&offset=0
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
