# Return Shipping — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Return Shipping |
| **Slug** | `web-return-shipping` |
| **Feature ID** | `EPTTS_WEB_35` |
| **Module** | product-movement |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/return-to-branch` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Sending stock back upstream to the branch that supplied it. Requires a free-text reason, which is a compliance artefact rather than a convenience — a return with no stated cause is not auditable. Returns must travel back to the original supplier, not an arbitrary party.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Return Shipping | Heading | — |
| Return to Branch | Heading | — |
| AR | Button / action | — |
| Initiate Return | Button / action | — |
| Scan barcode or enter SSCC... | input[text] | Scan barcode or enter SSCC... |
| Required: describe why these items are being returned... | textarea | Required: describe why these items are being returned... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/return-to-branch`.
4. The page loads with the heading "Return Shipping".

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
