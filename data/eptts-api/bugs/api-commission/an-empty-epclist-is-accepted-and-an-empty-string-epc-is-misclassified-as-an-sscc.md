---
title: >-
  [Commissioning] An empty epcList is accepted, and an empty-string EPC is
  misclassified as an SSCC
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
Two related EPC-list defects:

**Covers test cases:** `TC_COMM_004` `TC_SEC_029`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Authenticate as the manufacturer.
3. Build a valid commissioning document, then set the event's `epcList` to an empty array.
4. POST to /masar-service/api/v1/scp/SendEPCIS and poll MsgStatusQuery.
5. Observe the terminal state and the logList contents.
6. Repeat with `epcList: [""]` and read the logList carefully.
7. Separately, POST a valid envelope whose epcisBody.eventList is [] and observe the response.

---

**Expected Result:**
A commissioning event with no EPCs is rejected as having nothing to commission; an empty-string EPC is rejected as an invalid EPC, and never classified as an SSCC; an EPCIS document with an empty eventList is rejected.

---

**Actual Result:**
epcList [] is accepted; MsgStatusQuery reports "S - Successful" while omitting the Commission line; epcList [""] is accepted and logged as "Commission (SSCCs) event processed successfully"; an empty eventList returns 202 with code I001 and is queued for processing.

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
