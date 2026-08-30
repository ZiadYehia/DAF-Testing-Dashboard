---
title: >-
  Destination GLN field in Branch Create Shipment does not return any results,
  blocking shipment creation
status: reported
jira_key: DW-860
reported_at: '2026-07-13T11:36:29.216Z'
feature: branch-create-shipment
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: backend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
The Destination GLN autocomplete field within the Branch role's Create Shipment feature fails to return any GLN entities, preventing users from selecting a destination and thus blocking the creation of new shipments. This is a critical blocker for the Branch role's primary function of creating and dispatching shipments.

---

**Steps to Reproduce:**
1. Log in as a Branch user (e.g., testbranch@eptts.com).
2. From the Branch Home screen, tap the 'Create Shipment' tile.
3. On the Create Shipment screen, tap into the 'Destination GLN' field.
4. Observe that no GLN entities are returned or displayed for selection.

---

**Expected Result:**
The 'Destination GLN' field should display a list of available GLN entities (e.g., pharmacies, other branches, distributors) as the user types or when the field is focused, allowing the selection of a destination for the shipment.

---

**Actual Result:**
The 'Destination GLN' field does not return or display any destination GLN entities, making it impossible to proceed with shipment creation.

---

**Environment:**
Device: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Platform: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app
App Version: [Latest]
Role/Account: Branch (testbranch@eptts.com)
Network state: Online

---

**Priority:** P1 – Critical

---

**Bug Type:** Functional (Backend/API)
