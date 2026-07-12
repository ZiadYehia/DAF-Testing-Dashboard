---
title: >-
  masar-agent-accepts-dispense-request-for-intransit-product-instead-of-rejecting-
status: reported
jira_key: DW-804
reported_at: '2026-06-08T13:36:05.028Z'
feature: sell
priority: 'P1'
bug_type: 'Functional'
---
The Masar Agent is incorrectly allowing users to dispense (sell) pharmaceutical products that are currently in an 'InTransit' state. According to system rules, only products in an 'Active' state should be eligible for dispensing. This behavior leads to incorrect product lifecycle management and potential data inconsistencies regarding pack ownership and traceability, violating a core business rule.

---

**Steps to Reproduce:**
1. Install Masar Agent.
2. Access to Internet (Wifi or Ethernet).
3. Launch the app.
4. Login with a valid pharmacy account.
5. OTP verified.
6. Activation key validated.
7. Ensure a product with an 'InTransit' status exists in Masar backend (e.g., product shipped to pharmacy but not yet received).
8. Open the Sell / Dispense module.
9. Enter or scan the DataMatrix of the 'InTransit' product.
10. Proceed with the dispense transaction.

---

**Expected Result:**
The system rejects the dispense request for the 'InTransit' pack. An error message (e.g., "Pack is in InTransit state and cannot be dispensed" or "Invalid pack state for dispense") is displayed, and the transaction is not completed. The pack state remains 'InTransit'.

---

**Actual Result:**
The system accepts the dispense request for the 'InTransit' pack. The product is added to the dispense transaction, and the transaction completes successfully without any validation error. The pack state is incorrectly transitioned from 'InTransit' to 'Dispensed' (or 'Partial Dispensed').

---

**Environment:**
Platform: Windows 10/11, App: Masar Agent v2.4.0

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional
