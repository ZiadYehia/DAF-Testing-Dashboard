---
status: draft
jira_key: null
reported_at: null
feature: incident
priority: P1
bug_type: Functional / Integration
title: Accepting an incident whose SGTIN overlaps with an already-accepted incident silently fails in Dawana but succeeds in Masar, reverting the incident to "Wait to Accept or Reject" while items remain in stock
---

When two active incidents share at least one SGTIN, accepting the second incident (after the first has already been accepted) causes a silent failure on Dawana's side. The incident status briefly transitions to "Pending Masar" and then rolls back to "Wait to Accept or Reject" in the inspector's view, with no error message shown. The affected items remain visible in Dawana stock.

Meanwhile, Masar processes the acceptance of the second incident successfully — all items, including the duplicate SGTIN, are marked with the incident reason in Masar. This produces a critical Dawana ↔ Masar desync: Masar has committed the status transition for all items while Dawana still shows both the reverted incident and the items as active stock. The incident appearing as re-actionable in the inspector's view also introduces a duplicate processing risk — a third acceptance attempt could trigger another Masar operation against items already marked out-of-service.

---

**Precondition:**
Two incidents have been created by a Pharmacy Manager, both in "Wait to Accept or Reject" status, and they share at least one SGTIN (same serialized unit appears in both incidents).

---

**Steps to Reproduce:**

1. Log in as **Pharmacy Manager** on the test device
2. Open the **Incident** module and create **Incident 1** with the following 3 products:
   - `urn:epc:id:sgtin:08401496.05208.TC07XANAX0002`
   - `urn:epc:id:sgtin:5413868.011042.TC07CONCERTA0002`
   - `urn:epc:id:sgtin:5413868.011965.TC07SPRAVATO0002`
3. Create **Incident 2** with the following 2 products (note: `TC07CONCERTA0002` also appears in Incident 1):
   - `urn:epc:id:sgtin:5413868.011042.TC07CONCERTA0002`
   - `urn:epc:id:sgtin:5413868.011042.TC07CONCERTA0001`
4. Switch to the **Inspector** account on the same device
5. Open the Incident module — both incidents are visible with status "Wait to Accept or Reject"
6. Tap **Accept** on **Incident 1**
7. Confirm Incident 1 is accepted successfully and its status advances past "Pending Masar"
8. Tap **Accept** on **Incident 2**
9. Observe the status change to "Pending Masar"
10. Wait for Masar to process, then verify item statuses in Masar
11. Return to Dawana (Inspector account) and observe the status of Incident 2 and the items in stock

---

**Expected Result:**
Dawana handles the duplicate SGTIN gracefully — either skipping it and processing the remaining non-duplicate item (`TC07CONCERTA0001`), or rejecting the acceptance with a clear error — and no Masar operation is triggered unless Dawana confirms success on its side.

**Actual Result:**
Dawana silently fails the acceptance of Incident 2 and reverts its status to "Wait to Accept or Reject" with no error message, while Masar successfully processes all items from both incidents (including the duplicate SGTIN). The items from Incident 2 remain in Dawana stock despite being marked with the incident reason in Masar.

---

**Environment:**
- Device: Samsung Galaxy Note 10+
- OS: Android 12
- App: Dawana v5.3.1
- Accounts: Pharmacy Manager + Inspector (same device, account switching)

---

**Priority:** P1 – Critical

**Bug Type:** Functional / Integration
