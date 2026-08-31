# Settings — Manufacturer — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — Manufacturer |
| **Slug** | `web-settings-manufacturer` |
| **Feature ID** | `EPTTS_WEB_11` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **Manufacturer** |
| **Tab bar** | 0 of the Settings page |
| **Priority** | P1 |

## Business Purpose

Manufacturer trade parties with their GLN, SGLN and GS1 prefix. The SGLN and prefix shown here determine how every EPC that partner submits is parsed, so a wrong value silently breaks their entire API integration rather than failing visibly.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: NAME, GLN, SGLN, PREFIX, CONTACT INFO, ADDRESS, STATUS, ACTIONS |
| Export | Button / action | — |
| Add Manufacturer | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| 4 | Button / action | — |
| 5 | Button / action | — |
| Search by name, GLN, or email... | input | Search by name, GLN, or email... |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **Manufacturer** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.
- **GLN validity** — check-digit validation matters here: a bad GLN corrupts every event addressed to that party.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /registry-service/api/v1/entities/manufacturers?limit=1
GET /registry-service/api/v1/entities/manufacturers?isActive=true&limit=1
GET /registry-service/api/v1/entities/manufacturers?isActive=false&limit=1
GET /registry-service/api/v1/entities/manufacturers?limit=25&offset=0
```

## Notes

- Discovered live on 2026-08-31 by opening the **Manufacturer** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_mfr`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
