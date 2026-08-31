---
title: >-
  [Product Registry] A product is stored with a non-numeric GTIN — one record
  has its GTIN and name transposed
status: draft
jira_key: null
reported_at: null
feature: registry-products
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-08-31T10:05:00.000Z'
---
`GET /registry-service/api/v1/products` returns one record whose `gtin` and `name` values are transposed:

```json
{ "gtin": "Temodal 100 mg",
  "name": "00366582511120",
  "manufacturer": "Orion Corporation, Tengstrominkatu 8 Turku, FI-20360, Finland",
  "mahGln": "6432109999994" }
```

Exactly 1 of the 100 products visible to admin is affected. The wider issue is that the platform accepted it at all: **a GTIN must be 14 numeric digits**, and the field is holding free text. GTIN is the key every SGTIN is derived from, so a non-numeric GTIN cannot be serialised, cannot be commissioned, and will fail EPC parsing for any partner that pulls this catalogue via the master-data snapshot.
---
**Steps to Reproduce:**
1. Obtain a bearer token (POST /registry-service/api/v1/auth with a valid apikey, or capture the dashboard token).
2. GET https://192.168.225.195:8445/registry-service/api/v1/products?limit=100 with Authorization: Bearer <token>.
3. Search the response for the record with mahGln 6432109999994 (Orion Corporation).
4. Compare its `gtin` and `name` values.
5. Optionally open the Registry portal (:8445) → Products and locate the Temodal 100 mg row.
---
**Expected Result:**
1. The `gtin` field contains a 14-digit numeric GTIN and `name` contains the product name.
2. The product registry rejects a non-numeric value in the GTIN field at the point of entry.
---
**Actual Result:**
1. One record returns `gtin: "Temodal 100 mg"` and `name: "00366582511120"` — the two values are transposed.
2. The platform stores and serves a GTIN that is not a GTIN.
---
**Environment:**
- Masar B2B API / Registry portal via Citrix VPN
- GET https://192.168.225.195:8445/registry-service/api/v1/products?limit=100
- Auth: admin dashboard bearer token (the record is outside the devsim manufacturer's own catalogue)
- Tenant: devsim
---
**Priority:**
P2 – High
---
**Bug Type:**
Functional (Backend/API)
---
**Notes:**
Two distinct things to fix: correct the affected row's data, and add validation so the GTIN field cannot accept non-numeric text.

Note the Registry Products **page** displays this row in the correct orientation (GTIN column shows 00366582511120, NAME shows Temodal 100 mg), so the defect is only observable through the API. Worth checking whether the page reads a different endpoint or mirror. The attached screenshot is the Registry Products page for context.
