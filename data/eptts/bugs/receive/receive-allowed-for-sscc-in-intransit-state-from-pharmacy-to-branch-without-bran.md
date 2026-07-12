---
title: >-
  Receive allowed for SSCC in InTransit state from pharmacy to branch without
  branch confirmation
status: draft
jira_key: null
reported_at: null
feature: receive
priority: P1 – Critical
bug_type: Functional
---
The Agent allows receiving an SSCC that is in the InTransit state from the pharmacy to the branch without confirmation from the branch side, even though the Agent should only work for pharmacy-side operations.

--- 

**Steps to Reproduce:**

1. Initiate a return from the pharmacy to the branch.
2. Ensure the SSCC status is InTransit from the pharmacy to the branch.
3. Do not confirm the return from the branch side.
4. Attempt to receive the SSCC using the Agent from the pharmacy side.

--- 

**Expected Result:**
The Agent should prevent the receive operation for an SSCC that is in the InTransit state from the pharmacy to the branch without branch confirmation, as it is not a valid operation for the pharmacy side.

--- 

**Actual Result:**
The Agent allows the receive operation for the SSCC, even though it is in the InTransit state from the pharmacy to the branch without branch confirmation.

--- 

**Environment:**
- Windows version: [insert version]
- Agent Version: [insert version]
- Online or Offline state: [insert state]

--- 

**Priority:**
P1 – Critical

--- 

**Bug Type:**
Functional
