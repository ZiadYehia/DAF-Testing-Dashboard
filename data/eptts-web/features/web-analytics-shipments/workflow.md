# Analytics — Shipments — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Analytics — Shipments |
| **Slug** | `web-analytics-shipments` |
| **Feature ID** | `EPTTS_WEB_30` |
| **Module** | Platform Dashboard |
| **Route** | `/analytics` → tab **Shipments** |
| **Tab bar** | 0 of the Analytics page |
| **Priority** | P2 |

## Business Purpose

Shipped versus received units per source/destination pair. The difference between the two columns is in-transit or lost stock, which makes this the clearest view of custody-transfer failures.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: SOURCE, DESTINATION, PRODUCT, LINES, SHIPPED, RECEIVED |
| AR | Button / action | — |
| Refresh | Button / action | — |
| Activity | Button / action | — |
| Inventory | Button / action | — |
| Shipments | Button / action | — |
| Expiry risk | Button / action | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/analytics`.
4. Click the **Shipments** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## Notes

- Discovered live on 2026-08-31 by opening the **Shipments** tab on `/analytics`.
- Panel scoped via the tab's `aria-controls` (`page`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
