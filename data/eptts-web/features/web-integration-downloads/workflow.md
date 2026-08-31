# Integration Downloads — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Integration Downloads |
| **Slug** | `web-integration-downloads` |
| **Feature ID** | `EPTTS_WEB_58` |
| **Module** | integrations |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/integration-downloads` |
| **Text direction** | ltr |
| **Priority** | P3 |

## Business Purpose

What partners fetch to integrate: a Postman collection and the latest master-data snapshot, with version management. Worth noting the page currently renders an error banner because one of its backing endpoints 404s — the content still loads, so the failure is visible but not blocking.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Integration Downloads | Heading | — |
| Postman Collection | Heading | — |
| Latest Master Data Snapshot | Heading | — |
| AR | Button / action | — |
| Upload collection | Button / action | — |
| Download | Button / action | — |
| Manage versions | Button / action | — |
| Download Latest | Button / action | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/integration-downloads`.
4. The page loads with the heading "Integration Downloads".

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET 200 /masar-service/api/v1/users/me
GET 404 https://192.168.225.195:8445/registry-service/api/v1/onboarding/integration/info
GET 200 https://192.168.225.195:8445/registry-service/api/v1/admin/integration-downloads/postman/info
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
- **This route did not resolve during discovery** — it fell back to `/information-center`.
