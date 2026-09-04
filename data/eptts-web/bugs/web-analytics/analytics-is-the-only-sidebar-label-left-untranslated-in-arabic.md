---
title: >-
  [Analytics] "Analytics" is the only sidebar label that stays in English when
  the interface is switched to Arabic
status: draft
jira_key: null
reported_at: null
feature: web-analytics
priority: P3 – Medium
bug_type: UI/UX
parent_key: null
severity: ''
layer: frontend
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T12:58:00.000Z'
---
The dashboard defaults to Arabic and switching languages translates the whole shell, but the Analytics entry is missing its translation. With every sidebar group expanded as Platform Admin in Arabic, 36 of the 37 navigation labels render in Arabic and only `/analytics` renders as the Latin string "Analytics". It sits between التقارير and المخالفات inside the REPORTS group, so the untranslated label is directly beside translated siblings and reads as a missing i18n key rather than a deliberate product name.

**Covers test cases:** `WEB_ANL_009`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Confirm the interface is in Arabic, or click the AR toggle in the page header.
4. Expand every collapsible group in the left sidebar.
5. Read every navigation label from top to bottom.
6. Locate the REPORTS group and read the third entry.

---

**Expected Result:**
Every sidebar label is rendered in Arabic when the interface language is Arabic.

---

**Actual Result:**
The entry for /analytics renders as the English string "Analytics" while the other 36 labels, including its immediate siblings التقارير and المخالفات, are translated.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, ngx-translate, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Interface language: Arabic (html lang=ar, dir=rtl)
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P3 – Medium

---

**Bug Type:**
UI/UX
