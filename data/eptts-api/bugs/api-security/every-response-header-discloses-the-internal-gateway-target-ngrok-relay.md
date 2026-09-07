---
title: >-
  [Security] Every response discloses the internal gateway target in
  X-Gateway-Target
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
found_by: Claude (direct verification)
found_at: '2026-09-07T12:45:00.000Z'
environment: ngrok relay
---
Every response carries `X-Gateway-Target: http://localhost:3013`, naming the internal service the gateway routed to. The port differs by route — `3002` for `/products`, `3013` for `/health` and `/epcis` — so an external caller can map the internal service topology by varying the path. It is a debugging header that should not be returned to a B2B partner. Found by reading the headers rather than by a case: the suite's disclosure sweep is applied only to response bodies, so internal detail in a header was never looked at, even though the existing DISCLOSURE pattern already matches `localhost:<port>`.

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Authenticate as the manufacturer at POST https://12bc-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth with header apikey: <manufacturer key>.
3. GET https://448f-41-129-1-185.ngrok-free.app/masar-service/api/v1/epcis?limit=1 with that bearer and read the X-Gateway-Target response header.
4. Repeat against /masar-service/api/v1/products and compare the value.

---

**Expected Result:**
No response header names an internal host or port.

---

**Actual Result:**
`X-Gateway-Target: http://localhost:3013` is returned on /epcis and /health, and `http://localhost:3002` on /products.

---

**Environment:**
Masar B2B API over the ngrok relay
GET https://448f-41-129-1-185.ngrok-free.app/masar-service/api/v1/epcis?limit=1
Auth at https://12bc-41-129-1-185.ngrok-free.app/masar-service/api/v1/auth
Tenant: Janssen, manufacturer GLN 5413868000009
Self-signed TLS upstream of the tunnel; certificate validation disabled for the run

---

**Priority:**
P3 – Medium

---

**Bug Type:**
Functional (Backend/API)
