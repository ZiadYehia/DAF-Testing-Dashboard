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

```
GET 200  /masar-service/api/v1/users/me
GET 404  https://192.168.225.195:8445/registry-service/api/v1/onboarding/integration/info
GET 200  https://192.168.225.195:8445/registry-service/api/v1/admin/integration-downloads/postman/info
```

The page's own content still loads — the Postman Collection and Latest Master Data Snapshot
sections render, along with their Upload / Download / Manage versions / Download Latest
actions. So the failure is **partial**: the page is usable but shows a raw backend error the
user can neither act on nor dismiss meaningfully. Note the sibling endpoint on the same service
(`admin/integration-downloads/postman/info`) answers 200, so registry-service itself is healthy
and reachable — it is this one path that does not exist.

Why P2 rather than cosmetic: this page is how an integrating partner obtains the Postman
collection and the master-data snapshot. An unexplained error banner on the onboarding page is
the first thing a new integrator sees, and it gives them no way to know whether what they just
downloaded is complete.

**Related but distinct** from the `/master-data` bug ("Master Data Snapshots page shows a Cannot
GET this resource error toast on load"): same symptom string and the same underlying pattern —
a page calling an endpoint that does not exist — but a different page and a different missing
path, so they need separate fixes. Worth checking whether other pages call endpoints from a
stale API map; two instances of one pattern suggests more.
---
**Steps to Reproduce:**
1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open the browser devtools Network tab and filter on `registry-service`.
4. Enter https://192.168.225.195:8444/integration-downloads in the address bar.
5. Read the top of the page body, then read the network log.
---
**Expected Result:**
1. The page loads without an error banner.
2. Either the integration info endpoint responds, or the page handles its absence with an empty
   state that says what is unavailable.
---
**Actual Result:**
1. "Error — Cannot GET this resource" is shown in the page body.
2. `GET /registry-service/api/v1/onboarding/integration/info` returns 404 while the page's other
   two calls return 200.
---
**Environment:**
- Masar Platform
- https://192.168.225.195:8444
- tenant devsim
- via Citrix VPN
- Chrome (self-signed certificate)
- role admin

**Evidence:**
`data/eptts-web/features/web-integration-downloads/screenshots/web-integration-downloads.jpg`
— full-page capture showing the error banner above the loaded content.

---
**Priority:**
P2 – High
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
**Covers test cases:** `WEB_IDL_001`, `WEB_IDL_002`

`WEB_IDL_002` reloads the route rather than opening it fresh; the error banner is present
either way, so both fail on this one defect.
