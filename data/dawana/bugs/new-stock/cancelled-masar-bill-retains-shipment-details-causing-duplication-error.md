---
status: draft
jira_key: null
reported_at: null
feature: new-stock
priority: P2
bug_type: Functional / Integration
title: Cancelled Masar-integrated New Stock bill retains shipment details in Dawana, causing 400 duplication error when Masar re-sends the same bill
---

When a New Stock bill is integrated with Masar and subsequently cancelled from Masar's side, Dawana does not remove or invalidate the shipment details that were registered during the first integration. As a result, when Masar cancels the bill and re-sends a new shipment for the same bill number, the Dawana webhook endpoint rejects the request with HTTP 400: "Shipment details for invoice TC10-BILL-1779372631318 have already been added".

This renders the New Stock receiving workflow completely blocked for that bill number — the pharmacy manager cannot receive the stock despite Masar sending a valid, active shipment. The stale shipment details in Dawana are never cleaned up by the cancellation event, meaning the only resolution path would require a manual backend intervention. The error surfaces on Masar's side as a webhook failure.

---

**Precondition:**
Bill `TC10-BILL-1779372631318` has been integrated with Masar at least once and its shipment details have been registered in Dawana. The bill has since been cancelled from Masar's side.

---

**Steps to Reproduce:**

1. Log in to Dawana as Manager
2. Navigate to the New Stock module
3. Create a new stock entry using bill number `TC10-BILL-1779372631318`
4. Integrate the bill with Masar (scan becomes required as a result of the integration)
5. Scan SSCC `003504585905003438` containing the following items:
   - `010084014965208721TC10XANAX0011728043010BATCH-10`
   - `010541386811042521TC10CONCERTA0011728043010BATCH-10`
   - `010541386811965721TC10SPRAVATO0011728043010BATCH-10`
6. Cancel bill `TC10-BILL-1779372631318` from Masar's side
7. From Masar, initiate a new shipment for the same bill number `TC10-BILL-1779372631318` with the same SSCC and items
8. Observe the webhook response received by Masar

---

**Expected Result:**
Dawana removes (or invalidates) the shipment details for bill `TC10-BILL-1779372631318` when Masar cancels the bill, allowing the subsequent re-shipment webhook to be processed successfully.

---

**Actual Result:**
Dawana retains the stale shipment details from the first integration; the re-shipment webhook fails with HTTP 400: `{"status":false,"statusCode":400,"message":"Shipment details for invoice TC10-BILL-1779372631318 have already been added","data":null}`, blocking re-integration entirely.

---

**Environment:**
- Device: Samsung Galaxy Note 10+
- OS: Android
- App Version: Dawana v5.3.1
- Role: Manager
- Bill Number: `TC10-BILL-1779372631318`

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional / Integration
