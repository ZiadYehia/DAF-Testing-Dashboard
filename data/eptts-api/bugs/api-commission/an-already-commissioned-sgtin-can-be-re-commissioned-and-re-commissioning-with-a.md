---
title: >-
  [Commissioning] An already-commissioned SGTIN can be re-commissioned, and
  re-commissioning with a different expiry silently overwrites the original
status: draft
jira_key: null
reported_at: null
feature: api-commission
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
Commissioning is the act of bringing a serial number into existence. It must be possible exactly once per SGTIN — that uniqueness is what the entire traceability chain rests on. It is not enforced.

Submitting the same commissioning event twice for the same SGTIN returns `202` and then `messagestatus: "S - Successful"` with *"Commission (Items) event processed successfully"* both times (**TC_COMM_003**).

Worse, re-commissioning the same SGTIN with a **different expiry date** also succeeds (**TC_COMM_012**), which means a caller can silently rewrite an existing pack's master data after the fact. Notably, re-commissioning with a different *batch* IS correctly refused (*"Document rejected before any chunk was committed"*), so the expiry path looks like an oversight rather than a deliberate difference.

The source test suite recorded TC_COMM_003 as a *Positive* case expecting the pack to "stay Commissioned". A reviewer had already flagged that as wrong in the spreadsheet — *"How is that positive? system should reject an already commissioned pack"* — and that reviewer is correct.
---
**Covers test cases:** `TC_COMM_003`, `TC_COMM_012`

**Steps to Reproduce:**
1. Authenticate as the manufacturer (POST /registry-service/api/v1/auth with a valid apikey).
2. POST /masar-service/api/v1/scp/SendEPCIS with a valid commissioning event for a fresh SGTIN, lot ZTG-TEST, expiry 2030-12-31.
3. Poll POST /masar-service/api/v1/MsgStatusQuery with the instanceIdentifier until it reaches a terminal state.
4. POST the identical commissioning document again for the same SGTIN with a new instanceIdentifier.
5. Poll MsgStatusQuery again and observe the outcome.
6. POST a third commissioning document for the same SGTIN but with expiry 2029-06-30.
7. Poll MsgStatusQuery, then GET the pack state via POST /VerifyProduct.
---
**Expected Result:**
1. The second commissioning of an existing SGTIN is refused, with MsgStatusQuery reporting a failure that names the duplicate serial.
2. A commissioning event that would change an existing pack's expiry date is refused.
---
**Actual Result:**
1. The second commissioning returns 202 and MsgStatusQuery reports "S - Successful" — "Commission (Items) event processed successfully".
2. The third commissioning with a different expiry also succeeds, overwriting the pack's expiry date.
3. Re-commissioning with a different batch is correctly refused, showing the guard exists but does not cover expiry or plain duplicates.
---
**Environment:**
- Masar B2B API via Citrix VPN
- Auth: POST https://192.168.225.195:8445/registry-service/api/v1/auth (apikey header)
- Events: POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
- Tenant: devsim, manufacturer INSTITUTO GRIFOLS (GLN 8435308300002)
- TLS: self-signed certificate
---
**Priority:**
P1 – Critical
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
Covered by automated tests `TC_COMM_003` and `TC_COMM_012` in `automation-hub/projects/eptts-api-commission/`. Both are marked `test.fail()` so the suite stays green while the gap exists and reports an "unexpected pass" the moment it is fixed.
