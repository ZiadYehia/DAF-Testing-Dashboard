---
title: >-
  [Navigation] Eight of the fifteen /admin tabs exist in the DOM with full
  content but are never rendered, so they cannot be reached
status: draft
jira_key: null
reported_at: null
feature: web-settings-admin
priority: P1 – Critical
bug_type: UI/UX
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T03:05:00.000Z'
---
`/admin` builds **fifteen** tabs across five PrimeNG tab bars, but only the **first bar** is
ever painted. The page ends after the Government table and its pagination — there is no
second, third, fourth or fifth tab bar anywhere on the screen, at any scroll position.

| Tab bar | Tabs | Rendered? |
|---|---|---|
| `pn_id_4` | Government, Manufacturer, Distributor, Dispenser, System, Platform, System Configuration | **yes** |
| `pn_id_7` | Pharmacies, Pharmacy Admins | no |
| `pn_id_8` | POS Partners, B2B Partners | no |
| `pn_id_9` | Platform Staff, User Locks | no |
| `pn_id_10` | System Configuration, Geography | no |

**The hidden tabs are fully built, not empty.** Querying their panels directly returns real
content — B2B Partners has an "Add Partner" button and columns Name / Type / GLN / API Key /
Status / Created / Actions; User Locks has a Refresh button, columns Email / Entity / Role /
Lock Status / Actions, and actual rows (`e2emasrya2@masar.com`, `e2ejanssen2@masar.com`, …).
So the data loads and the components render; they are simply given no box.

Measured on the panel: `display: inline`, height 0, width 0 — and its parent `.p-tabpanels`
container is also height 0. Clicking a hidden tab through the DOM *does* flip its
`aria-selected` to `true`, which confirms the tab components are live and it is the layout,
not the state, that is broken.

Why this is P1: these are not cosmetic screens. **B2B Partners is where a partner's API keys
are managed** — the same keys the entire B2B integration authenticates with. **User Locks**
controls account lockout. **Platform Staff** and **Pharmacy Admins** manage privileged
accounts. Eight administrative capabilities are unreachable through the product, and because
the markup exists an automated check that reads text rather than pixels would report them as
present.

**Related** to the already-filed *"All seven collapsible sidebar groups render with no child
items"* bug: same shape — parts of the app are built but cannot be reached. Two independent
instances suggests a layout or feature-flag problem broader than either page, and worth
looking at together.
---
**Covers test cases:** `WEB_SBP_001`, `WEB_SUL_001`

**Steps to Reproduce:**
1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local and switch the UI to EN.
3. Navigate to Administration → Settings (`/admin`).
4. Scroll to the bottom of the page.
5. Count the tab bars, then compare against
   `document.querySelectorAll('[role="tab"]').length` in the console.
---
**Expected Result:**
1. Every tab the page defines is reachable — either all five bars are rendered, or the tabs
   are consolidated into one bar.
2. B2B Partners, User Locks, Platform Staff, Pharmacies, Pharmacy Admins, POS Partners,
   Geography and the second System Configuration can each be opened and used.
---
**Actual Result:**
1. Only the first tab bar (7 tabs) is painted; the page ends after its table.
2. `document.querySelectorAll('[role="tab"]').length` returns **15**.
3. The eight unrendered panels measure 0 × 0 with `display: inline`, inside a `.p-tabpanels`
   parent that is also zero-height, despite containing loaded data.
---
**Environment:** Masar Platform · https://192.168.225.195:8444 · tenant devsim · via Citrix VPN
· Chrome 1600×1100 · role admin · UI in English

**Evidence:** `admin-shows-only-the-first-tab-bar.jpg` — full-page capture taken *after*
programmatically selecting the "User Locks" tab. The tab reports `aria-selected=true`, yet
neither it nor its bar appears anywhere on the page.

**Note on the duplicate label:** "System Configuration" is used by two different tabs
(`pn_id_4_tabpanel_settings` and `pn_id_10_tabpanel_system`). Whatever the layout fix, those
two need distinguishable names or one of them cannot be referred to unambiguously — by a user
or by a test.

---
**Priority:**
P1 – Critical
---
**Bug Type:**
UI/UX
