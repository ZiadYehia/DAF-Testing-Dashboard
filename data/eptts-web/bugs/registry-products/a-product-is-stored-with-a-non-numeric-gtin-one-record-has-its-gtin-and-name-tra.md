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

---

**Steps to Reproduce:**

1. Connect the Citrix VPN.
2. Obtain a bearer token (POST /registry-service/api/v1/auth with a valid apikey, or capture the dashboard token).
3. GET https://192.168.225.195:8445/registry-service/api/v1/products?limit=100 with Authorization: Bearer <token>.
4. Search the response for the record with mahGln 6432109999994 (Orion Corporation).
5. Compare its `gtin` and `name` values.
6. Optionally open the Registry portal (:8445) → Products and locate the Temodal 100 mg row.

---

**Expected Result:**
The `gtin` field contains a 14-digit numeric GTIN and `name` contains the product name; the product registry rejects a non-numeric value in the GTIN field at the point of entry.

---

**Actual Result:**
One record returns `gtin: "Temodal 100 mg"` and `name: "00366582511120"` — the two values are transposed; the platform stores and serves a GTIN that is not a GTIN.

---

**Environment:**
Masar B2B API / Registry portal via Citrix VPN
GET https://192.168.225.195:8445/registry-service/api/v1/products?limit=100
Auth: admin dashboard bearer token (the record is outside the devsim manufacturer's own catalogue)
Tenant: devsim

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional (Backend/API)
