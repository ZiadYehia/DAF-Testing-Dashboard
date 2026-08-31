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

**It is missing from BOTH locales.** The dashboard defaults to Arabic and has an EN/AR toggle;
the key appears unresolved in Arabic *and* in English. That rules out the common case of one
locale lagging behind the other, and points at the key never having been added to either
catalogue — most likely a button shipped after its strings.

Why it matters more than a cosmetic label: this is the entry point to bulk shipping upload on a
P1 custody-transfer page. A user cannot tell what the button does, and "bulkUpload" is a
destructive-adjacent action (it submits shipping events for many packs at once). An operator
guessing at an unlabelled control on the shipping screen is a real risk, not a polish issue.

Found during a systematic sidebar discovery pass, not while testing this page specifically —
so it is worth checking whether other recently-added controls have the same gap.
---
**Steps to Reproduce:**
1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Navigate to Product Movement → Shipping (or enter /shipments directly).
4. Read the labels of the buttons in the page header area.
5. Click the language toggle to switch to the other locale and read them again.
---
**Expected Result:**
1. The button shows a human-readable label describing the action, e.g. "Bulk Upload".
2. The label is present in both Arabic and English.
---
**Actual Result:**
1. The button's text is the literal key `shipments.bulkUpload`.
2. The key is unresolved in both locales — switching EN/AR does not change it.
---
**Environment:** Masar Platform · https://192.168.225.195:8444 · tenant devsim · via Citrix VPN
· Chrome (self-signed certificate)

**Evidence:** `data/eptts-web/features/web-shipping/screenshots/web-shipping.jpg` — captured
with the UI in English, showing the unresolved key in the button row.
