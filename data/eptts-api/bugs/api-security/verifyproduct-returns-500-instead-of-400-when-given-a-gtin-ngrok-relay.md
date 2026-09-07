---
title: >-
  [Product Verification] /VerifyProduct returns 500 E901 instead of 400 when
  productId is a GTIN rather than an SGTIN
status: draft
jira_key: null
reported_at: null
feature: api-security
priority: P4 – Low
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Claude (direct verification)
found_at: '2026-09-07T13:35:00.000Z'
environment: ngrok relay
---
`POST /VerifyProduct` accepts a serialized identifier by design — SGTIN or SSCC — and both work: an SGTIN returns 200 with the pack's status, custody GLN and parent SSCC, and an SSCC returns 200 with a structured result including a NOT_FOUND alert when it is unknown. A bare GTIN is therefore out of scope, and the only issue is HOW it is refused: `500` with `E901 "Internal error during product verification"` rather than a 400 naming the expected input. Well-formed JSON should not produce a 500, and a 500 tells an integrator the platform is broken rather than that they sent the wrong identifier type. Presence validation already answers correctly — omitting productId returns `400 E016`. Low: the endpoint meets its contract, this is only the error code on input it was never meant to take.

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Authenticate as the manufacturer at POST https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth with header apikey: <manufacturer key>.
3. Commission an SGTIN of 05413868110425 and wait for MsgStatusQuery to report success.
4. POST https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/VerifyProduct with body {"productId":"<that SGTIN URN>","geoLatitude":"","geoLongitude":""} — observe 200 and the pack object.
5. Repeat with body {"productId":"05413868110425"} — the GTIN of the same product.
6. Repeat with an empty body, {} — this correctly returns 400.

---

**Expected Result:**
A GTIN is rejected with a 400 stating that productId must be a serialized SGTIN.

---

**Actual Result:**
Step 5 returns `500 {"logList":[{"type":"E","code":"E901","message":"Internal error during product verification"}]}`, while step 4 returns 200 and step 6 returns `400 E016 "JSON body must include productId"`.

---

**Environment:**
Masar B2B API over the ngrok relay
POST https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/VerifyProduct
Auth at https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Tenant: Janssen, manufacturer GLN 5413868000009
Also reproduced on the earlier relay pair (868c / 14b6), so it is not tunnel-specific
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run

---

**Priority:**
P4 – Low

---

**Bug Type:**
Functional (Backend/API)
