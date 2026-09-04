---
title: >-
  [Navigation] The Pharmacy role is shown an Administration sidebar group
  header that expands to nothing
status: draft
jira_key: null
reported_at: null
feature: web-settings-admin
priority: P3 – Medium
bug_type: UI/UX
parent_key: null
severity: ''
layer: frontend
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T12:57:00.000Z'
---
A Pharmacy user has no administration rights and correctly gets no `/admin` entry, but the ADMINISTRATION group header is still rendered at the foot of the sidebar with a chevron and a pointer cursor. Clicking it four times in a clean session adds no child items. The permission filter is evidently applied to the group's children but not to the group itself, so the role is shown a control that advertises functionality it can never reach. Every other group in the Pharmacy sidebar expands normally, which makes this one look broken rather than restricted.

**Covers test cases:** `WEB_SET_011`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in with the Pharmacy credentials held in EPTTS_EF_PHARMACY_USERNAME and EPTTS_EF_PHARMACY_PASSWORD.
3. Accept the production-access disclaimer.
4. Scroll to the foot of the left sidebar.
5. Observe that an ADMINISTRATION group header is rendered with a chevron.
6. Click the Administration header and count the child items that appear.
7. Click it three more times and count again.

---

**Expected Result:**
A group header is not rendered for a role that has no pages within that group.

---

**Actual Result:**
The ADMINISTRATION header renders with a chevron and pointer cursor for the Pharmacy role and adds no child items across four clicks.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as the Pharmacy role (EFinance E2E-Pharmacy, GLN 6220000000013)
Page: any authenticated route; observed on /scanning and /information-center
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P3 – Medium

---

**Bug Type:**
UI/UX
