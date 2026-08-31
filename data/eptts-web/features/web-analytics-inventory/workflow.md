# Analytics — Inventory — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Analytics — Inventory |
| **Slug** | `web-analytics-inventory` |
| **Feature ID** | `EPTTS_WEB_29` |
| **Module** | Platform Dashboard |
| **Route** | `/analytics` → tab **Inventory** |
| **Tab bar** | 0 of the Analytics page |
| **Priority** | P1 |

## Business Purpose

On-hand stock by location, product, batch and expiry, with stock value. Reconciles against the pack lifecycle, so a discrepancy here means either the analytics aggregation or the traceability record is wrong — both worth chasing.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: LOCATION, PRODUCT, GTIN, BATCH, EXPIRY, ON-HAND, UNIT PRICE, STOCK VALUE |
| AR | Button / action | — |
| Refresh | Button / action | — |
| Activity | Button / action | — |
| Inventory | Button / action | — |
| Shipments | Button / action | — |
| Expiry risk | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| 4 | Button / action | — |
| 5 | Button / action | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/analytics`.
4. Click the **Inventory** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## Notes

- Discovered live on 2026-08-31 by opening the **Inventory** tab on `/analytics`.
- Panel scoped via the tab's `aria-controls` (`page`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
