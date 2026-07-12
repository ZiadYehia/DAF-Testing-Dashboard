---
title: >-
  Product sync toast notification displays total product count instead of only
  non-Dawana integrated product count
status: reported
jira_key: DW-796
reported_at: '2026-06-07T08:55:14.351Z'
feature: product-catalog-sync
priority: P3
bug_type: Functional
---
The Masar Agent's product synchronization toast notification provides an incorrect count of synced products. When the Agent performs a product catalog sync, the toast message indicates a total count (e.g., "113 products synced"), which includes both Dawana-integrated and non-Dawana-integrated products. The expected behavior is for this notification to display only the count of non-Dawana-integrated products, as these are the products relevant to the Agent's specific inventory and display. The actual 'Products' list in the application correctly filters and displays only non-Dawana products, indicating the issue is confined to the toast notification's displayed count. This leads to user confusion regarding the actual number of relevant products synchronized.

---

**Precondition:**
1. Install Masar Agent
2. Access to Internet (Wifi or Ethernet)
3. Launch the app
4. Login with a valid pharmacy account
5. OTP verified
6. Activation key validated

---

**Steps to Reproduce:**
1. Launch Masar Agent and ensure a valid pharmacy account is logged in.
2. Allow the system to perform a product catalog synchronization (e.g., on startup or a scheduled interval).
3. Observe the toast notification that appears on the screen after the synchronization completes.

---

**Expected Result:**
The product sync toast notification displays the count of only non-Dawana integrated products (e.g., "X non-Dawana products synced", where X is the correct filtered count).

---

**Actual Result:**
The product sync toast notification displays the total count of all products (e.g., "113 products synced"), including both Dawana and non-Dawana integrated products, even though the Products list correctly shows only non-Dawana products.

---

**Environment:**
- Platform: Windows 10/11
- Agent Version: v2.3.7
- Online state: Online

---

**Priority:**
P3 – Medium

---

**Bug Type:**
Functional
