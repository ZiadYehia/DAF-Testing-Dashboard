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

For six of the seven this only advertises features that are not there. For **Master Data** it hides a page that genuinely exists: `/master-data` ("Master Data Snapshots") loads and works when the URL is typed directly, but there is no way to reach it by clicking. Only 8 of the sidebar's entries are real `<a href>` links.

This is role-independent — both admin and manufacturer show the same seven empty groups, so it is not permission filtering removing children for one role.
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
1. Clicking a collapsible group either expands to reveal its child pages, or the group is not rendered at all when it has no children.
2. "Master Data" leads to the Master Data Snapshots page.
3. No sidebar entry presents a pointer cursor and an expander chevron while being inert.
---
**Actual Result:**
1. Clicking "Master Data" leaves the URL on /dashboard with heading "Statistics" — nothing happens at all.
2. Typing /master-data directly loads "Master Data Snapshots", proving the page exists but is unreachable by navigation.
3. The same inert behaviour occurs for all five other groups, and for Administration.
4. Inspecting the DOM shows `<div class="p-ripple nav-item"><span>Master Data</span><i class="pi pi-chevron-down"></i></div>` followed immediately by empty Angular placeholders — the child collection is empty.
---
**Environment:**
- Platform: Web (Chromium 149) via Citrix VPN
- Dashboard: https://192.168.225.195:8444 (Angular SPA, Keycloak OIDC realm `masar`)
- Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
- TLS: self-signed certificate (clients must ignore certificate errors)
---
**Priority:**
P2 – High
---
**Bug Type:**
UI/UX
---
**Notes:**
Attached `nav-master-data.webm` shows the Master Data click doing nothing and then the page loading by URL. `nav-dead-entries.webm` shows the same for the other five groups. Screenshots capture each state.

Verification note: an earlier reading of this as "broken links" was wrong — these are group headers, and correct behaviour for a group header is to expand rather than navigate. The defect is that the groups are **empty**, not that they fail to navigate.
