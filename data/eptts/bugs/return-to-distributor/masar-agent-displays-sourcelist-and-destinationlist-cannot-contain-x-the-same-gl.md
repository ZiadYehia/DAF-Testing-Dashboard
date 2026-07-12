---
title: >-
  Masar Agent displays 'sourceList and destinationList cannot contain X the same
  GLN' error when returning a pack to distributor
status: draft
jira_key: null
reported_at: null
feature: return-to-distributor
priority: P1 – Critical
bug_type: Functional (Backend/API)
---
A user attempting to return an Active pack to a distributor (branch) via the Masar Agent's 'Return to Distributor' module encounters a critical backend validation error. The system incorrectly identifies the source and destination GLNs as the same, preventing the return event. This directly impacts core traceability and inventory management, as legitimate returns are blocked due to an internal system error.

---

**Precondition:**
Pack with DataMatrix '010629000999001121Serial6791727123110BATCH1' exists in the current pharmacy's inventory in 'Active' state and is eligible for return to distributor.

---

**Steps to Reproduce:**

1. Install Masar Agent 2. Access to Internet (Wifi or Ethernet) 3. Launch the app 4. Login with a valid pharmacy account 5. OTP verified 6. Activation key validated 7. Navigate to the "Return to Distributor" module 8. In the DataMatrix input field, paste or type the DataMatrix: `010629000999001121Serial6791727123110BATCH1` 9. Click the 'Confirm Return' button

---

**Expected Result:**
Pack '010629000999001121Serial6791727123110BATCH1' is successfully returned to the distributor, its state changes appropriately, and the transaction appears in History and Queue as synced.

---

**Actual Result:**
The system displays an error message: "Return event failed: sourceList and destinationList cannot contain X the same GLN; Message processing failed — 1 of 1 event(s) encountered errors" and the pack is not returned.

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
Functional (Backend/API)
