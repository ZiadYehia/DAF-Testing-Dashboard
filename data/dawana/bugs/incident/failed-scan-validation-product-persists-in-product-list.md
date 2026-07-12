---
status: draft
jira_key: null
reported_at: null
feature: incident
priority: P2
bug_type: Functional
title: Product is added to the incident product list even when submission fails due to a missing barcode scan validation error
---

In the Incident module, when a user attempts to add a serialized product to the incident product list without scanning or entering its barcode, the system correctly fires a validation error stating that the product requires a scan. However, despite this rejection, the product is still added to the product list (the multi-product cart used for submitting incidents across multiple items in one form). A failed validation must not result in any state change — the product list must remain unmodified when the operation is rejected.

This violates a core UI state rule: a product that fails validation should never appear in the product list. If the user proceeds to submit the full incident form with this invalidated entry present, the incident may be recorded for a serialized product with no SGTIN data, breaking pharmaceutical traceability for that item.

---

**Steps to Reproduce:**

1. Log in as Pharmacy Manager — account: `test2@test.Dawana`
2. Navigate to the Incident module
3. Select or search for the product (GTIN `04048846014269` — SPIRIVA) **without** scanning or entering its barcode
4. Select an incident reason (e.g., Expired)
5. Tap **Submit** / attempt to add the product to the product list
6. Observe the validation error: *"This product requires a scan"*
7. Observe the product list after the error is dismissed

---

**Expected Result:**
The product should not be added to the product list when the submission fails validation — the list must remain in its pre-submission state.

---

**Actual Result:**
Despite the validation error, the product is added to the incident product list and remains there, allowing the user to proceed toward submitting an incident for a serialized product that was never scanned.

---

**Environment:**
- Device: Samsung Galaxy Note 10+
- OS: Android 12
- App Version: 5.2.9
- Account: `test2@test.Dawana` (Pharmacy Manager)

---

**Priority:** P2 – High

---

**Bug Type:** Functional
