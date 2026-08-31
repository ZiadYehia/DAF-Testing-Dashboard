# Trace — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Trace |
| **Slug** | `web-trace` |
| **Feature ID** | `EPTTS_WEB_52` |
| **Module** | monitoring |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/trace` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Full event history for one pack or container, plus parent-container lookup. This is the system-of-record view a regulator or investigator reads, so a gap or a wrongly-ordered event here is worse than a broken page: the trace is the product.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Trace | Heading | — |
| Traceability | Heading | — |
| AR | Button / action | — |
| Trace Pack | Button / action | — |
| Search for Parent Container | Button / action | — |
| Trace | Button / action | — |
| e.g.: urn:epc:id:sgtin:6223001920.016.TEST001 or SSCC | input[text] | e.g.: urn:epc:id:sgtin:6223001920.016.TEST001 or SSCC |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/trace`.
4. The page loads with the heading "Trace".

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET 200 /masar-service/api/v1/users/me
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
