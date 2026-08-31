# Analytics — Expiry risk — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Analytics — Expiry risk |
| **Slug** | `web-analytics-expiry-risk` |
| **Feature ID** | `EPTTS_WEB_31` |
| **Module** | Platform Dashboard |
| **Route** | `/analytics` → tab **Expiry risk** |
| **Tab bar** | 0 of the Analytics page |
| **Priority** | P1 |

## Business Purpose

Stock approaching expiry, bucketed by days remaining. Directly drives write-off decisions, so a wrong bucket boundary has financial consequence — and boundary days are the cases that matter.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: LOCATION, GTIN, BATCH, EXPIRY, DAYS LEFT, BUCKET, UNITS AT RISK |
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
4. Click the **Expiry risk** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.

## Notes

- Discovered live on 2026-08-31 by opening the **Expiry risk** tab on `/analytics`.
- Panel scoped via the tab's `aria-controls` (`page`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
