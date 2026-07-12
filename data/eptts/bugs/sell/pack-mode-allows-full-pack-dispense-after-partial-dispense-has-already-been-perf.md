---
title: >-
  Pack mode allows full pack dispense after partial dispense has already been
  performed on the same pack when it should not
status: draft
jira_key: null
reported_at: null
feature: sell
priority: P2 – High
bug_type: Functional
---

Summary:
The system allows a full pack dispense in pack mode even after a partial dispense has been performed on the same pack. This is incorrect because once a pack has been partially dispensed, the system should prevent further full pack dispenses to maintain accurate inventory and prevent over-dispensing.

---
**Steps to Reproduce:**
1. Open the Sell / Dispense module.
2. Select a pack and perform a partial dispense using strip mode.
3. Attempt to dispense the same pack again using pack mode.

---
**Expected Result:**
The system should prevent the full pack dispense and display an error message indicating that the pack has already been partially dispensed.

---
**Actual Result:**
The system allows the full pack dispense to complete without displaying any error messages.

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
