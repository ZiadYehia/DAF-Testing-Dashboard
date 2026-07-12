---
title: >-
  Pack allows partial dispense exceeding total strips when using Strip Mode
  after initial partial dispense
status: draft
jira_key: null
reported_at: null
feature: sell
priority: P2 – High
bug_type: Functional
---
The system allows a user to partially dispense a pack using Strip Mode multiple times, even if the total number of strips dispensed exceeds the pack's total strip count. 
   
   Summary:
   The issue arises when a pack is partially dispensed using Strip Mode. If the user then attempts to dispense additional strips from the same pack, the system does not prevent the user from exceeding the pack's total strip count. This can lead to an incorrect dispense history and potential inventory discrepancies.
   
   --- 
   
   **Steps to Reproduce:**
   1. Open the Sell module and select a pack with a limited number of strips (e.g., 3 strips).
   2. Partially dispense 1 strip from the pack using Strip Mode.
   3. Attempt to dispense additional strips (e.g., 3 strips) from the same pack using Strip Mode.
   
   --- 
   
   **Expected Result:**
   The system should prevent the user from dispensing more strips than the pack's total strip count and display an error message indicating that the dispense quantity exceeds the available strips.
   
   --- 
   
   **Actual Result:**
   The system allows the user to dispense more strips than the pack's total strip count without displaying any error messages or warnings.
   
   --- 
   
   **Environment:**
   - Windows 10
   - Dawana Agent Version: 2.3.5
   - Online state
   
   --- 
   
   **Priority:**
   P2 – High
   
   --- 
   
   **Bug Type:**
   Functional
