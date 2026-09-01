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

**Covers test cases:** `TC_COMM_003`, `TC_COMM_011`, `TC_COMM_012`

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
The second commissioning of an existing SGTIN is refused, with MsgStatusQuery reporting a failure that names the duplicate serial; a commissioning event that would change an existing pack's expiry date is refused.

---

**Actual Result:**
The second commissioning returns 202 and MsgStatusQuery reports "S - Successful" — "Commission (Items) event processed successfully"; the third commissioning with a different expiry also succeeds, overwriting the pack's expiry date; re-commissioning with a different batch also succeeds, provided the lot number is within the platform's 20-character limit. No ilmd change is validated.

---

**Environment:**
Masar B2B API via Citrix VPN
Auth: POST https://192.168.225.195:8445/registry-service/api/v1/auth (apikey header)
Events: POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
Tenant: devsim, manufacturer INSTITUTO GRIFOLS (GLN 8435308300002)
TLS: self-signed certificate

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional (Backend/API)
