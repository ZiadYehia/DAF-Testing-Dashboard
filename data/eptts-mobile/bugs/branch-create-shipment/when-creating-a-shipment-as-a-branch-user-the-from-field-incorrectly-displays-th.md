---
title: >-
  When creating a shipment as a Branch user, the 'From' field incorrectly
  displays the associated Distributor's GLN instead of the Branch's own GLN
status: reported
jira_key: DW-886
reported_at: '2026-07-19T09:56:20.232Z'
feature: branch-create-shipment
priority: P1 – Critical
bug_type: Functional
parent_key: null
severity: ''
layer: frontend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
When a user logged in with a Branch account attempts to create a new shipment, the 'From' field on the shipment creation screen incorrectly populates with the GLN (Global Location Number) of the associated Distributor rather than the GLN of the Branch itself. This misrepresentation of the sender entity is a critical data integrity issue for traceability and compliance.

---

**Steps to Reproduce:**
1. Log in to EPTTS Mobile as a Branch user (e.g., `testbranch@eptts.com`).
2. From the Branch Home screen, tap the 'Create Shipment' tile.
3. Observe the 'From' field displayed on the 'Create Shipment' form.

---

**Expected Result:**
The 'From' field should display the GLN and name of the logged-in Branch entity (e.g., 'Main warehouse').

---

**Actual Result:**
The 'From' field displays the GLN and name of the Distributor entity that the Branch belongs to, instead of the Branch's own GLN.

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Platform: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app, no web environment/URL
App Version: [To be filled by QA]
Role/Account: Branch (`testbranch@eptts.com`)
Network state: Online

---

**Priority:** P1 – Critical

---

**Bug Type:** Functional
