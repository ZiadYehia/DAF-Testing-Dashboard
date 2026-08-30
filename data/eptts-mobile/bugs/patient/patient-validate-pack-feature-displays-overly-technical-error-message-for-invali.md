---
title: >-
  Patient 'Validate Pack' feature displays overly technical error message for
  invalid SGTIN input
status: reported
jira_key: DW-857
reported_at: '2026-07-13T10:41:18.669Z'
feature: patient
priority: P2 – High
bug_type: Functional / Validation
parent_key: null
severity: ''
layer: frontend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
Patient users attempting to validate a pack using DataMatrix input receive a highly technical error message ("Invalid identifier format. Expected SGTIN URN...") instead of a user-friendly explanation. This hinders the patient's ability to understand and correct their input, making the pack validation feature difficult to use for the general public.

---

**Steps to Reproduce:**
1. Launch the EPTTS Mobile app.
2. Tap the 'Patient' button on the landing screen.
3. Tap the 'Validate Pack' tile.
4. Attempt to scan a DataMatrix barcode with an invalid or unrecognized SGTIN format, or manually enter an incorrectly formatted SGTIN.
5. Observe the error message displayed.

---

**Expected Result:** A simple, user-friendly error message should be displayed, guiding the patient on how to correctly input or scan a pack identifier (e.g., "Please scan a valid pack barcode" or "Invalid pack identifier. Ensure the barcode is clear and fully visible.").

---

**Actual Result:** The app displays a technical error message: "Invalid identifier format. Expected SGTIN URN *urn:epc:id:sgtin<gcp>.<indicatir+itemRef>.<serial>" or GS1 Data Matrix"(01)<GTIN>(21)<serial>" with optional "(17)<YYMMDD>" and "(10)<batch>"".

---

**Environment:** Device: Samsung Galaxy Note 10+ — Android 12; Platform: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app; Role/Account: Patient (N/A — no login required); Network state: Online.

---

**Priority:** P2 – High

---

**Bug Type:** Functional / Validation
