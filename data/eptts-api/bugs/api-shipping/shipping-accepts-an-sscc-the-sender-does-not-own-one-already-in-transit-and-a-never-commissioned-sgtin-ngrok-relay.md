---
title: >-
  [Shipping] Shipping accepts an SSCC the sender does not own, one already in
  transit, and a never-commissioned SGTIN
status: draft
jira_key: null
reported_at: null
feature: api-shipping
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Claude (automated API suite)
found_at: '2026-09-07T07:10:00.000Z'
environment: ngrok relay
---
`POST /scp/SendEPCIS` processes a shipping event without checking that the sender owns the EPCs, that they are not already in transit, or that they exist at all. Each of the three returns `S - Successful` and writes a custody transfer into the traceability record, so the record can show goods moving from a party that never held them, moving twice at once, or moving without ever having been commissioned.

**Covers test cases:** `TC_SHIP_014`, `TC_SHIP_015`, `TC_SHIP_018`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Authenticate as the manufacturer at POST https://12bc-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth with header apikey: <manufacturer key>, and commission then pack an SGTIN of 05413868110425 into an SSCC.
3. Authenticate as the branch and POST that manufacturer-owned SSCC to /scp/SendEPCIS as a shipping event with the branch as sender. Poll MsgStatusQuery.
4. As the manufacturer, ship a fresh SSCC to the branch, then submit the identical shipping event for that same SSCC a second time. Poll MsgStatusQuery.
5. As the manufacturer, ship an SGTIN that was never commissioned. Poll MsgStatusQuery.

---

**Expected Result:**
Each event is refused, because the sender does not own the SSCC, the SSCC is already in transit, and the SGTIN does not exist respectively.

---

**Actual Result:**
All three are accepted with `"messagestatus": "S - Successful"` and `Shipping event processed successfully`.

---

**Environment:**
Masar B2B API over the ngrok relay
POST https://448f-41-129-1-185.ngrok-free.app/masar-service/api/v1/scp/SendEPCIS
Auth at https://12bc-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Tenant: Janssen, manufacturer GLN 5413868000009 and distributor GLN 0847976000005
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional (Backend/API)
