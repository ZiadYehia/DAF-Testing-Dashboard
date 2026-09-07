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
`GET /billing/posture` reports `{"mode":"advisory","enforce":false,"record":true}`, so billing should record and not block. It records correctly — every packing event raises a PENDING invoice — but it also refuses the unpacking event outright, which is enforcement. Because packing is what creates the invoice, the hold is self-inflicted: pack, and the SSCC is immediately unpackable only after payment. No unpacking operation can complete on this tenant, which is why all 11 unpacking cases fail. The enforcement is also inconsistent with its own refusal message, which claims the SSCC "cannot be unpacked, split, moved, or reaggregated": the same held SSCC ships manufacturer to distributor to pharmacy and is received at each hop, and a single child is then split out of it by a return and moved to a different custodian, all successfully. So the hold blocks the one operation that only rearranges containment and permits the ones that actually move the goods, which is the opposite of what protecting an unpaid invoice would require.

**Covers test cases:** `TS_UNPK_001`, `TS_UNPK_002`, `TS_UNPK_003`, `TS_UNPK_010`, `TS_UNPK_011`, `TC_SHIP_005`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. As Daf admin, GET https://e7c0-41-129-1-185.ngrok-free.app/masar-service/api/v1/billing/posture and note mode advisory, enforce false, record true.
3. Authenticate as the manufacturer at POST https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth with header apikey: <manufacturer key>.
4. Commission an SGTIN of 05413868110425 and pack it into a fresh SSCC. Both succeed.
5. GET https://e7c0-41-129-1-185.ngrok-free.app/masar-service/api/v1/billing/invoices and observe a new invoice with status PENDING for the packed unit.
6. Submit an unpacking AggregationEvent with action DELETE for that SSCC and poll MsgStatusQuery.
7. Leaving the hold in place, ship that same SSCC to the distributor 0847976000005, receive it as the distributor, ship it on to the pharmacy 6224010005150 and receive it as the pharmacy, polling MsgStatusQuery after each. All four are processed.
8. As the pharmacy, submit a return shipping ObjectEvent for ONE child SGTIN of that held SSCC (bizStep shipping, disposition returned, a fresh return reference) and poll MsgStatusQuery.
9. As the distributor, submit the matching return receiving ObjectEvent (bizStep receiving, disposition returned, the same reference), poll MsgStatusQuery, then POST /VerifyProduct for that SGTIN and read `currentGln` and `parentSscc`.

---

**Expected Result:**
The unpacking event is processed, because with enforce false billing may record the pending invoice but must not block a supply-chain operation — and whichever operations a hold does block, they are the ones its own message names.

---

**Actual Result:**
The unpacking event fails with `Unpacking event failed: SSCC 854138687876006223 has an active billing hold and cannot be unpacked, split, moved, or reaggregated until the hold is released (the invoice is paid).` — reproduced on 2026-09-07 as SSCC 854138687939059227, on which all four preceding shipping and receiving hops answered `S - Successful` before that same SSCC was refused the unpack — while splitting a child out of a held SSCC is likewise allowed: on SSCC 854138687940522802 the pharmacy's return answered `Return event processed successfully` and the distributor's return receiving `Return Confirmation event processed successfully`, after which the child read `currentGln: 0847976000005` with `parentSscc: 854138687940522802` still set, i.e. handed to another custodian out of a held container without the hold objecting.

---

**Environment:**
Masar B2B API over the ngrok relay
POST https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/scp/SendEPCIS
Auth at https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Billing at https://e7c0-41-129-1-185.ngrok-free.app/masar-service/api/v1
Tenant: Janssen, manufacturer GLN 5413868000009, distributor GLN 0847976000005, pharmacy GLN 6224010005150
Acting roles: manufacturer, distributor and pharmacy — each hop posted by the party performing it
Billing posture at the time of the block: mode advisory, enforce false, record true, source BILLING_MODE=advisory
SSCC 854138687876006223 first observation; SSCC 854138687939059227 shipped and received four times then refused the unpack; SSCC 854138687940522802 had child urn:epc:id:sgtin:5413868.011045.ZTGMTRDRYVD4LN0004 split out by a return while held
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional (Backend/API)
