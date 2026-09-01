---
title: >-
  [Commissioning] An already-commissioned SGTIN can be re-commissioned, and
  re-commissioning with a different expiry silently overwrites the original
status: reported
jira_key: DW-958
reported_at: '2026-09-01T05:51:29.734Z'
feature: api-commission
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: READY
jira_reporter: 712020:b6f2ccdf-1ea7-4b3c-85ca-0bf6ed8291ed
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
Commissioning is the act of bringing a serial number into existence. It must be possible exactly once per SGTIN — that uniqueness is what the entire traceability chain rests on. It is not enforced.

Submitting the same commissioning event twice for the same SGTIN returns `202` and then `messagestatus: "S - Successful"` with *"Commission (Items) event processed successfully"* both times (**TC_COMM_003**).

Worse, re-commissioning the same SGTIN with a **different expiry date** also succeeds (**TC_COMM_012**), which means a caller can silently rewrite an existing pack's master data after the fact. The same is true of a **different batch** (**TC_COMM_011**): with a lot number inside the platform's 20-character limit, the platform answers `S - Successful`. **No ilmd change is checked at all** — there is no partial guard, so a fix must cover plain duplicates, batch and expiry together.

> **Correction (2026-09-01), and this widened the bug after it was filed.** An earlier version of this report said a different batch "IS correctly refused", quoting *"Document rejected before any chunk was committed"*. That was wrong. The test built its second document with a 24-character lot, and the platform was rejecting it with *"batch exceeds 20 characters"* — a length complaint, nothing to do with re-commissioning. Re-run with a 14-character lot, the same submission succeeds. Anyone who read the earlier version and concluded "the guard exists, it just misses expiry" should discard that: there is no guard.

The source test suite recorded TC_COMM_003 as a *Positive* case expecting the pack to "stay Commissioned". A reviewer had already flagged that as wrong in the spreadsheet — *"How is that positive? system should reject an already commissioned pack"* — and that reviewer is correct.
---
**Steps to Reproduce:**
1. Connect the Citrix VPN.
2. Authenticate as the manufacturer (POST /registry-service/api/v1/auth with a valid apikey).
3. POST /masar-service/api/v1/scp/SendEPCIS with a valid commissioning event for a fresh SGTIN, lot ZTG-TEST, expiry 2030-12-31.
4. Poll POST /masar-service/api/v1/MsgStatusQuery with the instanceIdentifier until it reaches a terminal state.
5. POST the identical commissioning document again for the same SGTIN with a new instanceIdentifier.
6. Poll MsgStatusQuery again and observe the outcome.
7. POST a third commissioning document for the same SGTIN but with expiry 2029-06-30.
8. Poll MsgStatusQuery, then GET the pack state via POST /VerifyProduct.
---
**Expected Result:**
1. The second commissioning of an existing SGTIN is refused, with MsgStatusQuery reporting a failure that names the duplicate serial.
2. A commissioning event that would change an existing pack's expiry date is refused.
---
**Actual Result:**
1. The second commissioning returns 202 and MsgStatusQuery reports "S - Successful" — "Commission (Items) event processed successfully".
2. The third commissioning with a different expiry also succeeds, overwriting the pack's expiry date.
3. Re-commissioning with a different batch also succeeds, provided the lot number is within the platform's 20-character limit. No ilmd change is validated.
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
**Exchange evidence:** `1-exchange-tc_comm_003.jpg`, `2-exchange-tc_comm_011.jpg`, `3-exchange-tc_comm_012.jpg` — the exact request, the response, and the platform's verdict from `MsgStatusQuery`. Replayable copies (`api-log.html`, `api-postman-collection.json`) are written beside each run under `automation-hub/projects/<project>/runs/`.

**Covers test cases:** `TC_COMM_003`, `TC_COMM_011`, `TC_COMM_012`

Covered by automated tests `TC_COMM_003`, `TC_COMM_011` (different batch) and `TC_COMM_012` (different expiry) in `automation-hub/projects/eptts-api-commission/`. All are marked `test.fail()` so the suite stays green while the gap exists and reports an "unexpected pass" the moment it is fixed.
