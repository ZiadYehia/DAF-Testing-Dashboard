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

A commissioning event with `disposition: "teleported"` is accepted and processed to *"S - Successful"* (**TC_COMM_034**). Any arbitrary string passes.

The same gap should be checked for `bizStep`, which is also a CBV-controlled field.
---
**Steps to Reproduce:**
1. Authenticate as the manufacturer.
2. Build a valid commissioning document for a fresh SGTIN.
3. Set the event's `disposition` to "teleported".
4. POST to /masar-service/api/v1/scp/SendEPCIS and poll MsgStatusQuery.
5. Observe the terminal state.
---
**Expected Result:**
1. The event is refused because "teleported" is not a valid CBV disposition.
---
**Actual Result:**
1. The event is accepted; MsgStatusQuery reports "S - Successful".
2. Omitting disposition entirely IS correctly refused, so the presence check exists but the value check does not.
---
**Environment:**
- Masar B2B API via Citrix VPN
- Auth: POST https://192.168.225.195:8445/registry-service/api/v1/auth (apikey header)
- Events: POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
- Tenant: devsim, manufacturer INSTITUTO GRIFOLS (GLN 8435308300002)
- TLS: self-signed certificate
---
**Priority:**
P3 – Medium
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
Covered by `TC_COMM_034` (marked `test.fail()`). `TC_COMM_033` (empty disposition) passes and is unaffected. Was recorded as `Fail` in the source spreadsheet and remains broken, unlike TC_COMM_033/035/038/041/042 which now reject correctly.
