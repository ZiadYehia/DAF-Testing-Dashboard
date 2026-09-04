---
title: >-
  [Announcements] A date typed into a datepicker is displayed in the field but
  saved as null, with no validation message
status: draft
jira_key: null
reported_at: null
feature: web-announcements
priority: P3 – Medium
bug_type: Functional
parent_key: null
severity: ''
layer: frontend
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T12:44:00.000Z'
---
The four date fields in the New Announcement dialog accept typed input and display it, but only a value chosen from the calendar overlay is bound to the model. Typing `09/30/2026` into Event Date leaves that text visible in the input right up to submission, yet the created record carries `eventDate: null`. Nothing marks the field invalid and nothing warns on submit, so the administrator believes a date was set. For Event Date the visible consequence is that the announcement never appears in the Information Center's Upcoming Dates panel.

**Covers test cases:** `WEB_ANN_014`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open https://192.168.225.195:8444/admin/announcements and click New Announcement.
4. Fill Title, Summary and Body in both Arabic and English so Create becomes enabled.
5. Click the Event Date field and type 09/30/2026 on the keyboard.
6. Observe that the field displays 09/30/2026.
7. Press Escape to dismiss the calendar overlay and observe the field still displays 09/30/2026.
8. Click Create, then reopen the new announcement with the pencil action and observe the Event Date field.

---

**Expected Result:**
The date shown in the field is the date that is saved, or a validation message explains why the typed value was rejected.

---

**Actual Result:**
The field displays 09/30/2026 through to submission but the saved record carries eventDate null and the reopened dialog shows an empty Event Date, with no validation message at any point.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG p-datepicker, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Endpoint: POST /masar-service/api/v1/admin/information-center/announcements
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P3 – Medium

---

**Bug Type:**
Functional
