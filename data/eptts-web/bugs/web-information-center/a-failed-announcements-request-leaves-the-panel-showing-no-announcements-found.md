---
title: >-
  [Information Center] A failed announcements request leaves the panel showing
  "No announcements found" once the error toast auto-dismisses
status: draft
jira_key: null
reported_at: null
feature: web-information-center
priority: P3 – Medium
bug_type: UI/UX
parent_key: null
severity: ''
layer: frontend
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T11:55:00.000Z'
---
When `GET /masar-service/api/v1/information-center/announcements` fails, the Latest Updates panel renders its empty state, "No announcements found". A generic toast reading "Error — An error occurred" does appear, but it auto-dismisses after roughly fifteen seconds and names neither the panel nor the request that failed. From then on a backend outage is visually identical to a notice board that genuinely has no announcements, so a user who arrives a few seconds late, or who looks away, is told there is no news when in fact the platform could not load it.

**Covers test cases:** `WEB_INF_028`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open the browser developer tools and block the request pattern `**/information-center/announcements*` for the unfiltered list call.
4. Enter https://192.168.225.195:8444/information-center in the address bar.
5. Observe the toast in the top-right and the Latest Updates panel three seconds after load.
6. Observe the same two areas again seventeen seconds after load.

---

**Expected Result:**
The Latest Updates panel displays a persistent error state that distinguishes a failed request from an empty result set.

---

**Actual Result:**
The panel displays "No announcements found" and the only signal of failure is a generic "Error — An error occurred" toast that disappears between t+9s and t+17s, leaving the failure indistinguishable from having no announcements.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Endpoint: GET /masar-service/api/v1/information-center/announcements
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P3 – Medium

---

**Bug Type:**
UI/UX
