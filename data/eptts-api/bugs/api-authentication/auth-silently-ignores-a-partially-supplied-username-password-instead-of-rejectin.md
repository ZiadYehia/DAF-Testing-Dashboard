---
title: >-
  [Authentication] /auth silently ignores a partially-supplied
  username/password instead of rejecting it
status: draft
jira_key: null
reported_at: null
feature: api-authentication
priority: P3 – Medium
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
`POST /auth` supports an optional legacy username/password body alongside the mandatory `apikey` header. When both credential fields are present and non-empty they are validated correctly — a wrong pair returns 401. But when **either field is empty, null, or absent, the credential check is skipped entirely** and the key alone authenticates with 200.

**Covers test cases:** `TC_AUTH_007`, `TC_AUTH_008`, `TC_AUTH_009`, `TC_AUTH_010`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. POST https://192.168.225.195:8445/registry-service/api/v1/auth with header apikey: <valid manufacturer key> and body {"username":"x@y.invalid","password":"wrong"}. Observe 401.
3. Repeat with body {"username":"","password":"x"}. Observe the status.
4. Repeat with body {"username":"x@y.invalid","password":""}.
5. Repeat with body {"username":"x@y.invalid"} (password omitted).
6. Repeat with body {"username":null,"password":null}.

---

**Expected Result:**
A partially-supplied credential pair is rejected with 400, rather than being silently discarded.

---

**Actual Result:**
All four partial-credential variants return 200 with a valid access token; only a fully-supplied, incorrect pair returns 401.

---

**Environment:**
Masar B2B API via Citrix VPN
POST https://192.168.225.195:8445/registry-service/api/v1/auth
Tenant: devsim, manufacturer API key

---

**Priority:**
P3 – Medium

---

**Bug Type:**
Functional (Backend/API)
