---
title: >-
  Branch 'Receive Shipment' screen lacks search and filter options for invoice
  number, SSCC, and GLN
status: reported
jira_key: DW-854
reported_at: '2026-07-13T09:19:58.013Z'
feature: branch-receive-shipment
priority: P2 – High
bug_type: Functional
parent_key: null
severity: ''
layer: frontend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
### Summary
The 'Receive Shipment' screen for Branch users currently displays a list of 'Incoming Invoices' without any search or filter capabilities. This omission significantly hinders the ability of Branch staff to efficiently locate specific shipments, especially when dealing with a large volume of incoming invoices. Users are unable to search by critical identifiers such as invoice number, SSCC, or GLN, leading to manual scrolling and potential delays in processing.

---

**Steps to Reproduce:**
1. Log in to EPTTS Mobile as a Branch user (e.g., testbranch@eptts.com).
2. From the Branch Home screen, tap the 'Receive Shipment' tile.
3. Observe the 'Incoming Invoices' list displayed.
4. Attempt to locate any search bar, filter icon, or input fields that would allow filtering the list by Invoice Number, SSCC, or GLN.

---

**Expected Result:**
The 'Incoming Invoices' list on the 'Receive Shipment' screen should provide clear and accessible search and/or filter options (e.g., input fields, filter buttons) to allow Branch users to quickly find specific shipments using criteria such as Invoice Number, SSCC, or GLN.

---

**Actual Result:**
The 'Incoming Invoices' list on the 'Receive Shipment' screen does not present any search or filter functionality, requiring users to manually scroll through the entire list to find a desired shipment.

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Platform: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app, no web environment/URL
App Version: 
Role/Account: Branch (e.g., testbranch@eptts.com)
Network state: Online

---

**Priority:** P2 – High

---

**Bug Type:** Functional
