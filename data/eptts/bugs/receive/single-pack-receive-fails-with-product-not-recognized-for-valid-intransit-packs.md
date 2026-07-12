---
title: >-
  single-pack-receive-fails-with-product-not-recognized-for-valid-intransit-packs
status: reported
jira_key: DW-790
reported_at: '2026-06-03T09:31:07.971Z'
feature: receive
priority: P2
bug_type: 'Functional'
---
Users of the Masar Agent are encountering an issue when attempting to add serialized products via DataMatrix scan or paste during receive operations. For seemingly valid products that are in the `InTransit` state and are not expired, the system displays an error message such as "Product not recognized" or "Pack URN not found". This prevents the successful reception of individual packs into pharmacy inventory, directly impacting stock management and daily operations. The user also noted seeing "product has expired" messages, which could indicate either incorrect validation for unexpired packs or expected validation for actually expired packs being perceived as a bug.

---

**Precondition:**
1. Masar Agent is activated and logged in with a valid pharmacy account.
2. A valid serialized pack (DataMatrix A) exists in Masar backend in 'InTransit' state, is NOT expired, and belongs to the pharmacy's GLN. (This pack's SSCC is known to work for SSCC receive, but single pack receive fails.)
3. Another serialized pack (DataMatrix B) exists in Masar backend in 'InTransit' state, IS expired, and belongs to the pharmacy's GLN.

---

**Steps to Reproduce:**
1. Launch and log in to Masar Agent with an active pharmacy.
2. Navigate to the Receive module.
3. Attempt to add DataMatrix A (the valid, unexpired InTransit pack) by scanning or pasting its value into the input field.
4. Observe the displayed message/behavior.
5. Attempt to add DataMatrix B (the expired InTransit pack) by scanning or pasting its value into the input field.
6. Observe the displayed message/behavior.

---

**Expected Result:**
1. For DataMatrix A: System successfully adds DataMatrix A to the receive list, displaying its details, and allows the user to proceed with the receive transaction.
2. For DataMatrix B: System displays a clear validation message indicating "Product Expired" and prevents the addition of the pack, but does not display "Product not recognized".

---

**Actual Result:**
1. For DataMatrix A: System displays an error message such as "Product not recognized", preventing the pack from being added to the receive transaction.
2. For DataMatrix B: System displays an error message such as "Product has expired", which prevents addition.

---

**Environment:**
Platform: Windows 10/11 , App: Masar Agent v2.3.5, Online

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional
