---
title: >-
  Branch user sees Distributor's incoming invoices instead of their own when
  attempting to receive a shipment
status: reported
jira_key: DW-888
reported_at: '2026-07-19T11:25:09.099Z'
feature: branch-receive-shipment
priority: P1 – Critical
bug_type: Functional
parent_key: null
severity: ''
layer: backend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
## Summary
When a Branch user attempts to receive a shipment by accessing the 'Incoming Invoices' list, the application incorrectly displays invoices associated with the Distributor entity to which the branch belongs, rather than showing only the invoices specifically destined for the logged-in Branch entity. This prevents the Branch from seeing and processing its own legitimate incoming shipments.

---

**Steps to Reproduce:**
1. Log in to EPTTS Mobile as a Branch user (e.g., testbranch@eptts.com).
2. From the Branch home screen, tap the 'Receive Shipment' tile.
3. Observe the list of 'Incoming Invoices' displayed.

---

**Expected Result:**
The 'Incoming Invoices' list should display only those invoices that are destined for the logged-in Branch's GLN entity.

---

**Actual Result:**
The 'Incoming Invoices' list displays invoices that are destined for the Distributor entity associated with the logged-in Branch, not the Branch's own invoices.

---

**Environment:**
Browser: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Environment: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app, no web environment/URL
Role/Account: Branch (testbranch@eptts.com)
Network state: Online

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional
