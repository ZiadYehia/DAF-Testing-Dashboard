---
title: >-
  [Audit] The GLN filters on all four audit tabs accept a GLN whose check digit is wrong and
  answer "No records match these filters", advising the user to widen the date range
status: draft
jira_key: null
reported_at: null
feature: web-audit-integrity
priority: P3 – Medium
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T05:45:00.000Z'
---
Every audit tab that filters by GLN takes `8435308300003` — thirteen digits, correct shape,
**check digit wrong** — runs the query, and reports:

**Covers test cases:** `WEB_AIN_007`, `WEB_ARE_007`, `WEB_AES_005`, `WEB_AMD_005`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local and switch the UI to EN.
3. Navigate to Reports → Audit Console (`/audit`) and select the **Integrity** tab.
4. Type `8435308300003` into the "Filter by GLN" box and press Enter.
   (`8435308300002` is the valid form of the same GLN — the last digit is the check digit.)
5. Read the table and watch the top-right corner of the page for a toast.
6. Repeat on the Regulatory events, EDA submissions and Master-data changes tabs.

---

**Expected Result:**
The filter refuses the value and says why — for example "Not a valid GLN: check digit does not match" — either inline under the field or as a toast; no lookup is issued, because the value cannot identify a party.

---

**Actual Result:**
The lookup is issued and the table shows the empty state: "No records match these filters — Records exist in this log; none of them match the filters you have applied. Widen the date range or clear a filter to see more."; no validation message appears anywhere on the page: no inline error, and no toast within 6 seconds of the query; all four tabs behave identically.

---

**Environment:**
Masar Platform
https://192.168.225.195:8444
`/audit` (Integrity, Regulatory events, EDA submissions, Master-data changes tabs)
tenant devsim
role admin (admin@devsim.local)
UI in English
Chrome 1600×1100
via Citrix VPN
host serves a self-signed certificate

---

**Priority:**
P3 – Medium

---

**Bug Type:**
Functional (Backend/API)
