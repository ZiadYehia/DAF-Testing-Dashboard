---
title: >-
  [Announcements] A published announcement with no saved audience is delivered
  to nobody, while the Audience dialog shows "Target all users" as selected
status: draft
jira_key: null
reported_at: null
feature: web-announcements
priority: P2 – High
bug_type: Functional
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T12:40:00.000Z'
---
Publishing an announcement does not write an audience row, and nothing in the workflow requires one. An announcement can be created, submitted, approved and shown as **Published** while `GET /admin/information-center/announcements/{id}/targets` returns `[]`, in which case no user ever sees it on the Information Center. The Audience dialog compounds this by rendering "Target all users" as already switched on even when no target exists, so the administrator is actively told the announcement reaches everyone when it reaches no one. Proven by controlled experiment: `QA-20260902-TRN-002` was invisible while its targets were empty and appeared immediately after clicking Save Audience, with no other change.

**Covers test cases:** `WEB_ANN_010`, `WEB_ANN_011`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open https://192.168.225.195:8444/admin/announcements.
4. Click New Announcement and fill Title, Summary and Body in both Arabic and English.
5. Click Create, then the submit-for-review action, then the approve action, so the row reads Published.
6. Do not open the Audience dialog and do not click Save Audience.
7. Open https://192.168.225.195:8444/information-center and search for the new announcement.
8. Return to /admin/announcements, click the audience action on that row, and observe the "Target all users" switch.

---

**Expected Result:**
An announcement that reaches the Published state is delivered to at least one reader, and the Audience dialog reflects the audience actually stored.

---

**Actual Result:**
The announcement reads Published in the admin table but never appears on the Information Center for any role, while the Audience dialog shows "Target all users" switched on despite the targets endpoint returning `[]`.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Endpoints: GET/POST /masar-service/api/v1/admin/information-center/announcements/{id}/targets
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional
