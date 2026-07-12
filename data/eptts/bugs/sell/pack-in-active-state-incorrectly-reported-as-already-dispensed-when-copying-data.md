---
title: >-
  Pack in Active state incorrectly reported as already dispensed when copying
  DataMatrix in Sell mode
status: reported
jira_key: DW-805
reported_at: '2026-06-09T08:51:56.335Z'
feature: sell
priority: P2 – High
bug_type: Functional
---
The Agent incorrectly reports a pack as already dispensed when the user attempts to copy a DataMatrix that has been previously received in the pharmacy but is still in an Active state in Masar.

--- 

**Steps to Reproduce:**

1. Receive a pack with the DataMatrix `010629000999001121testagent0000081726063010testbatch0002` in the pharmacy.
2. Ensure the pack is in an Active state in Masar.
3. Open the Sell module in the Agent.
4. Copy the DataMatrix `010629000999001121testagent0000081726063010testbatch0002` into the Sell screen.

--- 

**Expected Result:**
The Agent should allow the user to proceed with the sell operation since the pack is in an Active state.

--- 

**Actual Result:**
The Agent incorrectly reports that the pack is already dispensed, preventing the user from proceeding with the sell operation.

--- 

**Environment:**
- Windows version: [Insert Windows version]
- Agent Version: [Insert Agent version]
- Online or Offline state: [Insert online/offline state]

--- 

**Priority:**
P2 – High

--- 

**Bug Type:**
Functional
