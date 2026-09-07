---
title: >-
  [Product Verification] /VerifyProduct returns 500 E901 for every productId,
  including registered ones
status: draft
jira_key: null
reported_at: null
feature: api-security
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Claude (direct verification)
found_at: '2026-09-07T07:15:00.000Z'
environment: ngrok relay
---
`POST /VerifyProduct` answers `500` with `E901 "Internal error during product verification"` for every `productId` — a GTIN registered to the acting manufacturer, an unregistered GTIN, with and without the geo fields. Field validation still works (omitting `productId` correctly returns `400 E016`), so the request is parsed and then the verification itself fails. The endpoint is unusable, and because it is the platform's own product-check it is what an integrator calls before trusting a pack. Filed under api-security because that is the only feature whose cases touch the endpoint, and they touch it only as a carrier for token tests — no case exercises it with a valid token, which is why this was never caught by the suite.

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Authenticate as the manufacturer at POST https://12bc-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth with header apikey: <manufacturer key>, and keep the access_token.
3. POST https://448f-41-129-1-185.ngrok-free.app/masar-service/api/v1/VerifyProduct with that bearer and body {"productId":"05413868110425"} — a GTIN registered to this manufacturer.
4. Repeat with {"productId":"05413868110425","geoLatitude":"30.0444","geoLongitude":"31.2357"}.
5. Repeat with an unregistered GTIN, {"productId":"09999999999999"}.
6. Repeat with an empty body, {} — this one returns 400.

---

**Expected Result:**
A registered GTIN returns its verification result, and an unregistered one returns a not-found style refusal.

---

**Actual Result:**
Steps 3 to 5 all return `500 {"logList":[{"type":"E","code":"E901","message":"Internal error during product verification"}]}`; only the missing-field case behaves, returning `400 E016 "JSON body must include productId"`.

---

**Environment:**
Masar B2B API over the ngrok relay
POST https://448f-41-129-1-185.ngrok-free.app/masar-service/api/v1/VerifyProduct
Auth at https://12bc-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Tenant: Janssen, manufacturer GLN 5413868000009
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run
Also reproduced on the earlier relay pair (868c / 14b6), so it is not tunnel-specific

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional (Backend/API)
