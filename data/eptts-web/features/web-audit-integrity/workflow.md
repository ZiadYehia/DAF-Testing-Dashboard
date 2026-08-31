# Audit Console — Integrity — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Audit Console — Integrity |
| **Slug** | `web-audit-integrity` |
| **Feature ID** | `EPTTS_WEB_27` |
| **Module** | Platform Dashboard |
| **Route** | `/audit` → tab **Integrity** |
| **Tab bar** | 0 of the Audit Console page |
| **Priority** | P1 |

## Business Purpose

Hash-chain verification per GLN, with a verdict and last-verified time. This is the tamper-evidence mechanism for the whole audit trail: if the chain cannot be verified, nothing else in the audit console can be relied on.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: GLN, EVENTS, FIRST EVENT, LAST EVENT, LAST VERIFIED, VERDICT, ACTIONS |
| Export CSV | Button / action | — |
| Verify | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| 4 | Button / action | — |
| 5 | Button / action | — |
| Filter by GLN | input[text] | Filter by GLN |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/audit`.
4. Click the **Integrity** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.
- **GLN validity** — check-digit validation matters here: a bad GLN corrupts every event addressed to that party.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /masar-service/api/v1/audit/dashboard
GET /masar-service/api/v1/audit/hash-chain/status
```

## Notes

- Discovered live on 2026-08-31 by opening the **Integrity** tab on `/audit`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_integrity`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
