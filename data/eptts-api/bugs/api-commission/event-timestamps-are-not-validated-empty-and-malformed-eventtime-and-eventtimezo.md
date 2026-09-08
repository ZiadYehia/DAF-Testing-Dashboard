---
title: >-
  [Commissioning] Event timestamps are not validated — empty and malformed
  eventTime and eventTimeZoneOffset are accepted
status: draft
jira_key: null
reported_at: null
feature: api-commission
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
None of the EPCIS event-time fields is validated. All four of these commissioning documents are accepted and processed to *"S - Successful"*:

**Covers test cases:** `TC_COMM_025`, `TC_COMM_026`, `TC_COMM_027`, `TC_COMM_028`, `TC_DEST_019`, `TC_DEST_020`, `TS_RECV_029`, `TS_RECV_030`, `TS_RTN_032`, `TS_RTN_033`, `TS_RTRV_030`, `TS_RTRV_031`, `TC_SHIP_025`, `TC_SHIP_026`, `TC_SHIP_039`

**FIXED ON THE PLATFORM, verified 2026-09-08 on devsim.** Every case this report covers now
reaches a correct refusal, confirmed by a targeted re-run after the suite's expected-failure
markers were removed. Left on the board rather than withdrawn because it is filed in Jira —
a human should close the ticket rather than have the report vanish from under it.

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Authenticate as the manufacturer.
3. Build a valid commissioning document for a fresh SGTIN.
4. Set the event's `eventTime` to an empty string and POST to /masar-service/api/v1/scp/SendEPCIS.
5. Poll MsgStatusQuery with the instanceIdentifier and observe the terminal state.
6. Repeat with eventTime "05-05-2026 10:00", then with eventTimeZoneOffset "", then with eventTimeZoneOffset "+99:99".

---

**Expected Result:**
Each document is rejected — synchronously with 400 for a malformed field, or asynchronously with MsgStatusQuery reporting FAILED and naming the invalid timestamp; eventTime must be a valid ISO 8601 timestamp and eventTimeZoneOffset a valid UTC offset.

---

**Actual Result:**
All four are accepted: 202 followed by messagestatus "S - Successful" and "Commission (Items) event processed successfully"; the pack is created with an unusable or absent event timestamp.

---

**Environment:**
Masar B2B API via Citrix VPN
Auth: POST https://192.168.225.195:8445/registry-service/api/v1/auth (apikey header)
Events: POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Tenant: devsim, manufacturer INSTITUTO GRIFOLS (GLN 8435308300002)
TLS: self-signed certificate

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional (Backend/API)
