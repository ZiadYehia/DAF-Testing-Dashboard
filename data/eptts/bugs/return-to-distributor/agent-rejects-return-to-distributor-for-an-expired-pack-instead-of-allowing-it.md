---
title: Agent rejects return to distributor for an expired pack instead of allowing it
status: draft
jira_key: null
reported_at: null
feature: return-to-distributor
priority: P2 – High
bug_type: Functional
---
The user attempted to return an expired pharmaceutical pack to a distributor via the Masar Agent's 'Return to Distributor' module. According to business rules, returning expired products is a valid operation to manage unsellable inventory. However, the Agent incorrectly prevented this action, displaying an error message that explicitly states expired packs cannot be returned, thereby blocking a critical pharmacy workflow.

---

**Precondition:**
Pack with status 'Active' and an 'Expired' date is present in the pharmacy inventory.

---

**Steps to Reproduce:**

1. Launch Masar Agent and login with a valid pharmacy account.
2. Navigate to the 'Return to Distributor' module.
3. Scan or paste the DataMatrix of an expired pack (e.g., 01{GTIN}21{SSN}10{Batch}17{Expiry_in_past}).
4. Observe the system behavior after adding the pack.
5. Attempt to confirm the return transaction.

---

**Expected Result:**
The system successfully adds the expired pack to the return transaction and allows the user to complete the return to the distributor, updating the pack's state and reflecting the transaction in History and Queue (as per business rules).

---

**Actual Result:**
The system displays an error message stating that the pack has expired and cannot be returned, blocking the return transaction.

---

**Environment:**
- Windows 10/11
- Agent Version: v2.3.5
- Online or Offline state: Online

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional
