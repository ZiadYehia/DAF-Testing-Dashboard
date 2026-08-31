# EPCIS XML Transactions — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | EPCIS XML Transactions |
| **Slug** | `web-epcis-xml-upload` |
| **Feature ID** | `EPTTS_WEB_47` |
| **Module** | file-upload |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/bulk-upload` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Bulk EPCIS XML submission for partners without an API integration: download a template, queue files, submit, then read per-message STATUS and ERRORS. Bulk paths fail differently from single calls — partial acceptance and per-row errors — so the ERRORS column is the feature, not a detail.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| EPCIS XML Transactions | Heading | — |
| EPCIS XML Upload | Heading | — |
| 1. Download a starter XML template | Heading | — |
| 2. Upload XML files | Heading | — |
| 3. Recent submissions | Heading | — |
| AR | Button / action | — |
| Download XML template | Button / action | — |
| Submit all queued (0) | Button / action | — |
| Clear | Button / action | — |
| Refresh | Button / action | — |
| 13-digit GLN of the other party | input | 13-digit GLN of the other party |
| INV-2026-001 | input | INV-2026-001 |
| Table 1 | Table | columns: SUBMITTED, MESSAGE ID, TYPE, ITEMS, STATUS, ERRORS |

## Displayed metrics

- 1. Download a starter XML template Operations available to your role: 10
- 2. Upload XML files
- 3. Recent submissions Refresh

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/bulk-upload`.
4. The page loads with the heading "EPCIS XML Transactions".
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
