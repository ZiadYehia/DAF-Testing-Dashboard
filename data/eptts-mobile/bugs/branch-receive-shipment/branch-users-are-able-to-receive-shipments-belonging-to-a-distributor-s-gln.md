---
title: Branch users are able to receive shipments belonging to a Distributor's GLN
status: reported
jira_key: DW-889
reported_at: '2026-07-19T11:28:07.317Z'
feature: branch-receive-shipment
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: backend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
### Summary
A Branch user is currently able to view and successfully receive an incoming shipment (invoice) that is addressed to a Distributor's GLN, rather than their own. This violates the intended access control and data segregation, allowing a Branch to process transactions meant for another supply chain entity. This could lead to incorrect inventory records, erroneous EPCIS events, and compliance issues within the EPTTS system.

---

**Steps to Reproduce:**
1. Log in to EPTTS Mobile as a Branch user (e.g., `testbranch@eptts.com`).
2. Tap the 'Receive Shipment' tile on the home screen.
3. On the 'Incoming Invoices' list, identify and tap on an invoice that is explicitly addressed to a Distributor GLN (not the logged-in Branch's GLN).
4. Proceed through the pack scanning and confirmation steps to complete the receipt of the shipment.
5. Observe the final status of the shipment and the EPCIS history for the Branch account.

---

**Expected Result:**
The Branch user should only be able to view and receive incoming invoices that are addressed to their own GLN. Invoices intended for other entities (e.g., Distributors) should either not be visible in the 'Incoming Invoices' list for the Branch, or the app should prevent the Branch user from initiating or completing the receipt process for such invoices.

---

**Actual Result:**
The Branch user is able to view and successfully complete the receipt process for an invoice that is addressed to a Distributor's GLN, effectively taking custody of packs not intended for their entity.

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Environment: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app, no web environment/URL
Role/Account: Branch (e.g., `testbranch@eptts.com`)
Network state: Online

---

**Priority:** P1 – Critical

---

**Bug Type:** Functional (Backend/API)
