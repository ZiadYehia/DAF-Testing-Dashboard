---
title: >-
  [Commissioning] disposition is checked for presence but not validated
  against the CBV vocabulary
status: draft
jira_key: null
reported_at: null
feature: api-commission
priority: P3 – Medium
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
`disposition` is a GS1 Core Business Vocabulary field with a controlled value set. The platform checks it is present — omitting it is correctly refused with *"EPCIS event #0 is missing mandatory field(s): disposition"* (TC_COMM_033) — but never checks the value is valid.

**Covers test cases:** `TC_COMM_034`, `TS_RECV_028`, `TS_RTRV_029`

**FIXED ON THE PLATFORM, verified 2026-09-08 on devsim.** Every case this report covers now
reaches a correct refusal, confirmed by a targeted re-run after the suite's expected-failure
markers were removed. Left on the board rather than withdrawn because it is filed in Jira —
a human should close the ticket rather than have the report vanish from under it.

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Authenticate as the manufacturer.
3. Build a valid commissioning document for a fresh SGTIN.
4. Set the event's `disposition` to "teleported".
5. POST to /masar-service/api/v1/scp/SendEPCIS and poll MsgStatusQuery.
6. Observe the terminal state.

---

**Expected Result:**
The event is refused because "teleported" is not a valid CBV disposition.

---

**Actual Result:**
The event is accepted; MsgStatusQuery reports "S - Successful"; omitting disposition entirely IS correctly refused, so the presence check exists but the value check does not.

---

**Environment:**
Masar B2B API via Citrix VPN
Auth: POST https://192.168.225.195:8445/registry-service/api/v1/auth (apikey header)
Events: POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Tenant: devsim, manufacturer INSTITUTO GRIFOLS (GLN 8435308300002)
TLS: self-signed certificate

---

**Priority:**
P3 – Medium

---

**Bug Type:**
Functional (Backend/API)
