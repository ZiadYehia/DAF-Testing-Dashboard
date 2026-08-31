# Settings — B2B Partners — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Settings — B2B Partners |
| **Slug** | `web-settings-b2b-partners` |
| **Feature ID** | `EPTTS_WEB_20` |
| **Module** | Platform Dashboard |
| **Route** | `/admin` → tab **B2B Partners** |
| **Tab bar** | 2 of the Settings page |
| **Priority** | P1 |

## Business Purpose

B2B partners and **their API keys** — the credentials every API test depends on. Backed by GET /registry-service/api/v1/admin/b2b-partners, this is a more direct key-management surface than the Registry Parties page. Keys cannot be displayed once issued, only rotated, so any action here is irreversible.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: Name, Type, GLN, API Key, Status, Created, Actions |
| Add Partner | Button / action | — |
| 1 | Button / action | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/admin`.
4. Click the **B2B Partners** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.
- **Credential exposure** — the API Key column must not render a complete usable key, and rotation must confirm first because it is irreversible.
- **GLN validity** — check-digit validation matters here: a bad GLN corrupts every event addressed to that party.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /registry-service/api/v1/admin/b2b-partners
```

## Notes

- Discovered live on 2026-08-31 by opening the **B2B Partners** tab on `/admin`.
- Panel scoped via the tab's `aria-controls` (`pn_id_8_tabpanel_b2b`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
