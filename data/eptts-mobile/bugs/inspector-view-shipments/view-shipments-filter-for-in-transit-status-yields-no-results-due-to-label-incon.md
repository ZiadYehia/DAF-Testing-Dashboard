---
title: >-
  View Shipments filter for 'In Transit' status yields no results due to label
  inconsistency with Masar backend
status: reported
jira_key: DW-883
reported_at: '2026-07-19T09:10:08.422Z'
feature: inspector-view-shipments
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: backend
jira_status: READY
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
The EPTTS Mobile application's 'View Shipments' module exhibits an inconsistency in shipment status labeling when compared to the Masar backend dashboard. Specifically, shipments that are recorded as 'In Transit' in Masar are displayed with a 'Dispatched' status within the EPTTS Mobile app. This discrepancy prevents users from effectively filtering shipments by their 'In Transit' status, as applying such a filter yields no results. This issue impacts the accuracy of shipment tracking and data visibility for users.

---

**Steps to Reproduce:**
1. Log in as an Inspector (using testinspector@eptts.com).
2. Navigate to the 'View Shipments' tile from the home screen.
3. Observe the list of shipments and their displayed statuses. Note that shipments which are 'In Transit' in the Masar dashboard are displayed as 'Dispatched' in the EPTTS Mobile app.
4. Tap on the filter option (if available) or navigate to the filter section for shipment status.
5. Select 'In Transit' as the desired filter status and apply.

---

**Expected Result:**
When the 'In Transit' filter is applied, the EPTTS Mobile app should display all shipments that are currently 'In Transit' according to the Masar backend, with their status accurately reflected in the app's UI.

---

**Actual Result:**
Shipments that are 'In Transit' in the Masar dashboard are incorrectly labeled as 'Dispatched' in the EPTTS Mobile 'View Shipments' list. When the 'In Transit' filter is applied, no shipments are retrieved or displayed.

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Environment: EPTTS Mobile (com.daf.eda.eptts) - STAGE
Role/Account: Inspector (testinspector@eptts.com)
Network state: Online

---

**Priority:** P2 – High

---

**Bug Type:** Functional (Backend/API)
