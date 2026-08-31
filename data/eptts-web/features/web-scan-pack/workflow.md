# Scan Pack — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Scan Pack |
| **Slug** | `web-scan-pack` |
| **Feature ID** | `EPTTS_WEB_43` |
| **Module** | product-actions |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/scanning` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

The barcode workbench: scan a DataMatrix, see what the platform knows, and keep a scan log. It is the fastest way to answer 'is this identifier even valid?', so its parsing of the GS1 element string — AI (01) GTIN plus (21) serial — is what everything downstream depends on.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Scan Pack | Heading | — |
| Pack Scanner | Heading | — |
| Scan DataMatrix | Heading | — |
| Scan Log | Heading | — |
| AR | Button / action | — |
| Scan | Button / action | — |
| Scan or type DataMatrix... | input[text] | Scan or type DataMatrix... |
| (unlabelled) | input[checkbox] | — |

## Displayed metrics

- 0 Decommissioned 0 Commissioned 0 Errors
- 0 Decommissioned
- 0
- 0 Commissioned
- 0 Errors

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/scanning`.
4. The page loads with the heading "Scan Pack".

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
