---
title: >-
  Sell operation intermittently allows dispensing of a pack belonging to a
  different pharmacy GLN even though the pack's parent SSCC was InTransit
status: draft
jira_key: null
reported_at: null
feature: sell
priority: P1 – Critical
bug_type: Functional — Intermittent / Flaky
---
A critical data integrity issue was observed where the Masar Agent intermittently allowed a pack to be sold in Strip Mode despite it belonging to a different pharmacy's GLN. The associated SSCC for this pack was in an InTransit state at the time of the transaction, though the pack itself was Active. This bypasses fundamental GLN ownership and state validation rules, leading to potential inventory and traceability corruption across pharmacies. The issue is currently not consistently reproducible, making its investigation challenging.

**Screenshots to attach:** screenshot of the completed sell transaction.

---

**Precondition:**
Pack with DataMatrix `<specific_datamatrix_used_during_observation>` exists in Masar. This pack's state is Active. The pack belongs to `Assiut pharmacy GLN`. The parent SSCC of this pack is in `InTransit` state. User is logged in as `Sydybishr pharmacy`.

---

**Steps to Reproduce:**

1. Launch Masar Agent and log in with a valid account for `Sydybishr pharmacy`.
2. Navigate to the Sell / Dispense module.
3. Select "Strip Mode".
4. Copy/paste or scan the DataMatrix `<specific_datamatrix_used_during_observation>` (pack state: Active, belonging to `Assiut pharmacy GLN`, parent SSCC state: `InTransit`).
5. Enter a valid quantity for strip dispense.
6. Confirm the sell transaction.
(Note: This issue is intermittent and was only observed once)

---

**Expected Result:**
System rejects the sell transaction, displays a GLN ownership error or an invalid state error (due to parent SSCC InTransit), and prevents the dispense of the pack.

---

**Actual Result:**
System successfully processed the sell transaction, the pack was dispensed by `Sydybishr pharmacy`, and the transaction was recorded even though the pack belonged to `Assiut pharmacy GLN` and its parent SSCC was InTransit.

---

**Environment:**
- Windows version: Windows 10/11
- Agent Version: v2.3.5
- Online or Offline state: Online

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional — Intermittent / Flaky
