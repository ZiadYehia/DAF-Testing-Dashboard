# Audit Console — Regulatory events — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Audit Console — Regulatory events |
| **Slug** | `web-audit-regulatory-events` |
| **Feature ID** | `EPTTS_WEB_24` |
| **Module** | Platform Dashboard |
| **Route** | `/audit` → tab **Regulatory events** |
| **Tab bar** | 0 of the Audit Console page |
| **Priority** | P1 |

## Business Purpose

The primary regulatory audit trail — event time, type, category, severity, actor and entity GLN. This is the evidence record: it must be complete and attributable, and the highest-value test is that an action taken through the API actually appears here.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: EVENT TIME, EVENT TYPE, CATEGORY, SEVERITY, ACTOR, ENTITY GLN, DESCRIPTION |
| What is not recorded? | Button / action | — |
| 1 | Button / action | — |
| 2 | Button / action | — |
| 3 | Button / action | — |
| 4 | Button / action | — |
| 5 | Button / action | — |
| 13-digit GLN | input[text] | 13-digit GLN |
| Pack serial identifier | input[text] | Pack serial identifier |
| Date From | input[text] | Date From |
| Date To | input[text] | Date To |
| Search descriptions | input[text] | Search descriptions |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/audit`.
4. Click the **Regulatory events** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.
- **GLN validity** — check-digit validation matters here: a bad GLN corrupts every event addressed to that party.

## Notes

- Discovered live on 2026-08-31 by opening the **Regulatory events** tab on `/audit`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_regulatory`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
