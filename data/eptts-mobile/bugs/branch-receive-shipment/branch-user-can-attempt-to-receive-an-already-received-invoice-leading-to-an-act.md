---
title: >-
  Branch user can attempt to receive an already-received invoice, leading to an
  'active to active' error in EPCIS History
status: reported
jira_key: DW-890
reported_at: '2026-07-19T12:15:52.848Z'
feature: branch-receive-shipment
priority: P2 – High
bug_type: Functional
parent_key: null
severity: ''
layer: backend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
The Branch user interface allows an invoice that has already been successfully received to remain visible and selectable in the 'Incoming Invoices' list. When the user attempts to re-initiate the receive process for such an invoice, the action proceeds to the scanning screen. However, the subsequent asynchronous EPCIS event submission fails, resulting in a 'Failed' event in the EPCIS History with an 'active to active' error message. This indicates a discrepancy between the UI's presentation of invoice status and the backend's validation rules.

---

**Steps to Reproduce:**
1. Log in as a Branch user (e.g., testbranch@eptts.com).
2. Navigate to the 'Receive Shipment' tile.
3. Select an incoming invoice from the 'Incoming Invoices' list.
4. Successfully receive all packs for this invoice, completing the receive process.
5. After successful receipt, navigate back to the 'Incoming Invoices' list.
6. Observe that the previously received invoice is still visible in the list.
7. Select the same invoice again.
8. Attempt to re-receive the invoice (e.g., by proceeding through the scan screen).
9. Navigate to 'EPCIS History'.
10. Observe a 'Failed' EPCIS event related to the attempted re-receipt.
11. Tap on the 'Failed' event and view the error details.

---

**Expected Result:**
After an invoice is successfully received, it should either no longer appear in the 'Incoming Invoices' list for 'Receive Shipment', or its status should be clearly marked as 'Delivered'/'Received', and the UI should prevent any attempt to re-initiate the receive process for that invoice.

---

**Actual Result:**
A successfully received invoice remains visible and selectable in the 'Incoming Invoices' list, allowing the Branch user to attempt to receive it again, which then results in an asynchronous 'Failed' EPCIS event with an error message stating "you can't receive from active to active".

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Platform: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app, no web environment/URL
Role/Account: Branch (testbranch@eptts.com)
Network state: Online

---

**Priority:** P2 – High

---

**Bug Type:** Functional
