---
title: >-
  [Registry] Generating an agent activation key during pharmacy registration
  fails with HTTP 404, silently, so the key is never issued
status: draft
jira_key: null
reported_at: null
feature: registry-register-pharmacy
priority: P2 – High
bug_type: Functional / Integration
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-09T00:37:00.000Z'
---
Ticking **Generate agent activation key (16-char, 30-day expiry)** on the Register Pharmacy form issues `POST /registry-service/api/v1/agent/activation-keys/generate`, which answers **404 Not Found**. The endpoint does not exist. The registration itself still completes and the party is created, so the operator is left believing an activation key was issued when none was, and the only trace is a console error — the page reports nothing. Without an activation key the pharmacy cannot pair its desktop agent, which is the whole purpose of the option.

**Covers test cases:** `REG_RPH_007`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8445.
2. Log in as inspector@masar.local.
3. Click Register Pharmacy.
4. Complete the required fields: GLN, pharmacy name, governorate, phone, address, tax id, and click the map to drop the location pin.
5. Tick Generate agent activation key.
6. Open the browser developer console.
7. Click Register pharmacy.
8. Read the console and the network panel.

---

**Expected Result:**
A 16-character agent activation key with a 30-day expiry is generated and displayed with the other credentials.

---

**Actual Result:**
`POST /registry-service/api/v1/agent/activation-keys/generate` returns 404 Not Found, no key is issued, no message is shown on the page, and the party is created regardless.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Registry portal: https://192.168.225.195:8445 (Keycloak client `registry-portal`, realm `masar`)
Tenant: devsim, logged in as inspector@masar.local (role inspector, GLN 9999999999999)
Endpoint: POST /registry-service/api/v1/agent/activation-keys/generate
Party created despite the failure: GLN 8888814096592, ZZ QA TEST PHARMACY 14096592
Console: "Failed to load resource: the server responded with a status of 404 (Not Found)"
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional / Integration
