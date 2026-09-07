---
title: >-
  [Dispensing] Dispensing refuses a product as Dawana-integrated while both
  services report isDawanaIntegration false
status: draft
jira_key: null
reported_at: null
feature: api-dispensing
priority: P1 – Critical
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Claude (automated API suite)
found_at: '2026-09-07T08:05:00.000Z'
environment: ngrok relay
---
`GET /products` returns `isDawanaIntegration: false` for GTIN 05413868110425 from both the masar and the registry service, yet a dispensing event for it is refused with `Dispensing is not allowed for Dawana-integrated products via this channel`. The rule is reading a different source from the one the registry serves, so dispensing over this channel is unreachable for a product the registry says is eligible — and because the refusal answers every dispensing document identically, negative dispensing cases pass without their own rule ever being evaluated.

**Covers test cases:** `TC_DISP_001`, `TC_DEST_013`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. GET https://448f-41-129-1-185.ngrok-free.app/masar-service/api/v1/products and confirm 05413868110425 has isDawanaIntegration false. Repeat against https://12bc-41-129-1-185.ngrok-free.app/masar-service/api/v1/products and confirm the same.
3. Authenticate as the manufacturer, commission an SGTIN of 05413868110425, pack it, ship it to the branch, receive it, ship it to the pharmacy and receive it.
4. Authenticate as the pharmacy and POST a dispensing event for that SGTIN to /scp/SendEPCIS.
5. Poll MsgStatusQuery for the instanceIdentifier.

---

**Expected Result:**
The dispensing event is processed, because the registry reports the product as not Dawana-integrated.

---

**Actual Result:**
The event fails with `Dispensing event failed: Dispensing is not allowed for Dawana-integrated products via this channel. These products must be dispensed through the Dawana integration.`

---

**Environment:**
Masar B2B API over the ngrok relay
POST https://448f-41-129-1-185.ngrok-free.app/masar-service/api/v1/scp/SendEPCIS
Auth at https://12bc-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Tenant: Janssen, manufacturer GLN 5413868000009, pharmacy GLN 6224010005150
Product 05413868110425 last updated 2026-09-06T13:16:14.889Z, still refused 2026-09-07T08:00Z
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional (Backend/API)
