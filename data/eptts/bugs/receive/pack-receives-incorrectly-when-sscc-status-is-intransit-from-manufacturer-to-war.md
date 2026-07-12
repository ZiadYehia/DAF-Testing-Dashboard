---
title: >-
  Pack receives incorrectly when SSCC status is InTransit from manufacturer to
  warehouse
status: draft
jira_key: null
reported_at: null
feature: receive
priority: P2 – High
bug_type: Functional
---

Summary:
The system allows receiving a pack inside an SSCC even when the SSCC status is InTransit from the manufacturer to the warehouse. This results in the pack status changing from InTransit to Active.

---
**Steps to Reproduce:**
1. Create an SSCC with a pack inside and set its status to InTransit from the manufacturer to the warehouse.
2. Attempt to receive the pack inside the SSCC using its DataMatrix.

---
**Expected Result:**
The system should prevent receiving the pack and display an error message indicating that the SSCC is still in transit.

---
**Actual Result:**
The pack is successfully received, and its status changes from InTransit to Active.

---
**Environment:**
- Windows version: 10
- Agent Version: 2.3.5
- Online or Offline state: Online

---
**Priority:**
P2 – High

---
**Bug Type:**
Functional
