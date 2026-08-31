# EPCIS Messages — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | EPCIS Messages |
| **Slug** | `web-epcis-messages` |
| **Feature ID** | `EPTTS_WEB_53` |
| **Module** | monitoring |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/epcis-b2b` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Every B2B EPCIS message with SUCCEEDED and FAILED counts per message. Directly exposes the platform's most-misread behaviour — a message can be accepted and still have failed events — so the per-event counts, not the message status, are what tell an operator the truth. Also allows sending raw XML, which makes it the manual reproduction tool for an API defect.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| EPCIS Messages | Heading | — |
| Message History | Heading | — |
| AR | Button / action | — |
| Send | Button / action | — |
| Clear | Button / action | — |
| Refresh | Button / action | — |
| Paste EPCIS XML content here... | textarea | Paste EPCIS XML content here... |
| Filter by Sender GLN | input | Filter by Sender GLN |
| Table 1 | Table | columns: MESSAGE ID, SENDER, RECEIVER, EVENT TYPE, STATUS, TOTAL, SUCCEEDED, FAILED, EVENT TIME, ACTIONS |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/epcis-b2b`.
4. The page loads with the heading "EPCIS Messages".
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
GET 200 /masar-service/api/v1/epcis
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
