/**
 * BIL_PAY_002 — Validate that a pending invoice can be paid by Geidea card payment and is then recorded as paid
 *
 * Feature: billing-payments   Portal: https://192.168.225.195:8446 → "📄 Invoices" → "💰 Pay"
 *
 * Checks the third settlement route and the only one that involves a payment service provider:
 * choosing Geidea creates a hosted checkout for the invoice, and completing it marks the invoice
 * paid.
 *
 * IT IS AUTOMATABLE BECAUSE THE PSP IS STUBBED, AND THAT IS THE PLATFORM'S OWN STATEMENT. The
 * Configuration page's admin help reads: "Geidea: redirects to hosted checkout (works in stub mode
 * if GEIDEA_ENABLED=false)". So on a tenant without a live PSP no real card is involved. If that
 * ever changes — if this lands on a genuine Bank Masr card form — the case blocks itself with that
 * as the reason rather than attempting to enter card details, because a test suite has no business
 * making a real card payment.
 *
 * TWO THINGS THAT MAKE THIS DIFFERENT FROM THE OTHER PAYMENT CASES:
 *  - CARD PAYMENT ADDS AN ESERVICE FEE. The confirm has two forms, `confirmPayHosted` and
 *    `confirmPayHostedWithFee`, so the amount charged can exceed the invoice's own total. The
 *    assertions below therefore check the invoice becomes Paid and that its BILLING CHARGE is
 *    unchanged, rather than that the total never moved.
 *  - GEIDEA IS MAH-ONLY. `errGeideaSupport` reads "Geidea checkout cannot be initiated by support
 *    — ask the MAH user to run that flow", so this runs as the manufacturer even though an admin
 *    can see the button.
 *
 * WRITES TO PRODUCTION IF THE PLATFORM LETS IT: it settles a real invoice through a payment
 * gateway, and there is no unpay. Gated behind EPTTS_ALLOW_PAYMENT_WRITE, and it targets the
 * lowest-value pending invoice belonging to this MAH.
 */
import { expect, test } from '@playwright/test'
import { BillingPage, MFG_PAYMENT_METHODS } from '../../pages/eptts-web/billing.page'
import { stateFor } from '../../lib/apps'

test.use({
  storageState: stateFor('eptts-billing'),
  ignoreHTTPSErrors: true,
})

/** Money as cents, from a cell like "28.00 EGP". */
function cents(cell: string): number {
  const m = /(\d+(?:\.\d+)?)/.exec((cell ?? '').replace(/,/g, ''))
  return m ? Math.round(Number(m[1]) * 100) : Number.POSITIVE_INFINITY
}

test('BIL_PAY_002 — Validate that a pending invoice can be paid by Geidea card payment and is then recorded as paid', async ({
  page,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_PAYMENT_WRITE,
    'Settles a real invoice through the Geidea gateway on the shared devsim tenant, and there is ' +
      'no unpay. Set EPTTS_ALLOW_PAYMENT_WRITE=1 in automation-hub/.env for a deliberate run.',
  )

  const billing = BillingPage.openAs(page, 'manufacturer', '📄 Invoices')
  await billing.expectShell()

  const pending = (await billing.readInvoices())
    .filter((r) => /pending/i.test(r['Status'] ?? ''))
    .sort((a, b) => cents(a['Total'] ?? '') - cents(b['Total'] ?? ''))

  test.fixme(
    pending.length === 0,
    'No invoice with status Pending exists for this MAH, so there is nothing to pay. Run ' +
      'WEB_CSV_009 to raise one by importing a packing CSV. Blocked on test data, not failed.',
  )

  const invoice = pending[0]
  const invoiceNo = invoice['Invoice #']
  const chargeBefore = invoice['Billing charge']

  test.info().annotations.push({
    type: 'settled-on-production',
    description: `paying invoice ${invoiceNo} (${invoice['Total']}) through the Geidea gateway`,
  })

  await billing.openPayDialog(invoiceNo)

  // 1. Geidea is on offer for this role at all.
  await billing.expectPaymentMethods(MFG_PAYMENT_METHODS)

  // 2. Follow it as far as it goes. payByGeidea reports where it ended up rather than assuming.
  const outcome = await billing.payByGeidea(invoiceNo)

  // 3. If it left the portal, the stub was not in play — that is a real hosted gateway page, and
  //    this case stops rather than trying to pay with a card. Reported as blocked, with the URL,
  //    because that is a fact about the environment and not a defect.
  test.fixme(
    outcome.leftPortal,
    `Geidea redirected off the billing portal to ${outcome.url}, so the PSP is NOT in stub mode ` +
      `on this tenant. Completing it would mean entering real card details, which this suite ` +
      `will not do. Set GEIDEA_ENABLED=false (the platform's own help says the flow then works ` +
      `in stub mode) or point the tenant at a Geidea test gateway. Blocked on environment ` +
      `configuration, not failed.`,
  )

  // 4. Stub mode: the invoice settles without leaving the portal.
  expect(
    outcome.paid,
    `invoice ${invoiceNo} should be Paid after the Geidea checkout completed in stub mode. ` +
      `The flow ended on ${outcome.url} with the invoice still unsettled. The portal said: ` +
      `${outcome.message}`,
  ).toBe(true)

  await billing.waitForInvoiceStatus(invoiceNo, 'Paid')

  const after = (await billing.readInvoices()).find((r) => r['Invoice #'] === invoiceNo)
  expect(
    (after?.['Paid'] ?? '').trim(),
    `invoice ${invoiceNo} should carry a settlement timestamp once paid`,
  ).not.toMatch(/^(—|-|)$/)

  // 5. The underlying charge is unchanged. Deliberately NOT the total: a card payment may add an
  //    eService fee on top, which is a legitimate difference, whereas the billing charge itself
  //    moving would mean settlement had re-priced the invoice.
  expect(
    after?.['Billing charge'],
    `settling ${invoiceNo} by card must not change what it charges for the packing itself. An ` +
      `eService fee may legitimately be added to the total, but the billing charge is fixed.`,
  ).toBe(chargeBefore)

  // 6. And it cannot be paid twice.
  await billing.expectNoPayAction(invoiceNo)
})
