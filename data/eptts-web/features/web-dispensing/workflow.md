# Dispensing — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Dispensing |
| **Slug** | `web-dispensing` |
| **Feature ID** | `EPTTS_WEB_34` |
| **Module** | product-movement |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/dispensing` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

The terminal step for a pack: scanned out to a patient against a prescription. Queries packs with `status=partially_dispensed` for the current GLN, so it is also the only dashboard view of partial state. Irreversible, which makes the scan-validation and duplicate-dispense paths the highest-value checks.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Dispensing | Heading | — |
| Scan Pack | Heading | — |
| Recent Dispenses | Heading | — |
| AR | Button / action | — |
| Scan barcode or enter SGTIN... | input | Scan barcode or enter SGTIN... |
| Table 1 | Table | columns: PACK, QUANTITY, PRESCRIPTION, TIME |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/dispensing`.
4. The page loads with the heading "Dispensing".
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
GET 200 /masar-service/api/v1/packs?status=partially_dispensed&gln=9999999999999
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
