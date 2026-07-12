---
title: >-
  [Product Catalog] Agent's product count icon/tab displays incorrect number of
  products compared to Masar backend after sync/updates.
status: reported
jira_key: DW-803
reported_at: '2026-06-08T10:16:02.843Z'
feature: product-catalog-sync
priority: P2 – High
bug_type: Functional / Integration
---
The Masar Agent's product count, as shown in the application's icon/summary area and the dedicated 'Products' tab, incorrectly displays 2 products. This occurs even when the Masar backend system clearly contains 3 active products in its catalog. The discrepancy persists even after multiple product list updates or synchronization attempts, indicating a data consistency issue between the Agent and the backend.
---
**Steps to Reproduce:**
1. Ensure the Masar backend has 3 distinct products defined in its catalog.
2. Launch the Masar Agent application (assuming it is logged in and activated).
3. Observe the product count displayed in the Agent's main UI icon/summary area.
4. Navigate to the 'Products' tab within the Agent's settings/modules.
5. Observe the product count displayed in the 'Products' tab.
6. Trigger a manual sync or wait for an automatic synchronization cycle for product updates.
7. Re-check the product counts in both the Agent's icon/summary area and the 'Products' tab.
---
**Expected Result:**
1. The Masar Agent's product count displayed in the main UI icon/summary area consistently shows '3'.
2. The Masar Agent's 'Products' tab accurately lists all 3 products and its displayed count matches '3'.
3. All product counts correctly reflect the 3 products present in the Masar backend after synchronization.
---
**Actual Result:**
1. The Masar Agent's product count in the main UI icon/summary area incorrectly displays '2' instead of '3'.
2. While the 'Products' tab might initially show the correct count (3), after multiple updates or synchronization attempts, it also consistently displays '2' products.
3. The Agent's displayed product count remains '2' even though 3 products are confirmed in the Masar backend.
---
**Environment:**
Platform: Windows 10/11 , App: Masar Agent v2.4.0
---
**Priority:**
P2 – High
---
**Bug Type:**
Functional / Integration
