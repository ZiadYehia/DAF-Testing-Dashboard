---
title: >-
  [i18n] Shipping page shows the raw translation key "shipments.bulkUpload"
  instead of a button label, in both English and Arabic
status: draft
jira_key: null
reported_at: null
feature: web-shipping
priority: P3 – Medium
bug_type: UI/UX
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T00:30:00.000Z'
---
The Shipping page (`/shipments`) renders a button whose visible text is the literal
translation key **`shipments.bulkUpload`** rather than a human label. Its three siblings on the
same page — "View History", "Start Invoice" and the language toggle — all render correctly, so
this is a single missing entry in the translation catalogue rather than a broken i18n setup.

**Covers test case:** `WEB_SHP_001`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Navigate to Product Movement → Shipping (or enter /shipments directly).
4. Read the labels of the buttons in the page header area.
5. Click the language toggle to switch to the other locale and read them again.

---

**Expected Result:**
The button shows a human-readable label describing the action, e.g. "Bulk Upload"; the label is present in both Arabic and English.

---

**Actual Result:**
The button's text is the literal key `shipments.bulkUpload`; the key is unresolved in both locales — switching EN/AR does not change it.

---

**Environment:**
Masar Platform
https://192.168.225.195:8444
tenant devsim
via Citrix VPN
Chrome (self-signed certificate)

---

**Priority:**
P3 – Medium

---

**Bug Type:**
UI/UX
