---
title: >-
  new-user-registration-fails-with-null-value-in-column-pharmacy-name-database-err
status: reported
jira_key: DW-789
reported_at: '2026-06-02T16:45:50.966Z'
feature: registration
priority: P2
bug_type: Functional (Backend/API)
---
When a new user attempts to complete the registration process in Dawana, specifically at the final "Dispense Letter" step, the system returns a `QueryFailedError`. This error indicates that the `pharmacy_name` column, which has a `not-null` constraint in the `pharmacies` table, is receiving a `null` value from the frontend or an upstream process during the submission of the registration data. This critical issue prevents any new user from successfully completing registration and gaining access to the application.

---

**Steps to Reproduce:**

1. Launch the Dawana App.
2. Select "Pharmacy Role" and proceed to registration.
3. Tap "Register New Account".
4. Complete all preceding registration steps (e.g., personal details, pharmacy details).
5. Navigate to and proceed through the "Dispense Letter" section (the final part of the registration process).
6. Attempt to finalize and submit the registration.

---

**Expected Result:**
The new user registration completes successfully, and the user is onboarded into the Dawana application without any errors.

---

**Actual Result:**
The registration fails, and a frontend error message "QueryFailedError: null value in column 'pharmacy_name' of relation 'pharmacies' violates not-null constraint" is displayed, blocking registration completion.

---

**Environment:**
Device: Samsung Note 10 plus , OS: Android v12 , app: v5.1.0 , Account: New user attempting registration

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional (Backend/API)
