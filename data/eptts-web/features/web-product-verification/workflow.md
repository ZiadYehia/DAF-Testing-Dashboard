# Product Verification — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Product Verification |
| **Slug** | `web-product-verification` |
| **Feature ID** | `EPTTS_WEB_45` |
| **Module** | product-actions |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/verify` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Answers the authenticity question for a single pack, from either an SGTIN URN or a scanned element string. Note an UNKNOWN pack is not an error condition — the API returns 200 with `verified: false` — so a test asserting non-existence must read the verdict, never the status code, and the page must show 'not verified' rather than a blank result.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Product Verification | Heading | — |
| Verify a pack | Heading | — |
| AR | Button / action | — |
| Verify | Button / action | — |
| Clear | Button / action | — |
| urn:epc:id:sgtin:05413868.11042.SBX350923   or   (01)05413868110425(21)SBX350923 | input[text] | urn:epc:id:sgtin:05413868.11042.SBX350923   or   (01)05413868110425(21)SBX350923 |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/verify`.
4. The page loads with the heading "Product Verification".

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
