---
title: >-
  Agent core transaction operations (Sell, Return, Return to Distributor) fail
  with 'InstanceIdentifier exceeds maximum 40 characters' error during backend
  validation
status: reported
jira_key: DW-797
reported_at: '2026-06-07T09:19:45.359Z'
feature: transaction-processing
priority: P2
bug_type: Functional / Integration
---
When a user attempts to perform critical transaction operations such as selling, partial dispensing, returning to pharmacy, or returning to a distributor, the system displays a backend validation error. This error specifically indicates that the 'InstanceIdentifier' being processed exceeds its maximum allowed length of 40 characters, preventing the completion of any affected transaction.

This issue effectively blocks core pharmacy operations, leading to an inability to accurately track product movements and update inventory states within the Masar system.

---

**Precondition:**
1. Masar Agent is installed, activated, and user is logged in.
2. Internet connection is stable, and Agent is online.
3. A transaction is initiated involving a product whose 'InstanceIdentifier' (likely derived from GTIN + Serial Number or URN) exceeds 40 characters, as determined by the backend validation rule.

---

**Steps to Reproduce:**
1. Launch Masar Agent and login with a valid pharmacy account.
2. Navigate to a core transaction module (e.g., Sell / Dispense, Return, or Return to Distributor).
3. Attempt to add a product (e.g., by scanning or pasting its DataMatrix).
4. Proceed to confirm/complete the transaction.
5. Observe the error message displayed.

---

**Expected Result:**
The transaction (Sell, Partial Dispense, Return, Return to Distributor) completes successfully. Pack states are updated correctly in the Agent, and the transaction is synchronized with the Masar backend without validation errors. If an 'InstanceIdentifier' length constraint exists, the system provides clear client-side validation or handles the identifier according to integration specifications.

---

**Actual Result:**
The system displays an error message containing `{"statustype":"E","code":400,"date":"2026-06-07T08:20:12.655Z","messageid":"","status":{"reason":"Instanceldentifier exceeds maximum 40 characters","code":"E900"}}`, and the transaction fails to complete, preventing any state changes or synchronization with Masar.

---

**Environment:**
- Platform: Windows 10/11
- Agent Version: v2.3.5
- Online or Offline state: Online

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional / Integration
