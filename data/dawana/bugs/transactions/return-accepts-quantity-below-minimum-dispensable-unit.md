---
status: reported
jira_key: DW-781
reported_at: '2026-05-24T15:55:24.319Z'
feature: transactions
priority: P2
bug_type: Functional
title: Return in Transactions tab accepts quantity below minimum dispensable unit instead of enforcing the same strip-level validation applied during Dispense
---

The Return operation accessible from the Transactions tab does not enforce the minimum dispensable unit constraint that is correctly applied during the Dispense flow. For CONCERTA TABS XL 18 MG 30, the product hierarchy is 10 pills per strip × 3 strips per pack = 30 total units, making 1 strip (10 pills) the smallest valid quantity for any dispense or return operation. Attempting to dispense fewer than 10 units is correctly rejected by the system. However, the same minimum unit validation is entirely absent from the Return flow — a return quantity of 1 is accepted and processed without error, adding a sub-strip quantity back to inventory. The resulting stock state (e.g., 1 unit in stock) cannot be dispensed, since dispense itself enforces the 10-unit minimum, leaving the pharmacy with a permanently stranded inventory entry.

**Screenshots to attach:** (upload to Jira manually from `attachments/transactions/return-accepts-quantity-below-minimum-dispensable-unit/`)
1. Dispense screen showing the rejection message when quantity 1 is entered
2. Return screen showing quantity 1 accepted without error
3. Stock/inventory view showing the resulting sub-strip quantity in stock

---

**Precondition:**
Product CONCERTA TABS XL 18 MG 30 is available in pharmacy stock. At least one completed dispense transaction for this product exists in the Transactions tab.

---

**Steps to Reproduce:**

1. Log in as Pharmacy Manager
2. Navigate to the Dispense screen
3. Search for and select **CONCERTA TABS XL 18 MG 30**
4. Attempt to enter quantity **1** and confirm → observe that the system correctly rejects the operation
5. Enter quantity **30** (1 full pack) and confirm the dispense → operation succeeds
6. Navigate to the **Transactions** tab
7. Locate the completed dispense record for CONCERTA TABS XL 18 MG 30
8. Tap **Return**
9. Enter quantity **1**
10. Confirm the return

---

**Expected Result:**
The return is rejected with a validation message indicating the minimum returnable quantity is 10 (1 strip), consistent with the minimum unit enforcement applied in Dispense.

**Actual Result:**
The return succeeds with quantity 1, adding a sub-strip quantity back to stock — a state that can never be dispensed, as Dispense enforces a minimum of 10.

---

**Environment:**
- Device: Samsung Galaxy Note 10+
- OS: Android 12
- App: Dawana v5.3.2
- Role: Pharmacy Manager

---

**Priority:** P2 – High

**Bug Type:** Functional
