---
title: >-
  Receive allows already Active pack without error when entering pack with
  status Active
status: reported
jira_key: DW-811
reported_at: '2026-06-17T08:09:46.059Z'
feature: receive
priority: P2 – High
bug_type: Functional
---
The Agent allows receiving a pack that is already in the Active state without displaying an error message when the user enters a pack with an Active status.

--- 

**Steps to Reproduce:**
1. Open the Receive module.
2. Enter a pack with an Active status.
3. Attempt to receive the pack.

--- 

**Expected Result:**
The system should prevent the user from receiving an already Active pack and display an error message.

--- 

**Actual Result:**
The Agent allows the user to receive the pack without displaying any error message.

--- 

**Environment:**
- Windows version: [insert version]
- Agent Version: [insert version]
- Online or Offline state: [insert state]

--- 

**Priority:**
P2 – High

--- 

**Bug Type:**
Functional
