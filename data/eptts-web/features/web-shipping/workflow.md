# Shipping — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Shipping |
| **Slug** | `web-shipping` |
| **Feature ID** | `EPTTS_WEB_32` |
| **Module** | product-movement |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/shipments` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

Where a consignment leaves a party: an invoice number is entered, SSCCs are attached and a shipping event is written. The page loads the registry's distributor/hospital/branch/pharmacy lists to pick a destination, so a missing or inactive party here blocks despatch entirely. Custody does NOT move at this step — the pack stays with the sender until the receiver confirms — which is the single most misunderstood rule in the flow.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Shipping | Heading | — |
| AR | Button / action | — |
| shipments.bulkUpload | Button / action | — |
| View History | Button / action | — |
| Start Invoice | Button / action | — |
| Enter invoice number... | input | Enter invoice number... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/shipments`.
4. The page loads with the heading "Shipping".

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET 200 /masar-service/api/v1/users/me
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=distributor&limit=30&offset=0
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=hospital&limit=30&offset=0
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=branch&limit=30&offset=0
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=pharmacy&limit=30&offset=0
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
