---
title: >-
  [Transfer History] The page never queries for shipments on load, so it always
  opens looking as though no shipments exist
status: draft
jira_key: null
reported_at: null
feature: web-transfer-history
priority: P2 – High
bug_type: Functional
parent_key: null
severity: ''
layer: frontend
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-02T14:10:00.000Z'
---
Opening `/shipments/history` issues exactly one request, `GET /masar-service/api/v1/users/me`, and never asks for any shipment. The table renders its ten column headers and the paginator reading "Rows per page 25 / Page 1" above zero rows, which is indistinguishable from a tenant that has never shipped anything. Touching the status filter fires `GET /masar-service/api/v1/shipments?limit=25` and twenty-five shipments appear immediately, so the data was always available and the page simply never asked for it. An operator opening Transfer History to check a consignment is told, wrongly, that there is nothing to see.

**Covers test cases:** `WEB_THS_010`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as admin@devsim.local.
3. Open the browser developer tools on the Network tab and clear it.
4. Enter https://192.168.225.195:8444/shipments/history in the address bar.
5. Wait for the page to settle and read the list of requests it issued.
6. Observe the table body and the paginator.
7. Open the status filter and select In Transit.
8. Observe the requests again and the table body.

---

**Expected Result:**
The page queries for shipments on load and displays the existing consignments, or states explicitly that a filter has to be chosen first.

---

**Actual Result:**
On load the page issues only GET /users/me and shows an empty table with a paginator, then selecting a status fires GET /shipments?limit=25 and reveals 25 shipments that existed all along.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`)
Tenant: devsim, logged in as admin@devsim.local (role admin, GLN 9999999999999)
Endpoint: GET /masar-service/api/v1/shipments?limit=25
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional
