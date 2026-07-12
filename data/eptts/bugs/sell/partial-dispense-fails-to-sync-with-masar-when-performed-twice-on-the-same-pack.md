---
title: >-
  Partial dispense fails to sync with Masar when performed twice on the same
  pack
status: draft
jira_key: null
reported_at: null
feature: sell
priority: P2 – High
bug_type: Functional / Integration
---
Partial dispense from the same pack is allowed in the Agent but the second dispense transaction does not synchronize with Masar, resulting in traceability discrepancy.

---
**Steps to Reproduce:**
1. Open the Sell module in the Agent.
2. Select a pack with sufficient quantity for two partial dispenses.
3. Perform the first partial dispense (e.g., dispense 1 strip).
4. Confirm the transaction is successful in the Agent.
5. Attempt a second partial dispense from the same pack (e.g., dispense another 1 strip).
6. Confirm the second transaction also appears successful in the Agent.
7. Check Masar for synchronization of both dispense transactions.

---
**Expected Result:**
Both partial dispense transactions should be successfully synchronized with Masar, reflecting the updated pack state and quantity.

---
**Actual Result:**
The first partial dispense transaction synchronizes correctly with Masar. However, the second partial dispense transaction does not synchronize, and Masar does not reflect the second dispense.

---
**Environment:**
- Windows version: [Insert version, e.g., Windows 10]
- Agent Version: [Insert version, e.g., v2.3.5]
- Online or Offline state at time of issue: Online

---
**Priority:**
P2 – High

---
**Bug Type:**
Functional / Integration
