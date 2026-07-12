---
title: >-
  product-status-not-updating-to-dispensed-in-masar-when-fully-dispensed-through-e
status: reported
jira_key: DW-802
reported_at: '2026-06-08T07:29:23.891Z'
feature: sell
priority: 'P1'
bug_type: 'Functional / Integration'
---
### Summary
The EPTTS Agent is not correctly updating the product status to 'Dispensed' in Masar after a full dispense, allowing the same product to be dispensed again, both fully and partially. This discrepancy can lead to inaccurate inventory tracking and potential security risks.

---
### Steps to Reproduce:
1. Open the EPTTS Agent and navigate to the Sell/Dispense module.
2. Select a product that has not been previously dispensed.
3. Perform a full dispense of the product.
4. Verify that the product's status in the EPTTS Agent does not change to 'Dispensed'.
5. Attempt to dispense the product again, both fully and partially.

---
### Expected Result:
After dispensing a product, its status in Masar should update to 'Dispensed', preventing any further dispensing of the same product. The EPTTS Agent should reflect this status change accurately.

---
### Actual Result:
The product's status in Masar does not update to 'Dispensed' after being fully dispensed through the EPTTS Agent. As a result, the same product can be dispensed multiple times, both fully and partially, without its status being updated correctly.

---
### Environment:
- Platform: Windows 10/11
- App: Masar Agent v2.4.0
- Internet Connection: Available

---
### Priority:
P1 – Critical.

---
### Bug Type:
Functional / Integration, as the issue involves the incorrect updating of product status in Masar through the EPTTS Agent, indicating a problem with how the Agent integrates with the Masar system.
