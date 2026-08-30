---
title: >-
  Manual DataMatrix entry for receiving packs in Branch role results in an
  indefinite loading state
status: reported
jira_key: DW-855
reported_at: '2026-07-13T09:20:09.740Z'
feature: branch-receive-shipment
priority: P1 – Critical
bug_type: Functional
parent_key: null
severity: ''
layer: frontend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
## Summary
When a user logged in as a Branch attempts to receive a shipment and manually enters a DataMatrix (SGTIN) for a pack, the application enters an indefinite loading state. The loading indicator persists, and no packs are registered as scanned, effectively blocking the user from completing the receiving process for the shipment. This issue impacts a core happy-path flow for the Branch role.

---

**Steps to Reproduce:**
1. Log in to EPTTS Mobile as a Branch user (e.g., testbranch@eptts.com).
2. From the Branch home screen, tap the 'Receive Shipment' tile.
3. Select an available incoming invoice from the list.
4. On the 'Receive Shipment' screen, locate and tap the option for manual DataMatrix entry (or enter into the designated input field if present).
5. Enter a valid SGTIN DataMatrix for a pack expected in the shipment.
6. Observe the application's behavior after inputting the DataMatrix.

---

**Expected Result:**
The entered DataMatrix should be processed, the pack should be registered as scanned, the progress bar/count should update (e.g., 'Scanned' tab count increases), and the loading indicator should disappear, allowing the user to continue scanning or entering packs.

---

**Actual Result:**
After entering the DataMatrix, the application displays a loading indicator indefinitely. The pack is not registered, the count does not update, and the user cannot proceed with receiving the shipment.

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Platform: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app, no web environment/URL
App Version: [To be filled by QA]
Role/Account: Branch (testbranch@eptts.com)
Network state: Online

---

**Priority:** P1 – Critical

---

**Bug Type:** Functional
