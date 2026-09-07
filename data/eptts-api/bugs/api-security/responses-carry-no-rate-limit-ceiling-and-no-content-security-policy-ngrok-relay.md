---
title: >-
  [Security] Responses advertise no rate-limit ceiling and carry no
  Content-Security-Policy
status: draft
jira_key: null
reported_at: null
feature: api-security
priority: P3 – Medium
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Claude (automated API suite)
found_at: '2026-09-07T12:40:00.000Z'
environment: ngrok relay
---
Authenticated responses carry no `X-RateLimit-Limit`, `X-RateLimit-Remaining` or `X-RateLimit-Reset`, so a client has no way to pace itself and cannot tell a throttle from an outage. The absence of the headers does not prove the absence of throttling, but on production these are documented at 2000 for the registry and 300 for masar, so a relay build serving none is a difference worth explaining. The same responses carry no `Content-Security-Policy`; that one matters little for a JSON API and is included only because it belongs to the same header set. HSTS, `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` are all present and correct.

**Covers test cases:** `TC_SEC_037`, `TC_SEC_041`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Authenticate as the manufacturer at POST https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth with header apikey: <manufacturer key>.
3. GET https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/epcis?limit=1 with that bearer and inspect the response headers.
4. Repeat the same GET and compare the two header sets.

---

**Expected Result:**
A positive rate-limit ceiling is advertised, remaining decrements between the two calls, a reset window is given, and a Content-Security-Policy restricts default-src.

---

**Actual Result:**
No `X-RateLimit-*` header is present on either response and no `Content-Security-Policy` is set; the only protective headers returned are `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy` and `X-Permitted-Cross-Domain-Policies`.

---

**Environment:**
Masar B2B API over the ngrok relay
GET https://3e21-41-129-1-185.ngrok-free.app/masar-service/api/v1/epcis?limit=1
Auth at https://4430-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Tenant: Janssen, manufacturer GLN 5413868000009
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run

---

**Priority:**
P3 – Medium

---

**Bug Type:**
Functional (Backend/API)
