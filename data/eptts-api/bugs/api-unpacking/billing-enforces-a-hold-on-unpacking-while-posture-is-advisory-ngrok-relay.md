---
title: >-
  [Unpacking] Billing blocks unpacking on a pending invoice while the posture is
  advisory with enforce false
status: draft
jira_key: null
reported_at: null
feature: api-unpacking
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Claude (automated API suite)
found_at: '2026-09-07T13:30:00.000Z'
environment: ngrok relay
---
`GET /billing/posture` reports `{"mode":"advisory","enforce":false,"record":true}`, so billing should record and not block. It records correctly — every packing event raises a PENDING invoice — but it also refuses the unpacking event outright, which is enforcement. Because packing is what creates the invoice, the hold is self-inflicted: pack, and the SSCC is immediately unpackable only after payment. No unpacking operation can complete on this tenant, which is why all 11 unpacking cases fail.

**Covers test cases:** `TS_UNPK_001`, `TS_UNPK_002`, `TS_UNPK_003`, `TS_UNPK_010`, `TS_UNPK_011`, `TC_SHIP_005`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. As Daf admin, GET https://e7c0-41-129-1-185.ngrok-free.app/masar-service/api/v1/billing/posture and note mode advisory, enforce false, record true.
3. Authenticate as the manufacturer at POST https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth with header apikey: <manufacturer key>.
4. Commission an SGTIN of 05413868110425 and pack it into a fresh SSCC. Both succeed.
5. GET https://e7c0-41-129-1-185.ngrok-free.app/masar-service/api/v1/billing/invoices and observe a new invoice with status PENDING for the packed unit.
6. Submit an unpacking AggregationEvent with action DELETE for that SSCC and poll MsgStatusQuery.

---

**Expected Result:**
The unpacking event is processed, because with enforce false billing may record the pending invoice but must not block a supply-chain operation.

---

**Actual Result:**
The event fails with `Unpacking event failed: SSCC 854138687876006223 has an active billing hold and cannot be unpacked, split, moved, or reaggregated until the hold is released (the invoice is paid).`

---

**Environment:**
Masar B2B API over the ngrok relay
POST https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/scp/SendEPCIS
Auth at https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Billing at https://e7c0-41-129-1-185.ngrok-free.app/masar-service/api/v1
Tenant: Janssen, manufacturer GLN 5413868000009
Billing posture at the time of the block: mode advisory, enforce false, record true, source BILLING_MODE=advisory
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional (Backend/API)
