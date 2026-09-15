---
title: >-
  [Billing] Paying an invoice by Geidea card returns HTTP 500, so the card
  payment route is unusable and only bank transfer or manual settlement work
status: draft
jira_key: null
reported_at: null
feature: billing-payments
priority: P2 – High
bug_type: Functional (Backend/API)
parent_key: null
severity: ''
layer: unknown
jira_status: ''
jira_reporter: ''
found_by: Ziad Yehia
found_at: '2026-09-09T00:20:30.000Z'
---
Choosing **Geidea (Bank Masr) — Credit/Debit Card** on a pending invoice fails outright. `POST /masar-service/api/v1/billing/invoices/{id}/pay` with gateway `GEIDEA` answers **500 Internal Server Error**, the portal shows only a `Error: Internal server error` toast, no hosted checkout is created, no redirect happens and the invoice stays `Pending`. One of the three settlement routes the platform advertises is therefore unusable, leaving bank transfer (which needs finance approval) and manual settlement (admin only) as the only ways any MAH can clear a billing hold. The message carries no detail beyond the correlation id, so a MAH user has nothing to act on.

**Covers test cases:** `BIL_PAY_002`

---

**Steps to Reproduce:**

1. Connect the Citrix VPN and open https://192.168.225.195:8446.
2. Log in as the manufacturer janssen2@masar.com.
3. Open the Invoices tab and locate an invoice whose status is Pending.
4. Click the 💰 Pay action on that invoice.
5. Confirm the chooser lists Geidea (Bank Masr) — Credit/Debit Card and Bank Transfer.
6. Click Geidea (Bank Masr) — Credit/Debit Card.
7. Accept the browser confirmation asking to pay the invoice via the hosted payment page.
8. Watch the network request to /billing/invoices/{id}/pay, the toast area, and the invoice status.

---

**Expected Result:**
The platform creates a Geidea hosted checkout for the invoice and redirects the browser to it, per the Configuration page's own help text which states that Geidea redirects to hosted checkout and works in stub mode when GEIDEA_ENABLED is false.

---

**Actual Result:**
`POST /masar-service/api/v1/billing/invoices/{id}/pay` answers `500 {"statusCode":500,"path":"/masar-service/api/v1/billing/invoices/b8a6ac65-d7b9-4fdb-8915-b4ad221e9657/pay","method":"POST","correlationId":"65a338e3-47da-4d6b-aa2f-4c595f174030","message":"Internal server error"}`, the portal shows a toast reading "Error: Internal server error", no redirect occurs and the invoice remains Pending.

---

**Environment:**
Platform: Web (Chromium 152) via Citrix VPN
Billing portal: https://192.168.225.195:8446 (Keycloak client `billing-portal`, own masar-service on the same port)
Tenant: devsim, logged in as janssen2@masar.com (role manufacturer, GLN 5413868000009)
Endpoint: POST /masar-service/api/v1/billing/invoices/{invoiceId}/pay with gateway GEIDEA
Invoice used: INV-20260909-000027, 4 pieces, 28.00 EGP, status Pending, id b8a6ac65-d7b9-4fdb-8915-b4ad221e9657
Correlation id: 65a338e3-47da-4d6b-aa2f-4c595f174030
Comparison: the same invoice settles correctly through Manual settlement (admin) and a bank transfer submits correctly, so the failure is specific to the GEIDEA gateway
Billing posture at the time: {"mode":"advisory","record":true,"enforce":false,"serviceEnabled":true}
TLS: self-signed certificate (clients must ignore certificate errors)

---

**Priority:**
P2 – High

---

**Bug Type:**
Functional (Backend/API)
