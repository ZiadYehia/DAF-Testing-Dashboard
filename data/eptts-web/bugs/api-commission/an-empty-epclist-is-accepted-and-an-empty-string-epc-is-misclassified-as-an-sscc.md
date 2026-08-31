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

**TC_COMM_004 — `epcList: []`.** A commissioning event carrying zero EPCs is accepted and reports *"Message processed successfully — all 1 event(s) completed"*. Tellingly the log omits the *"Commission (Items) event processed successfully"* line it emits for real work, so the platform knows it commissioned nothing yet still reports success.

**TC_COMM_004b — `epcList: [""]`.** An empty-string EPC is accepted **and misclassified**: the log reads *"Commission (**SSCCs**) event processed successfully"*. An empty string is being parsed as an SSCC rather than rejected as an invalid EPC. That is an EPC-parsing bug, not merely a missing length check, and it means a malformed EPC can be routed down the wrong processing path.

Note the same empty-eventList behaviour also exists one level up: a well-formed envelope whose `epcisBody.eventList` is `[]` is likewise accepted with 202 / I001.
---
**Steps to Reproduce:**
1. Authenticate as the manufacturer.
2. Build a valid commissioning document, then set the event's `epcList` to an empty array.
3. POST to /masar-service/api/v1/scp/SendEPCIS and poll MsgStatusQuery.
4. Observe the terminal state and the logList contents.
5. Repeat with `epcList: [""]` and read the logList carefully.
6. Separately, POST a valid envelope whose epcisBody.eventList is [] and observe the response.
---
**Expected Result:**
1. A commissioning event with no EPCs is rejected as having nothing to commission.
2. An empty-string EPC is rejected as an invalid EPC, and never classified as an SSCC.
3. An EPCIS document with an empty eventList is rejected.
---
**Actual Result:**
1. epcList [] is accepted; MsgStatusQuery reports "S - Successful" while omitting the Commission line.
2. epcList [""] is accepted and logged as "Commission (SSCCs) event processed successfully".
3. An empty eventList returns 202 with code I001 and is queued for processing.
---
**Environment:**
- Masar B2B API via Citrix VPN
- Auth: POST https://192.168.225.195:8445/registry-service/api/v1/auth (apikey header)
- Events: POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
- Tenant: devsim, manufacturer INSTITUTO GRIFOLS (GLN 8435308300002)
- TLS: self-signed certificate
---
**Priority:**
P2 – High
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
Covered by `TC_COMM_004` / `TC_COMM_004b` (both `test.fail()`), and by `SMOKE-05b` in `automation-hub/projects/eptts-api-smoke/` for the empty-eventList case. The SSCC misclassification is the part worth investigating first — it points at the EPC parser rather than at input validation.
