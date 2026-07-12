---
title: >-
  Product count displayed in Agent Products tab does not match the product count
  shown in the Masar web portal for the same pharmacy GLN
status: reported
jira_key: DW-791
reported_at: '2026-06-04T11:20:29.825Z'
feature: product-catalog-sync
priority: P3
bug_type: Functional / Integration
---
The Masar Agent's Products tab is not synchronizing all product master data from the Masar backend. Currently, if Masar shows 'N' products for a specific pharmacy GLN, the Agent's Products tab may only display 'M' products, where M < N. For example, a product named "testagent" that exists in Masar is not visible in the Agent's Products tab, leading to an inconsistent product catalog for the pharmacy. This issue directly impacts the accuracy of the product catalog displayed to the user.
**Screenshots to attach:** Screenshot comparing Masar web portal product list with Masar Agent Products tab.

---

**Precondition:**
A specific pharmacy GLN has products defined in the Masar backend that are not yet synchronized or displayed in the Masar Agent's Products tab.

---

**Steps to Reproduce:**

1. Launch and login to Masar Agent with a valid pharmacy account.
2. Navigate to the "Products" module.
3. Separately, login to the Masar web portal with the same pharmacy account/GLN.
4. Navigate to the Products section in the Masar web portal and note the total product count and specific product names (e.g., "testagent").
5. Compare the product list and count displayed in the Agent's "Products" module with the Masar web portal.

---

**Expected Result:**
The product list and total count displayed in the Masar Agent's Products tab accurately match all products assigned to the pharmacy GLN in the Masar backend.

---

**Actual Result:**
The Masar Agent's Products tab displays an incomplete list of products, with a lower count than what is present in the Masar backend for the same GLN. For instance, the product "testagent" is missing from the Agent's list.

---

**Environment:**
- Windows 10/11
- Agent Version: v2.3.5
- Online or Offline state: Online

---

**Priority:**
P3 â Medium

---

**Bug Type:**
Functional / Integration
