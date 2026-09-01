---
title: >-
  [BLOCKER][Administration] Admin password reset returns 503 "Could not update
  the password in Keycloak"
status: draft
jira_key: null
reported_at: null
feature: web-settings-admin
priority: P1 – Critical
bug_type: Functional / Integration
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
An administrator cannot reset any user's password. `PUT /users/{id}/password` returns **503** with:

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Log in to https://192.168.225.195:8444 as admin@devsim.local and capture the bearer token.
3. GET /masar-service/api/v1/users?limit=100&roles=distributor and note the id for distributor@devsim.local.
4. PUT https://192.168.225.195:8445/registry-service/api/v1/users/{id}/password with body {"password":"<a policy-compliant password>"} and the admin bearer token.
5. Observe the response.
6. Repeat for pharmacy@devsim.local.

---

**Expected Result:**
The password is updated in Keycloak and the user can log in with the new password (HTTP 200/204).

---

**Actual Result:**
HTTP 503 with "Could not update the password in Keycloak — no change was made"; reproducible for both users tested; the password is unchanged and the old one still works.

---

**Environment:**
Masar Registry / Platform API via Citrix VPN
PUT https://192.168.225.195:8445/registry-service/api/v1/users/{id}/password
Auth: admin@devsim.local dashboard bearer token (role admin)
Tenant: devsim

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional / Integration
