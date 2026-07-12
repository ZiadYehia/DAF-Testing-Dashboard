---
title: >-
  Dawana-integrated pack return accepted in EPTTS Agent when it should be
  rejected
status: reported
jira_key: DW-807
reported_at: '2026-06-09T12:41:54.624Z'
feature: return
priority: P1 – Critical
bug_type: Functional
---
The EPTTS Agent incorrectly accepts the return of a Dawana-integrated pack, which should be rejected as only non-Dawana packs are accepted in the Agent. 
   
   The pack in question has the following DataMatrix: 01054138681104252125252521726083110B1210
   
   --- 
   **Steps to Reproduce:**
   1. Open the EPTTS Agent.
   2. Navigate to the Return module.
   3. Enter the DataMatrix for a Dawana-integrated pack (e.g., 01054138681104252125252521726083110B1210).
   4. Complete the return transaction.
   
   --- 
   **Expected Result:**
   The system should reject the return transaction and display an error message indicating that Dawana-integrated packs are not accepted in the Agent.
   
   --- 
   **Actual Result:**
   The return transaction is successfully completed, and the pack is returned to an Active state.
   
   --- 
   **Environment:**
   - Windows version: [Insert Windows version]
   - Agent Version: [Insert Agent version]
   - Online or Offline state: [Insert online/offline state]
   
   --- 
   **Priority:**
   P1 – Critical
   
   --- 
   **Bug Type:**
   Functional
