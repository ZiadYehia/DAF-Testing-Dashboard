# Individual Packs — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Individual Packs |
| **Slug** | `web-individual-packs` |
| **Feature ID** | `EPTTS_WEB_40` |
| **Module** | product-structure |
| **Portal** | https://192.168.225.195:8444 |
| **Route** | `/aggregation/individual-packs` |
| **Text direction** | ltr |
| **Priority** | P2 |

## Business Purpose

Handling loose packs outside any container — scanning them, unpacking them from a parent, or entering them by hand. Manual entry is the risky path: it bypasses the barcode, so identifier validation is the only thing standing between a typo and a corrupted trace.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Individual Packs | Heading | — |
| AR | Button / action | — |
| Scan Packs | Button / action | — |
| Unpack | Button / action | — |
| Manual Entry | Button / action | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/aggregation/individual-packs`.
4. The page loads with the heading "Individual Packs".

## Edge Cases & Validation Rules

- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.
- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.
- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.
- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.

## API calls observed

Captured from the browser during discovery — these are the endpoints this page depends on:

```
GET 200 /masar-service/api/v1/users/me
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=distributor&isActive=true
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities/manufacturers?isActive=true
GET 200 https://192.168.225.195:8445/registry-service/api/v1/entities?type=branch&isActive=true
```

## Notes

- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.
- Test cases carry Status `Under Testing`; none has been executed yet.
