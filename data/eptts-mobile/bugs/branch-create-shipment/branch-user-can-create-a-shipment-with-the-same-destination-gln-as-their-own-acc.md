---
title: >-
  Branch user can create a shipment with the same Destination GLN as their own
  account
status: reported
jira_key: DW-885
reported_at: '2026-07-19T09:41:15.504Z'
feature: branch-create-shipment
priority: P2 – High
bug_type: Functional / Validation
parent_key: null
severity: ''
layer: backend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
A Branch user is currently able to select their own Global Location Number (GLN) as the destination when creating a new shipment. This allows for the creation of a draft shipment where the source and destination are identical, which is an illogical business operation and should be prevented by client-side validation. This could lead to confusion, incorrect inventory tracking, or erroneous EPCIS events if such a shipment were to be dispatched.

---

**Steps to Reproduce:**
1. Log in to EPTTS Mobile as a Branch user (e.g., `testbranch@eptts.com`).
2. From the Branch Home screen, tap the 'Create Shipment' tile.
3. In the 'Destination GLN' autocomplete field, search for and select the Branch's own GLN (e.g., 'Main warehouse').
4. Enter a valid 'ERP Invoice Number' (e.g., 'INV-001').
5. Tap the 'Create Draft' button.

---

**Expected Result:**
The system should prevent the creation of a shipment where the Destination GLN is identical to the sender's (Branch's) GLN. An appropriate validation error message should be displayed, or the 'Create Draft' button should remain disabled until a valid, distinct destination is selected.

---

**Actual Result:**
The Branch user is successfully able to create a draft shipment with their own GLN selected as the destination, allowing for a shipment from the Branch to itself.

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12
Platform: Both (Android/iOS)
App Version: com.daf.eda.eptts (latest available build)
Role/Account: Branch (`testbranch@eptts.com`)
Network state: Online

---

**Priority:** P2 – High

---

**Bug Type:** Functional / Validation
