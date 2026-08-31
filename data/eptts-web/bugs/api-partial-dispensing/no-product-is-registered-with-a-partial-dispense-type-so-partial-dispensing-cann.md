---
title: >-
  [BLOCKER][Partial Dispensing] No product is registered with a partial
  dispense type, so partial dispensing cannot be exercised at all
status: draft
jira_key: null
reported_at: null
feature: api-partial-dispensing
priority: P2 – High
bug_type: Functional
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
Every one of the devsim manufacturer's 30 registered products has `dispenseType: "full"`. None is registered for partial or unit dispensing, so there is nothing in the catalogue the platform can partially dispense.

The consequence is that the whole **api-partial-dispensing feature (36 test cases)** is unexecutable against this tenant, regardless of how the tests are written. This is a test-data gap rather than a code defect, but it leaves a 36-case P2 feature with zero achievable coverage.

A related constraint compounds it: **27 of the same 30 products carry `isDawanaIntegration: true`**, and the platform refuses to dispense those through this API — *"Dispensing is not allowed for Dawana-integrated products via this channel. These products must be dispensed through the Dawana integration."* That leaves only 3 GTINs (08435308348882, 08435308348912, 08435308348929) usable for any dispensing test at all.
---
**Steps to Reproduce:**
1. Authenticate as the devsim manufacturer (POST /registry-service/api/v1/auth with EPTTS_MFG_APIKEY).
2. GET https://192.168.225.195:8445/registry-service/api/v1/products?search=84353083&limit=100.
3. Inspect the `dispenseType` field on all 30 returned products.
4. Inspect the `isDawanaIntegration` field on the same 30 products.
---
**Expected Result:**
1. At least one product is registered with a partial/unit dispense type so partial dispensing can be exercised end to end.
---
**Actual Result:**
1. All 30 products report dispenseType "full"; none supports partial dispensing.
2. 27 of 30 are Dawana-integrated and cannot be dispensed through this API at all.
---
**Environment:**
- Masar B2B API via Citrix VPN
- Auth: POST https://192.168.225.195:8445/registry-service/api/v1/auth (apikey header)
- Events: POST https://192.168.225.195:8444/masar-service/api/v1/scp/SendEPCIS
- Tenant: devsim, manufacturer INSTITUTO GRIFOLS (GLN 8435308300002)
- TLS: self-signed certificate
---
**Priority:**
P2 – High
---
**Bug Type:**
Functional
---
**Notes:**
To unblock: register a product with a partial/unit `dispenseType` via Registry portal (:8445) → Products → Add Product, ideally with `isDawanaIntegration: false` so it is dispensable through this channel. Until then the 36 partial-dispensing cases remain `new_added` with a documented reason rather than being silently reported as untested.
