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

| Body | Result |
|---|---|
| `{username: "x", password: "wrong"}` | 401 — correct |
| `{username: "", password: "x"}` | **200** |
| `{username: "x", password: ""}` | **200** |
| `{username: "x"}` (no password) | **200** |
| `{username: null, password: null}` | **200** |

This is a validation gap, not an authorization hole: a valid API key remains mandatory and no credential pair can substitute for one, so access is never widened. The risk is that it **hides client bugs** — an integrator whose code fails to populate the password field gets a 200 and believes it authenticated with credentials when it did not.

The source suite expected 400 for these four cases (TC_AUTH_007–TC_AUTH_010).
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
1. A partially-supplied credential pair is rejected with 400, rather than being silently discarded.
---
**Actual Result:**
1. All four partial-credential variants return 200 with a valid access token.
2. Only a fully-supplied, incorrect pair returns 401.
---
**Environment:**
- Masar B2B API via Citrix VPN
- POST https://192.168.225.195:8445/registry-service/api/v1/auth
- Tenant: devsim, manufacturer API key
---
**Priority:**
P3 – Medium
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
**Exchange evidence:** `1-exchange-tc_auth_007.jpg`, `2-exchange-tc_auth_008.jpg`, `3-exchange-tc_auth_009.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`. The same shape repeats for `TC_AUTH_010`.

**Covers test cases:** `TC_AUTH_007`, `TC_AUTH_008`, `TC_AUTH_009`, `TC_AUTH_010`

Covered by `TC_AUTH_007`–`TC_AUTH_010` in `automation-hub/projects/eptts-api-authentication/`, which assert the real behaviour and name the divergence from the sheet's expectation so a fix surfaces as a test update.

Related documentation point: the vendor Postman collection and the source spreadsheet both describe /auth as username/password based and located on masar-service. It is apikey-first and lives on registry-service; masar-service/auth is a 404.
