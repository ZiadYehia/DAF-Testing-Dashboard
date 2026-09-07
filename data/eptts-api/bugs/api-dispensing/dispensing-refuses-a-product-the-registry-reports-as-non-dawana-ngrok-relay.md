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
A dispensing event was refused with `Dispensing is not allowed for Dawana-integrated products via this channel` while `GET /products` reported `isDawanaIntegration: false` for GTIN 05413868110425 from both the masar and the registry service. The flag had been false for 19 hours at that point, so the rule was reading a different source from the one the registry serves.

**IT NO LONGER REPRODUCES, and the way it stopped is the diagnosis.** The refusal persisted across 19 hours and two tunnel rotations, then disappeared after the product record was written for an unrelated reason (a unit price was set via `PUT /products/{gtin}`). The flag itself never changed in that window. So the stale value appears to be held until something writes the product again, which means a flag change alone does not take effect — the reproduction below deliberately does NOT touch the product afterwards.

**Covers test cases:** `TC_DISP_001`, `TC_DEST_013`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. GET https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/products and confirm 05413868110425 has isDawanaIntegration false. Repeat against https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/products and confirm the same.
3. Set isDawanaIntegration to false on a product that had it true, and do NOT write the product again afterwards — no price change, no other edit.
4. Confirm GET /products reports isDawanaIntegration false for it on both hosts.
5. Authenticate as the manufacturer, commission an SGTIN of that product, pack it, ship it to the branch, receive it, ship it to the pharmacy and receive it.
6. Authenticate as the pharmacy and POST a dispensing event for that SGTIN to /scp/SendEPCIS.
7. Poll MsgStatusQuery for the instanceIdentifier.

---

**Expected Result:**
The dispensing event is processed, because the registry reports the product as not Dawana-integrated.

---

**Actual Result:**
The event failed with `Dispensing event failed: Dispensing is not allowed for Dawana-integrated products via this channel. These products must be dispensed through the Dawana integration.` — observed 2026-09-07 08:00Z. Re-checked 14:35Z after the product had been written for an unrelated reason: the Dawana refusal is gone and the same case now fails on an unrelated caller-scope rule instead.

---

**Environment:**
Masar B2B API over the ngrok relay
POST https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/scp/SendEPCIS
Auth at https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Tenant: Janssen, manufacturer GLN 5413868000009, pharmacy GLN 6224010005150
Product 05413868110425 last updated 2026-09-06T13:16:14.889Z, still refused 2026-09-07T08:00Z
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional (Backend/API)
