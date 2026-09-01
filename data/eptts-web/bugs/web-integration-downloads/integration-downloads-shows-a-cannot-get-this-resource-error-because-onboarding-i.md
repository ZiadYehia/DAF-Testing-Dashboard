---
title: >-
  [Functional] Integration Downloads shows "Cannot GET this resource" because
  GET /registry-service/api/v1/onboarding/integration/info returns 404
status: draft
jira_key: null
reported_at: null
feature: web-integration-downloads
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-01T00:35:00.000Z'
---
Opening `/integration-downloads` renders the page but shows an error reading **"Error — Cannot
GET this resource"** at the top of the body. The cause is visible in the network log: of the
three calls the page makes, one 404s.

**Covers test cases:** `WEB_IDL_001`, `WEB_IDL_002`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open the browser devtools Network tab and filter on `registry-service`.
4. Enter https://192.168.225.195:8444/integration-downloads in the address bar.
5. Read the top of the page body, then read the network log.

---

**Expected Result:**
The page loads without an error banner; either the integration info endpoint responds, or the page handles its absence with an empty state that says what is unavailable.

---

**Actual Result:**
"Error — Cannot GET this resource" is shown in the page body; `GET /registry-service/api/v1/onboarding/integration/info` returns 404 while the page's other two calls return 200.

---

**Environment:**
Masar Platform
https://192.168.225.195:8444
tenant devsim
via Citrix VPN
Chrome (self-signed certificate)
role admin

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional (Backend/API)
