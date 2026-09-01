---
title: >-
  [Master Data] Master Data Snapshots page shows a "Cannot GET this resource"
  error toast on load
status: draft
jira_key: null
reported_at: null
feature: web-master-data
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
Opening `/master-data` renders the Master Data Snapshots page but immediately raises a red error toast reading **"Error — Cannot GET this resource"**. The page body still renders its shell (Latest version, Last generated, Auto-scheduler, Total stored) but every value is empty (`—`, `OFF`, `0 B`) and the Versions table reports "0 most recent".

**Covers test cases:** `WEB_MDT_001`, `WEB_MDT_002`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Enter https://192.168.225.195:8444/master-data in the address bar.
4. Observe the top-right of the page immediately after load.
5. Observe the four summary tiles and the Versions table.

---

**Expected Result:**
The page loads without an error toast and displays the current snapshot state, or shows a clear empty state when no snapshot has been generated.

---

**Actual Result:**
A red toast "Error — Cannot GET this resource" appears on load; all four summary tiles are empty (—, —, OFF, 0 B) and the Versions table shows 0 records; it cannot be distinguished from the UI whether no snapshot exists or the request simply failed.

---

**Environment:**
Platform: Web (Chromium 149) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional (Backend/API)
