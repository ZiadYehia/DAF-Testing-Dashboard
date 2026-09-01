---
title: >-
  [Navigation] All seven collapsible sidebar groups render with no child
  items, leaving Master Data Snapshots unreachable from the menu
status: draft
jira_key: null
reported_at: null
feature: web-master-data
priority: P2 – High
bug_type: UI/UX
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
The dashboard sidebar renders seven collapsible group headers — Product Movement, Product Structure, Product Actions, File Upload, Master Data, Monitoring and Administration. Each shows a `pi-chevron-down` expander and a pointer cursor, so all seven look interactive. None of them contains a single child item: the Angular child list renders empty, so clicking a group toggles nothing, navigates nowhere, and gives no feedback.

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local and switch the UI to EN.
3. Navigate to Command Center (/dashboard) so the starting page is unambiguous.
4. Click the "Master Data" entry in the sidebar.
5. Observe the URL and the page heading.
6. Now type https://192.168.225.195:8444/master-data directly in the address bar.
7. Observe that the page exists and loads.
8. Repeat step 4 for Product Movement, Product Structure, Product Actions, File Upload and Monitoring.

---

**Expected Result:**
Clicking a collapsible group either expands to reveal its child pages, or the group is not rendered at all when it has no children; "Master Data" leads to the Master Data Snapshots page; no sidebar entry presents a pointer cursor and an expander chevron while being inert.

---

**Actual Result:**
Clicking "Master Data" leaves the URL on /dashboard with heading "Statistics" — nothing happens at all; typing /master-data directly loads "Master Data Snapshots", proving the page exists but is unreachable by navigation; the same inert behaviour occurs for all five other groups, and for Administration; inspecting the DOM shows `<div class="p-ripple nav-item"><span>Master Data</span><i class="pi pi-chevron-down"></i></div>` followed immediately by empty Angular placeholders — the child collection is empty.

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
UI/UX
