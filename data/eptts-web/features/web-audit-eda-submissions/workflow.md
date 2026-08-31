# Audit Console — EDA submissions — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Audit Console — EDA submissions |
| **Slug** | `web-audit-eda-submissions` |
| **Feature ID** | `EPTTS_WEB_25` |
| **Module** | Platform Dashboard |
| **Route** | `/audit` → tab **EDA submissions** |
| **Tab bar** | 0 of the Audit Console page |
| **Priority** | P1 |

## Business Purpose

Submissions to EDA (the regulator), with pending and overdue lists and accepted/rejected counts. An overdue submission is a compliance exposure with a deadline, so the overdue calculation matters as much as the list itself.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Table | Table | columns: SUBMITTED, STATUS, TRANSACTION, ENTITY GLN, INVOICE, DAWANA REF., ACCEPTED / REJECTED / TOTAL, RESPONSE, ACTIONS |
| What is not recorded? | Button / action | — |
| View pending | Button / action | — |
| View overdue | Button / action | — |
| 13-digit GLN | input[text] | 13-digit GLN |
| (unlabelled) | input[text] | — |
| (unlabelled) | input[text] | — |
| (unlabelled) | input[text] | — |
| (unlabelled) | input[text] | — |

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).
3. Navigate to `/audit`.
4. Click the **EDA submissions** tab.
5. The tab becomes selected and loads its own content and table.

## Edge Cases & Validation Rules

- **Tab isolation** — switching to this tab must not leave the previous tab's rows on screen.
- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.
- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.
- **GLN validity** — check-digit validation matters here: a bad GLN corrupts every event addressed to that party.

## API calls observed

Captured while opening this tab, so this is what it actually depends on:

```
GET /masar-service/api/v1/audit/eda-submissions/pending/list
GET /masar-service/api/v1/audit/eda-submissions/overdue/list
GET /masar-service/api/v1/audit/eda-submissions/statistics/summary
GET /masar-service/api/v1/audit/eda-submissions?limit=25&page=1&sortBy=submittedAt&sortOrder=DESC
```

## Notes

- Discovered live on 2026-08-31 by opening the **EDA submissions** tab on `/audit`.
- Panel scoped via the tab's `aria-controls` (`pn_id_4_tabpanel_eda`), so the elements above belong to this tab and not a sibling.
- Test cases are all `Under Testing` — none has been executed.
