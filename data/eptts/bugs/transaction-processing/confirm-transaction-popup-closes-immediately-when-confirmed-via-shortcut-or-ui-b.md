---
title: >-
  Confirm transaction popup closes immediately when confirmed via shortcut or
  UI, but remains open if settings are accessed first
status: draft
jira_key: null
reported_at: null
feature: transaction-processing
priority: P2 – High
bug_type: Functional
---
The confirm transaction popup in the Masar Agent is experiencing an issue where it closes immediately after the user confirms the transaction, either by using a shortcut or by interacting with the UI. However, if the user opens the settings before confirming the transaction, the confirm tab remains open as expected. This inconsistency in behavior is causing confusion and potentially leading to errors in transaction processing.

--- 

**Steps to Reproduce:**

1. Initiate a transaction that triggers the confirm transaction popup.
2. Confirm the transaction using either a shortcut or the UI.
3. Observe the behavior of the confirm transaction popup.
4. Repeat steps 1-3, but this time, open the settings before confirming the transaction.

--- 

**Expected Result:**
The confirm transaction popup should remain open after confirmation, allowing the user to review the transaction details before proceeding.

--- 

**Actual Result:**
The confirm transaction popup closes immediately after confirmation when using a shortcut or the UI, but remains open if the settings are accessed first.

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
