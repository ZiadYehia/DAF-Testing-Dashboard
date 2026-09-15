---
title: >-
  [Receiving] Completing a receive fails with PORTAL_COMMAND_ENVELOPE_MALFORMED
  and the UI reports nothing, so custody can never transfer
status: draft
jira_key: null
reported_at: null
feature: web-receiving
priority: P1 – Critical
bug_type: Functional / Integration
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-09T07:13:00.000Z'
---
A distributor can scan an incoming shipment to 100% and press **Complete Receiving**, and nothing happens. `POST /portal/operations/receive/shipment/{id}` answers **202 Accepted**, but the operation then resolves to `{"status":"FAILED","retryable":false,"detail":"PORTAL_COMMAND_ENVELOPE_MALFORMED"}` and the shipment stays `dispatched` with `deliveredAt` and `receivedByUserId` both null. The interface shows no error, no toast and no change — the scan panel simply remains on screen as though the click never registered. Because custody only moves when the receiver confirms, this blocks the entire downstream chain: nothing can be received, so nothing can subsequently be shipped onward, returned or dispensed through the dashboard. `retryable: false` means retrying cannot help.

**Covers test cases:** `WEB_RCV_010`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8444.
2. Log in as the distributor testdistributor3@eptts.com and accept the access disclaimer.
3. Open https://192.168.225.195:8444/shipments/receive.
4. Filter the Search by SSCC field with the SSCC of a shipment dispatched to this distributor and press Search.
5. Click Receive on the matching row.
6. Type the same SSCC into the Focus and scan barcode field and press Enter, and confirm the panel reads "SSCC scanned successfully — packs included" and "1 / 1 item(s) scanned".
7. Click Complete Receiving and accept the "Confirm receiving all items?" dialog.
8. Read the network panel, then query GET /masar-service/api/v1/portal/operations/{operationId} with the session token.
9. Reload the receiving list and read the shipment status.

---

**Expected Result:**
The shipment is received, its status changes from dispatched to received or delivered, custody of the packs moves to the receiving party, and the interface confirms it.

---

**Actual Result:**
The operation resolves to `{"operationId":"01a08501-c071-7228-8519-2ab62063f81c","status":"FAILED","retryable":false,"detail":"PORTAL_COMMAND_ENVELOPE_MALFORMED","providerReference":null}`, the shipment remains `"status":"dispatched"` with `"deliveredAt":null` and `"receivedByUserId":null`, and the interface displays nothing at all.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`, client `masar-dashboard`)
Tenant: devsim, receiving as testdistributor3@eptts.com (role distributor, GLN 5413868000108, entity Test Distributor)
Endpoints: POST /masar-service/api/v1/shipments/receive/{shipmentId}/start returns 200; POST /masar-service/api/v1/portal/operations/receive/shipment/{shipmentId} returns 202; GET /masar-service/api/v1/portal/operations/{operationId} then reports FAILED
Shipment used: id 01a0836b-7f48-7b20-9949-b5f94b2018b8, invoice QA-SHIP-ZTGMTTBKC5S4D9, SSCC 254138684176500015, 4 packs of GTIN 05413868110449, dispatched 2026-09-08T23:47:36.607Z from GLN 5413868000009
Operation id: 01a08501-c071-7228-8519-2ab62063f81c
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional / Integration
