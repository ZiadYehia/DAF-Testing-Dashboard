---
status: draft
jira_key: null
reported_at: null
feature: incident
priority: P1
bug_type: Functional
title: Incident report saves with a batch not encoded in the scanned SGTIN barcode instead of restricting the batch selection to the product's actual batch
---

When submitting an incident in the Incident module, after scanning a serialized product barcode (SGTIN), the system presents a batch selection dropdown that lists multiple batch options — including batches that do not belong to the scanned product. The user is able to select an unrelated batch ("string") and submit the form successfully. The incident is persisted in the system and becomes visible in the Inspector's list for approval.

The scanned barcode encodes a specific batch (`BATCH-04`) as part of the SGTIN data (`10BATCH-04` application identifier). The system must restrict the batch selection to — or automatically resolve it from — the batch encoded in the scanned barcode. Allowing an arbitrary batch to be submitted against a specific serialized unit breaks pharmaceutical-level traceability: the incident record now attributes a serialized item (GTIN `04048846014269`, Serial `TC04SPIRIVA001`) to a batch it does not belong to, creating a false compliance record that an Inspector can act on.

---

**Steps to Reproduce:**

1. Log in as Pharmacy Manager — account: `test2@test.Dawana`
2. Navigate to the Incident module
3. Tap the scan/barcode entry field and scan or manually enter the barcode:
   `010404884601426921TC04SPIRIVA0011726043010BATCH-04`
   *(encodes: GTIN `04048846014269`, Serial `TC04SPIRIVA001`, Expiry `2026-04-30`, Batch `BATCH-04`)*
4. Observe that a batch selection dropdown appears with multiple options
5. Select the batch **"string"** — a batch that is **not** the one encoded in the scanned barcode (`BATCH-04`)
6. Select incident reason: **Expired**
7. Tap **Submit**

---

**Expected Result:**
The system should either auto-resolve the batch from the scanned barcode and make it read-only, or validate on submission that the selected batch matches the batch encoded in the scanned product's barcode — and reject the form if there is a mismatch.

---

**Actual Result:**
The form is submitted successfully with batch "string" despite the scanned product encoding batch `BATCH-04`; the incident is saved, appears in the Pharmacy Manager's incident list, and is visible to the Inspector for approval — with incorrect batch attribution on a serialized product record.

---

**Environment:**
- Device: Samsung Galaxy Note 10+
- OS: Android 12
- App Version: 5.2.9
- Account: `test2@test.Dawana` (Pharmacy Manager)

---

**Priority:** P1 – Critical

---

**Bug Type:** Functional
