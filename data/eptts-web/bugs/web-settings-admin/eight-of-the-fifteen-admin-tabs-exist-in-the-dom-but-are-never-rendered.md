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

**Covers test cases:** `WEB_SBP_001`, `WEB_SBP_002`, `WEB_SBP_003`, `WEB_SBP_007`, `WEB_SGE_001`, `WEB_SGE_002`, `WEB_SGE_003`, `WEB_SPA_001`, `WEB_SPA_002`, `WEB_SPA_003`, `WEB_SPA_005`, `WEB_SPA_007`, `WEB_SUL_001`, `WEB_SUL_002`, `WEB_SUL_003`, `WEB_SUL_005`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local and switch the UI to EN.
3. Navigate to Administration → Settings (`/admin`).
4. Scroll to the bottom of the page.
5. Count the tab bars, then compare against
   `document.querySelectorAll('[role="tab"]').length` in the console.

---

**Expected Result:**
Every tab the page defines is reachable — either all five bars are rendered, or the tabs are consolidated into one bar; b2B Partners, User Locks, Platform Staff, Pharmacies, Pharmacy Admins, POS Partners, Geography and the second System Configuration can each be opened and used.

---

**Actual Result:**
Only the first tab bar (7 tabs) is painted; the page ends after its table; `document.querySelectorAll('[role="tab"]').length` returns **15**; the eight unrendered panels measure 0 × 0 with `display: inline`, inside a `.p-tabpanels` parent that is also zero-height, despite containing loaded data.

---

**Environment:**
Masar Platform
https://192.168.225.195:8444
tenant devsim
via Citrix VPN
Chrome 1600×1100
role admin
UI in English

---

**Priority:**
P1 – Critical

---

**Bug Type:**
UI/UX
