---
title: >-
  SSCC remains locked in pending state in Dawana after return request is
  canceled by Masar, blocking re-submission
status: reported
jira_key: DW-785
reported_at: '2026-05-25T21:32:58.026Z'
feature: return-to-distributor
priority: P2
bug_type: Functional / Integration
---

After a Pharmacy Manager submits a Return to Distributor request containing an SSCC and that request is subsequently canceled by Masar, Dawana fails to reflect the cancellation and continues to treat the SSCC as bound to an active (pending) return. When the manager attempts to create a new return with the same SSCC, the application rejects the submission with an error stating the request is still pending.

This is a state synchronization failure between Dawana and Masar: the cancellation event on the Masar side does not release the SSCC's lock in Dawana's local state. As a result, the manager is permanently blocked from returning that SSCC through the standard workflow, even though there is no active return in Masar to conflict with it.

---

**Steps to Reproduce:**

1. Log in as **Pharmacy Manager**
2. Navigate to **Return to Distributor** module
3. Create a new return request and add an SSCC (by scan or manual entry)
4. Submit the return request
5. The return is **canceled by Masar** (via distributor or Masar operator action)
6. Navigate back to **Return to Distributor** and initiate a new return with the **same SSCC**
7. Attempt to submit the new return

---

**Expected Result:**
After the return request is canceled by Masar, the SSCC is released from its pending lock and can be re-submitted in a new return.

---

**Actual Result:**
An error is displayed indicating the request is still pending, blocking re-submission of the SSCC despite the original return having been canceled by Masar.

---

**Environment:**
- Device: Samsung Galaxy Note 10+
- OS: Android 12
- App Version: Dawana v5.3.4
- Account: Pharmacy Manager

---

**Priority:** P2 – High

---

**Bug Type:** Functional / Integration
