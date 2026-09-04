---
title: >-
  [Announcements] The status filter and the create dialog's Category dropdown
  render raw snake_case enum keys instead of display labels
status: draft
jira_key: null
reported_at: null
feature: web-announcements
priority: P3 – Medium
bug_type: UI/UX
parent_key: null
severity: ''
layer: frontend
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T12:46:00.000Z'
---
Two dropdowns expose the API's enum values directly to the user. The status filter offers `draft`, `pending_review`, `approved`, `scheduled`, `published`, `expired` and `archived`, and the Category dropdown in the New Announcement dialog offers `regulatory`, `system`, `integration`, `maintenance`, `training`, `deadlines` and `user_guides`. The same values are rendered correctly as `Published`, `Draft`, `User Guides` and so on in the table body and on the Information Center, so the translation exists and these two controls simply do not use it. The inconsistency is most visible on `pending_review` and `user_guides`, which read as identifiers rather than words.

**Covers test cases:** `WEB_ANN_015`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open https://192.168.225.195:8444/admin/announcements.
4. Click the status filter dropdown and read its options.
5. Compare them against the STATUS column rendered in the table body.
6. Close the dropdown and click New Announcement.
7. Click the Category dropdown and read its options.
8. Compare them against the CATEGORY column rendered in the table body.

---

**Expected Result:**
Every dropdown option is rendered as a display label, matching the wording already used in the table body.

---

**Actual Result:**
The status filter lists draft, pending_review, approved, scheduled, published, expired and archived, and the Category dropdown lists user_guides and its siblings, while the same values render as Published and User Guides in the table body.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Page: /admin/announcements
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P3 – Medium

---

**Bug Type:**
UI/UX
