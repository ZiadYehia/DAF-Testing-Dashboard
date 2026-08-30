---
title: >-
  Application becomes unusable after 15 minutes due to expired access token,
  displaying 'Unauthorized' with a non-functional Retry button
status: reported
jira_key: DW-861
reported_at: '2026-07-13T11:40:27.990Z'
feature: patient
priority: P2 – High
bug_type: Functional
parent_key: null
severity: ''
layer: frontend
jira_status: DONE
jira_reporter: '712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed'
---
### Summary
Users are unable to continue using the EPTTS Mobile application after approximately 15 minutes of being logged in. The access token expires, leading to all subsequent feature interactions and API calls returning an 'Unauthorized' error. The application displays an 'Unauthorized' message along with a 'Retry' button, which is non-functional and does not re-authenticate or refresh the session. This forces users to manually log out and then log back in to regain access, significantly disrupting workflow and productivity.

---

**Steps to Reproduce:**
1. Log in to the EPTTS Mobile application as any staff role (e.g., Pharmacy, Distributor, Branch, Inspector).
2. Remain logged in and either idle or perform various actions for a period exceeding 15 minutes.
3. Attempt to navigate to any feature module (e.g., My Shipments, Dispense, Trace) or perform any action within the app.
4. Observe the 'Unauthorized' message displayed on the screen.
5. Tap the 'Retry' button.

---

**Expected Result:**
The application should either silently refresh the access token before it expires, automatically re-authenticate the user, or the 'Retry' button should successfully re-authorize the session, allowing the user to continue their work without requiring a full logout and re-login.

---

**Actual Result:**
After approximately 15 minutes, the user's session expires, and all attempts to interact with the application result in an 'Unauthorized' error message. The 'Retry' button, when tapped, does not resolve the authorization issue, and the user remains in an 'Unauthorized' state, necessitating a manual logout and re-login to restore functionality.

---

**Environment:**
Browser: Samsung Galaxy Note 10+ — Android 12 (primary verified device)
Environment: EPTTS Mobile (com.daf.eda.eptts) — native Android/iOS app, no web environment/URL
Role/Account: All staff roles (e.g., Pharmacy: sydybishresaaf@eptts.com, Distributor: testdistributor2@eptts.com, Branch: testbranch@eptts.com, Inspector: testinspector@eptts.com)
Network state: Online

---

**Priority:** P2 – High

---

**Bug Type:** Functional
