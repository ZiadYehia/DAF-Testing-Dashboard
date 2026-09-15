# Invoice Payment — Dashboard Workflow

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | Invoice Payment |
| **Slug** | `billing-payments` |
| **Feature ID** | `EPTTS_BIL_06` |
| **Module** | Billing Portal |
| **Portal** | https://192.168.225.195:8446 |
| **Route** | `Invoices` → per-row `💰 Pay` |
| **Text direction** | ltr |
| **Priority** | P1 |

## Business Purpose

How money actually reaches the platform. A pending invoice is settled here, by card through
Geidea, by bank transfer with a receipt an admin then approves, or by an admin recording a manual
payment. Settlement also releases the billing hold that blocks shipping when the tenant is in
Enforce mode, so a defect here does not just misstate a balance — it stops product moving.

## Why this is a separate feature from `billing-invoices`

`billing-invoices` is a financial *record*: a list, its columns, its filters and its arithmetic.
Payment is a *transaction* with its own two dialogs, its own eight endpoints, a mandatory file
upload, a second actor who approves, and a role-restricted third method. Folding it into the
invoice list would put a two-role approval workflow in a feature about a table.

## THE ROLE DECIDES WHAT EXISTS HERE

This is the first thing to know about this feature, and the reason it went undocumented until
2026-09-08. Every earlier discovery pass on this portal ran as Platform Admin, and **`💰 Pay`
does not render for an admin at all** — it appears only for the MAH that owes the invoice. The
admin-era record of the Invoices row actions (`📋 Details`, `CSV`, `PDF`) was accurate for that
role and simply had no payment surface in it.

| | as Platform Admin | as the manufacturer |
|---|---|---|
| Nav items | 5 (adds `📊 Reports`, `⚙️ Configuration`) | 3 |
| Invoices columns | 10 (includes `MAH GLN`) | 9 (no `MAH GLN`) |
| Invoices filters | search, status, MAH GLN, from, to | search, status, from, to |
| Row actions on a Pending invoice | Details, CSV, PDF | Details, CSV, PDF, **`💰 Pay`** |
| Manual payment | available | **refused** (`errManualRestricted`) |

So "the control is not there" is a statement about a role, not a defect, and any case here must
say which role it looked as.

## UI Elements

| Element | Type | Detail |
|---------|------|--------|
| Billing Portal | Heading | h1, both roles |
| 🏠 Dashboard | Link | **leaves the portal** — an `<a href>` to https://192.168.225.195:8444 |
| 🧾 Unbilled Operations | Button / action | — |
| 📄 Invoices | Button / action | — |
| Language | select | options: English, العربية. Already English on load |
| `<email> · <role>` | Text | header identity badge, e.g. `… · manufacturer` |
| Logout | Button / action | — |
| 💰 Pay | Button / action | per row, **Pending invoices only, MAH role only** |
| 📋 Details | Button / action | per row; opens payment history |
| CSV / PDF | Button / action | per row |
| Choose a payment method | Heading | h3, the chooser dialog |
| Geidea (Bank Masr) — Credit/Debit Card | Button / action | in the chooser |
| Bank Transfer | Button / action | in the chooser |
| Cancel | Button / action | twice in the chooser — a `×` in the header and a footer button |

### The bank transfer dialog

Displays (read-only): beneficiary name, beneficiary address, bank name, account number, IBAN,
SWIFT code. Collects: `referenceNumber`, `transferDate`, `amountCents`, and
`receiptStorageKey` — **a receipt upload is mandatory**, obtained through a presigned URL.

## Happy Path

1. Connect the Citrix VPN and open https://192.168.225.195:8446.
2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`, then `#otp`).
3. Click **Invoices**.
4. Find a row whose Status is `Pending` and click **💰 Pay**.
5. Choose a method and complete it.
6. The invoice Status becomes `Paid` and the `Paid` column carries a timestamp.

## API calls observed

Captured from the browser on 2026-09-08. Note the base: the billing portal serves its **own**
`masar-service` on port 8446, and none of these exist on 8444.

```
GET  /masar-service/api/v1/billing/invoices?limit=50
GET  /masar-service/api/v1/billing/outstanding-dues
GET  /masar-service/api/v1/billing/payment-methods?invoiceId=<uuid>
POST /masar-service/api/v1/billing/invoices/{id}/pay
POST /masar-service/api/v1/billing/invoices/settle
POST /masar-service/api/v1/billing/invoices/{id}/bank-transfer/receipt-upload-url
GET  /masar-service/api/v1/billing/bank-transfers?status=...
GET  /masar-service/api/v1/billing/bank-transfers/{id}/receipt-url
POST /masar-service/api/v1/billing/bank-transfers/{id}/approve
POST /masar-service/api/v1/billing/bank-transfers/{id}/reject
POST /masar-service/api/v1/billing/invoices/{id}/resend-notification
```

`GET /billing/payment-methods` is the authority on what may be offered, and it answers per
invoice and per role. For the manufacturer it returned `GEIDEA` and `BANK_TRANSFER` with full
capability metadata — Geidea as `supportsHostedCheckout: true`, `supportsDirectCharge: false`,
3DS, refunds, currencies EGP/USD/EUR/SAR/AED; Bank Transfer with every capability false and
currency `*`. Asserting the dialog against this response, rather than against a hardcoded list,
is what makes `BIL_PAY_001` meaningful.

## Edge Cases & Validation Rules

- **Role isolation** — manual payment must be refused by the platform for a non-admin role, not
  merely hidden from the chooser.
- **A paid invoice is immutable** — no Pay action, no second payment, no re-totalling.
- **A submitted bank transfer is not a payment** — the invoice stays `Pending` until an admin
  approves, and a rejected transfer must leave it `Pending` with the rejection reason readable.
- **Settlement releases the billing hold** — under Enforce mode, shipping is blocked while an
  invoice is unpaid and must succeed once it is paid.
- **Backend failure** — a failing payment call must surface an error, never leave the row
  looking settled.

## Notes

- Documented from live discovery against production on 2026-09-08, **as the manufacturer** —
  the role that can see this surface. UI elements above are what the page actually rendered,
  not a specification.
- The Keycloak client for this portal is **`billing-portal`**, not `masar-dashboard`. Same realm
  (`masar`), so the SSO cookie is shared across 8444/8445/8446.
- **Every live devsim account is enrolled in TOTP**, so these cases cannot run unattended. The
  session is captured once by hand with `automation-hub/scripts/capture-state.mjs`.
- Test cases are all `new_added` — none has been executed yet.
