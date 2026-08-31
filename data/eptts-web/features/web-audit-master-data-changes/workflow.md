# Audit Console — Master-data changes — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Audit Console — Master-data changes |
| **Slug** | `web-audit-master-data-changes` |
| **Feature ID** | `EPTTS_WEB_26` |
| **Module** | Platform Dashboard |
| **Route** | `/audit` → tab **Master-data changes** |
| **Tab bar** | 0 of the Audit Console page |
| **Priority** | P2 |

## Business Purpose

Change log for parties, prefixes and products, including which fields changed. This is how a bad master-data edit is traced back — and master data is exactly where a wrong value silently corrupts EPC parsing.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: CREATED AT, TYPE, ACTION, GLN / GTIN, CHANGED BY, FIELDS CHANGED |
| What is not recorded? | Button / action | — |
| 1 | Button / action | — |
| GLN or GTIN | input[text] | GLN or GTIN |
| Entity UUID or product GTIN | input[text] | Entity UUID or product GTIN |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/audit`.
4. Click the **Master-data changes** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.
- **GLN validity** — check-digit validation matters here: a bad GLN corrupts every event addressed to that party.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /registry-service/api/v1/master-data-audit?limit=50&offset=0
```

## Notes

- Discovered live on 2026-08-31 by opening the **Master-data changes** tab on `/audit`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_masterData`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
