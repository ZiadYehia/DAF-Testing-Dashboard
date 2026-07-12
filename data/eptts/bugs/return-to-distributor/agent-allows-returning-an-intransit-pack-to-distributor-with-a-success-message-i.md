---
title: >-
  Agent allows returning an InTransit pack to distributor with a success message
  instead of rejecting the operation
status: draft
jira_key: null
reported_at: null
feature: return-to-distributor
priority: P1 – Critical
bug_type: Functional
---
The Masar Agent incorrectly permits a user to initiate a "Return to Distributor" operation for a pharmaceutical pack that is currently in the "InTransit" state. When attempting this operation, the Agent displays a success message, implying the transaction was successful. This behavior violates core serialization integrity and state transition rules, as a pack must first be received and be **Active** in the pharmacy's inventory before it can be returned to a distributor. Allowing this invalid transaction could lead to inconsistent pack states, incorrect inventory records, and traceability discrepancies between the Agent and the central Masar system.

---

**Precondition:** A pack exists in Masar in `InTransit` state, destined for the logged-in pharmacy's GLN.

---

**Steps to Reproduce:**

1. Install Masar Agent 2. Access to Internet (Wifi or Ethernet) 3. Launch the app 4. Login with a valid pharmacy account 5. OTP verified 6. Activation key validated 7. Open Return to Distributor module 8. User is on Return to Distributor screen
2. Obtain a DataMatrix for a pack that is currently in "InTransit" state to the logged-in pharmacy's GLN (i.e., it has been shipped to the pharmacy but not yet received).
3. In the "Return to Distributor" screen, paste/scan the DataMatrix of the "InTransit" pack into the input field.
4. Select a valid "Return Reason" (e.g., "Damaged").
5. Click the "Confirm Return" button.

---

**Expected Result:**
System rejects the pack, displays a clear error message indicating that an `InTransit` pack cannot be returned, and the operation is not submitted. The pack's state remains `InTransit`.

---

**Actual Result:**
System displays a "Return Successful" message, and the operation appears to complete successfully, despite the pack being in `InTransit` state.

---

**Environment:**
- Windows 10/11
- Agent Version: v2.3.5
- Online or Offline state: Online

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional
