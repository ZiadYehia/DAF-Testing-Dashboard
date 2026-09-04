---
title: >-
  [Announcements] Editing a published announcement fails with HTTP 400 and the
  UI shows no error at all
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
found_at: '2026-09-02T12:42:00.000Z'
---
The backend correctly refuses to edit a published announcement, answering `PATCH /admin/information-center/announcements/{id}` with a clear 400: "Announcement must be in 'draft' status to edit freely. Current: published. Editing a published announcement requires the unpublish action (creates a new version, requires re-approval)." The UI offers the edit action on a published row regardless, accepts every keystroke, and then swallows the refusal — no toast, no inline error, no field highlight. The dialog simply stays open with the edited values still in it, so the administrator has no way to tell whether the change saved.

**Covers test cases:** `WEB_ANN_012`, `WEB_ANN_013`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open https://192.168.225.195:8444/admin/announcements.
4. Locate an announcement whose status reads Published.
5. Click the pencil action on that row.
6. Change the Title (English) field to any new value.
7. Click Update.
8. Watch the dialog, the toast area and the table row for ten seconds.

---

**Expected Result:**
The reason the update was refused is displayed to the user, naming the rule that blocked it.

---

**Actual Result:**
The PATCH returns 400 but the UI shows no toast, no inline error and no field highlight; the dialog stays open with the edited values and the row is unchanged.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Endpoint: PATCH /masar-service/api/v1/admin/information-center/announcements/{id}
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P3 – Medium

---

**Bug Type:**
UI/UX
