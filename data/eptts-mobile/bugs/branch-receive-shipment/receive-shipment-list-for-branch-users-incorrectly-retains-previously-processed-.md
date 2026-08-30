---
title: >-
  Receive Shipment list for Branch users incorrectly retains previously
  processed items, causing subsequent submission failures
status: reported
jira_key: DW-891
reported_at: '2026-07-19T13:20:16.315Z'
feature: branch-receive-shipment
priority: P2 – High
bug_type: Functional
parent_key: null
severity: ''
layer: frontend
jira_status: Testing
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
When a Branch user is receiving packs via the 'Receive Shipment' module, after successfully scanning and submitting the first pack, the list of items displayed for subsequent scans incorrectly retains the details of the already processed pack. This leads to submission failures when attempting to receive additional packs, as the payload sent to the backend includes items that have already been successfully processed.

---

**Steps to Reproduce:**
1. Log in to the EPTTS Mobile app as a Branch user (e.g., testbranch@eptts.com).
2. From the Branch home screen, tap the 'Receive Shipment' tile.
3. Select an incoming shipment from the 'Incoming Invoices' list.
4. On the 'Receive Shipment' screen, scan the barcode of the first pack from the manifest.
5. Tap 'Submit' to process the first pack (ensure this submission is successful).
6. Without navigating away, attempt to scan the barcode of a second, different pack from the same shipment or another shipment.
7. Observe that the list of items to be scanned still displays the first pack's details, even though it was already processed.
8. Scan the second pack's barcode and tap 'Submit'.
9. Observe that the submission request fails, indicating an issue with including previously processed items.

---

**Expected Result:**
After a pack is successfully scanned and submitted within the 'Receive Shipment' flow, the displayed list of items should be updated to reflect only the remaining unprocessed packs, or the UI state should be cleared to prevent already processed items from being included in subsequent submissions.

---

**Actual Result:**
The 'Receive Shipment' list retains items from a previously successful pack reception, causing subsequent submission attempts for other packs to fail because the payload incorrectly includes items that have already been processed.

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12
Platform: EPTTS Mobile (com.daf.eda.eptts) — native Android app
App Version: [Specify App Version, e.g., 1.0.0]
Role/Account: Branch (testbranch@eptts.com)
Network state: Online

---

**Priority:** P2 – High

---

**Bug Type:** Functional
