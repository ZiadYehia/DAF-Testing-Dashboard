---
title: >-
  [Shipping] Adding packs to a draft invoice fails with HTTP 404, silently, so
  no shipment can ever be dispatched from the UI
status: draft
jira_key: null
reported_at: null
feature: web-shipping
priority: P1 – Critical
bug_type: Functional / Integration
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T14:05:00.000Z'
---
A draft shipping invoice is created correctly, but nothing can ever be put into it. Clicking **Add to Invoice** on a staged barcode issues `POST /masar-service/api/v1/shipments/draft/{id}/add-packs`, which answers **404 Not Found**. The button spins, recovers, and the UI reports nothing at all — no toast, no inline error. The item count stays at `0 pack(s) total` and the **Dispatch** button therefore never leaves its disabled state. Since all three item paths (Add SSCC, Create SSCC, Add Individual Packs) feed the same staging list and the same endpoint, the entire Shipping feature is unusable through the dashboard: custody can never be transferred.

**Covers test cases:** `WEB_SHP_006`, `WEB_SHP_007`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open https://192.168.225.195:8444/shipments.
4. Choose any destination, type an invoice number, and click Start Invoice; confirm the toast reads "Draft invoice created".
5. Click Add Individual Packs.
6. Type a well-formed pack barcode such as 010629000999001121Serial1 and click the plus button so it is staged and the counter reads "(1 scanned)".
7. Click Add to Invoice.
8. Watch the item count, the toast area and the Dispatch button for ten seconds, and open the browser console.

---

**Expected Result:**
The staged pack is added to the invoice, the item count increases and the Dispatch button becomes enabled.

---

**Actual Result:**
`POST /masar-service/api/v1/shipments/draft/{id}/add-packs` returns 404 Not Found, the UI shows no toast and no error, the count stays at "Invoice Items | 0 pack(s) total" and Dispatch remains permanently disabled.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Endpoint: POST /masar-service/api/v1/shipments/draft/{draftId}/add-packs
Draft used: QA-20260902-SHIP-002 to Masrya (GLN 0847976000005)
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional / Integration
