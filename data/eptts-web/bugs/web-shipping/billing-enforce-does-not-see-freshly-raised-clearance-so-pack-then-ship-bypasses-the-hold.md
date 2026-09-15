---
title: >-
  [Shipping] Billing mode Enforce only holds clearance that has already been
  invoiced, so the ordinary pack-then-ship sequence bypasses the hold
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
found_at: '2026-09-09T07:55:00.000Z'
---
Billing raises clearance on a slow, asynchronous sweep of unbilled packing operations, and `Enforce` can only hold a dispatch once that sweep has produced an unpaid invoice. Between packing and the sweep there is a window in which the stock exists, nothing is invoiced, and the hold has nothing to act on — so the dispatch goes through. That window is not an edge case: pack-then-ship is the normal working sequence, and the sweep was measured taking minutes to tens of minutes, so stock routinely leaves before the invoice covering it exists. Two dispatches were observed completing under a confirmed `enforce:true` posture within seconds of their clearance being raised, while the same dispatch against a balance that had been outstanding for hours was correctly refused with "Shipping blocked by unpaid invoices. Outstanding cents: 5600". The net effect is that the only control tying payment to product movement holds stale debt but not fresh debt, which is the opposite of what it is for.

**Covers test cases:** `WEB_SHP_012`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8446 as the Platform Admin.
2. Open Configuration, select "Enforce — block shipping on unpaid clearance", click Apply mode and accept the confirmation prompt.
3. Read GET /masar-service/api/v1/billing/posture on port 8446 and confirm it answers enforce true.
4. Open Invoices, filter MAH GLN 5413868000009, and settle every PENDING invoice with the Manual settlement action so the manufacturer owes nothing.
5. Open https://192.168.225.195:8444/import-jobs as the manufacturer janssen2@masar.com and upload a valid commissioning-and-packing CSV that commissions 4 SGTINs of GTIN 05413868110449 and packs them into one SSCC.
6. Wait for the import job to reach status completed with packsCreated 4 and aggregationsCreated 1.
7. Without waiting for billing, open https://192.168.225.195:8444/shipments, choose destination Test Distributor 5413868000108, enter an invoice number and click Start Invoice.
8. Scan the SSCC from step 5 into the draft, confirm the draft reads 4 pack(s) total, click Dispatch to Test Distributor and accept the unprinted-labels confirmation.
9. Read the result panel.
10. Open the Billing Portal Invoices tab and watch for the invoice covering those packs to appear, then note how long after the import it was raised.

---

**Expected Result:**
The dispatch is refused while the packing it created has not been paid for, whether or not billing has finished raising the invoice. The clearance a dispatch is held against should be determined by the operations themselves, so that the hold cannot be outrun by shipping promptly.

---

**Actual Result:**
The dispatch succeeds and the panel reports "Shipment dispatched successfully", and the invoice covering those packs appears only afterwards, in `PENDING`. Observed twice on 2026-09-08 under posture `{"mode":"enforce","record":true,"enforce":true,"serviceEnabled":true}`: SSCC 054138689833600011 against INV-20260908-000021 (raised 23:45:09Z, dispatched ~23:46) and SSCC 254138684176500015 against INV-20260908-000022 (raised 23:47:28Z, dispatched 23:47:36Z, i.e. 8 seconds later). The control itself is present and does work on aged debt: on 2026-09-09, with INV-20260909-000027 outstanding since 00:09:50Z, the same dispatch was refused with "Error Shipping blocked by unpaid invoices. Outstanding cents: 5600", and `WEB_SHP_009` passes on that path. The sweep interval was measured indirectly by watching INV-20260909-000027 grow 8 → 12 → 16 → 20 → 24 pieces, one 4-pack import per step, with each step appearing only after the run that caused it had finished; a 4-minute poll of the balance immediately after a completed import never saw it move.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Dashboard: https://192.168.225.195:8444 (Angular SPA, PrimeNG, Keycloak OIDC realm `masar`, client `masar-dashboard`)
Billing portal: https://192.168.225.195:8446 (Keycloak client `billing-portal`, own masar-service on the same port)
Tenant: devsim, shipping as janssen2@masar.com (role manufacturer, GLN 5413868000009), mode set as admin1@gmail.com (role admin)
Endpoints: POST /masar-service/api/v1/portal/operations/ship/draft/{draftId} on 8444 (202, resolved on /portal/operations/{id}/stream); GET /masar-service/api/v1/billing/posture on 8446 answers {"mode":"enforce","record":true,"enforce":true,"serviceEnabled":true,"source":"BILLING_MODE=enforce"}; GET /masar-service/api/v1/billing/invoices on 8446
Invoices are created by the settle path — every one carries an `idempotencyKey` of the form `settle:<hash>` — and the Unbilled Operations tab shows the packing operations awaiting that sweep, with no operator control to trigger it
Escapes observed: SSCC 054138689833600011 / INV-20260908-000021; SSCC 254138684176500015 / INV-20260908-000022
Hold observed working: INV-20260909-000027, 5600 cents outstanding
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P1 – Critical

---

**Bug Type:**
Functional / Integration
