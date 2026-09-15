# billing-payments — Feature Knowledge

## Why this feature matters

This is where money reaches the platform, and where the billing hold is released. Settlement is
not only a financial record: under Enforce mode an unpaid invoice blocks shipping, so a payment
that reports success without settling stops product moving, and one that settles without being
paid lets it move for free.

## What will bite you

- **`💰 Pay` is invisible to Platform Admin.** It renders only for the MAH that owes the
  invoice. If you go looking for the payment surface as an admin you will conclude it does not
  exist — which is exactly what happened, and why this feature was undocumented until
  2026-09-08 despite the billing portal having been discovered on 2026-08-31.
- **There are three methods, not two.** `GEIDEA`, `BANK_TRANSFER` and `MANUAL` all exist in the
  portal bundle, with i18n keys `geideaBtn`, `manualBtn`, `confirmManual`, `toastManualPaid`,
  `toastManualPaidMany` — and `errManualRestricted`. Manual is role-restricted and absent from
  the manufacturer's `payment-methods` response.
- **Bank transfer spans two roles and two sessions.** The manufacturer submits a reference,
  date, amount and a mandatory receipt; the invoice stays `Pending`; an admin then approves or
  rejects. A case that submits a transfer and asserts `Paid` is asserting the wrong thing.
- **Assert the dialog against the API, not against a list.** `GET /billing/payment-methods`
  decides what may be offered, per invoice and per role. Hardcoding the two expected names would
  pass even if the platform had started offering a third — and an extra method appearing for a
  manufacturer is precisely the defect worth catching.
- **Compare payment methods as a set.** A per-method `toBeVisible()` loop cannot see an EXTRA
  method, and the interesting failure direction here is extra, not missing.
- **The portal has no URL routes.** Every screen is `/` with a different nav button clicked, so
  there is no direct-URL case to write and no route to survive a reload. Do not copy the
  `directUrl` case shape from the 8444 features.
- **`🏠 Dashboard` leaves the portal.** It is an `<a href>` to 8444, not a nav button. Clicking
  it mid-spec ends up on the main dashboard, which reads as a mysterious navigation failure.
- Verify `Billing charge + eService = Total` independently rather than trusting the displayed
  total, and confirm a `Paid` invoice cannot be re-totalled.

## What every case here has to account for

- **The Citrix VPN is a hard precondition.** Nothing on `192.168.225.195` resolves without it,
  and a dropped VPN looks exactly like a hung server: every request fails after a uniform ~10 s
  connect timeout. Rule that out before diagnosing anything.
- **TLS is a self-signed certificate.** Playwright needs `ignoreHTTPSErrors: true` (including in
  `browser.newContext()`, which does *not* inherit it from the config's `use` block), the
  Playwright MCP server needs `--ignore-https-errors`, curl needs `-k`.
- **This portal is a different Keycloak client.** Realm `masar`, client **`billing-portal`**
  (the dashboard uses `masar-dashboard`). Same realm, so the SSO cookie is shared, but a client
  misconfiguration can break this portal alone.
- **The portal serves its own API on its own port**:
  `https://192.168.225.195:8446/masar-service/api/v1` (`EPTTS_BILLING_API_URL`). Billing
  endpoints do not exist on 8444.
- **Every live devsim account is enrolled in TOTP**, so no login here can be scripted. Capture
  the session once by hand:
  `node automation-hub/scripts/capture-state.mjs --portal eptts-billing`, then read it with
  `capturedStateFor('eptts-billing', 'manufacturer')`. Projects for this feature are tagged
  `attended` so bulk runs exclude them.
- **Secrets never go in `data/`.** It is committed. Reference the env key name
  (`EPTTS_WEB_MFG_USERNAME`), never the value.

## Case history and provenance

### Where these cases came from

The source spreadsheet has no payment cases and neither did this repo — a case-insensitive
search for `geidea`, `bank transfer` and `payment method` across the whole project returned
nothing outside a Python lexer in the vendored venv. All seven cases were written from live
discovery on 2026-09-08, driven as the manufacturer, plus the portal bundle read for the method
codes and endpoint list.

### Verification status

**Not yet executed against production.** Every case is `Under Testing` / `new_added`.

### Open questions to settle before executing

- **`BIL_PAY_002` may not be automatable, and that is a legitimate outcome.** Geidea reports
  `supportsHostedCheckout: true` / `supportsDirectCharge: false`, so paying means a redirect to
  a Geidea-hosted card page with 3DS. If devsim points at Geidea's test mode with published test
  cards the case runs; if it is wired to live Bank Masr it cannot, and the case should be
  `test.fixme` with that reason rather than a card charged for a test. The bundle also carries
  the string `GEIDEA_ENABLED=false`, most likely the text of its unavailable message, so the
  feature may be off on this tenant entirely — though `payment-methods` did list it, which is
  weak evidence the other way. Settle it with one API read before authoring the body.
  Note the bundle distinguishes `toastGeideaCreated` from `toastGeideaSettled`, so a
  "checkout session created" assertion is available even if settlement is not.
- **`BIL_PAY_005` needs the admin-side manual surface located.** Manual is known to exist and to
  be role-restricted, but it was not observed: the admin view has not been walked since the
  payment surface was found. The bulk `POST /billing/invoices/settle` and the `settle-manual`
  control on the dues page are the likely entry point rather than a per-row action.
- **`BIL_PAY_004` needs the Bank Transfers view located.** The bundle carries a
  `tabBankTransfers` label and the approve/reject endpoints, but the admin nav was recorded
  before this feature existed and does not name it.

### DOM contracts, verified live 2026-09-08

Each of these was measured against the running portal while writing the specs, and each one had
already caused a wrong assertion before it was measured.

- **`innerText` is not the DOM text here.** The table headers carry
  `text-transform: uppercase`, so `allInnerTexts()` returns `INVOICE #`, `BILLING CHARGE`,
  `ESERVICE` while `textContent` — and therefore Playwright's text engine — sees `Invoice #`,
  `Billing charge`, `eService`. Status is the same: `<span class="tag pending_approval">Pending</span>`
  renders as `PENDING`. So a helper reading `allInnerTexts()` and a locator using `getByText`
  disagree about the same cell. Compare columns case-insensitively, canonicalise keys when
  reading rows as data, and match statuses with a case-insensitive anchored regex.
- **An empty result removes the whole `<table>`**, not just the rows. Filtering to `Paid` with no
  paid invoices leaves `document.querySelector('table') === null` and the message
  `🗂️ No invoices match the current filter.` A "columns are correct" assertion therefore cannot
  follow a filter that may match nothing.
- **The API authenticates with `Authorization: Bearer`, not cookies.** A fetch sent from the page
  with `credentials: 'include'` and no header is anonymous and refused `401` — which satisfies a
  naive "was it refused" assertion while proving nothing about role scoping. Any
  refusal-expected probe must reuse the session's own bearer, captured off the portal's traffic,
  and must treat `401` as a broken probe rather than a pass.
- **The bearer's claims are the identity to assert against**: `masar_role: "manufacturer"`,
  `entityGln: "5413868000009"`, `azp: "billing-portal"`, and an `mfa_required` realm role that
  is the TOTP enrolment showing up in the token.
- **The dialog is `div.dialog`**, with a sibling `div.dialog-backdrop`, and carries no
  `role="dialog"`. Narrow it by its heading rather than selecting the class alone.
- **Both dismiss controls are named "Cancel".** The `×` in the dialog header has
  `aria-label="Cancel"`, so `getByRole('button', { name: 'Cancel' })` matches two elements.
  Filtering the method list by `innerText` works (`×` vs `Cancel`); filtering by accessible name
  would drop only one of them.
- **`GET /billing/payment-methods?invoiceId=…` fires on every `💰 Pay` click**, so a spec can arm
  a response wait before clicking and assert the dialog against the platform's own answer.
- `#f-status` and `#f-search` are present for the manufacturer; `#f-gln` is not. The page carries
  exactly two `<select>` elements and the first is `#lang-switch`, so any positional fallback for
  the status filter switches the interface language instead of filtering.

### Invoices present when this feature was written

Two `Pending` invoices already existed for the manufacturer (GLN 5413868000009) on 2026-09-08:
`INV-20260908-000006` (1 piece, 7.00 EGP) and `INV-20260908-000002` (434 pieces, 3038.00 EGP).
Recorded because it means the payment cases do **not** depend on the CSV import running first,
and because a case that settles an invoice should prefer the cheap one — these are real charges
against a real party.
