/**
 * BIL_PAY_001 — Validate that the payment method chooser offers exactly the methods the platform reports as available for the acting role
 *
 * Feature: billing-payments   Portal: https://192.168.225.195:8446 → "📄 Invoices" → row "💰 Pay"
 *
 * Checks that the chooser is a faithful rendering of GET /billing/payment-methods rather than a
 * hardcoded list, and that manual payment is not among the options a manufacturer is given.
 *
 * The assertion is against the API response captured from this very page load, not against a
 * literal. A literal would still pass if the platform started offering a third method — and an
 * extra method appearing for a manufacturer is the defect most worth catching here, because
 * MANUAL exists in the portal bundle with an `errManualRestricted` message and is meant to be
 * unreachable for this role.
 *
 * Read-only: opens the chooser and cancels it. Nothing is paid. `💰 Pay` renders only for the
 * MAH that owes the invoice and only while it is PENDING, so this case is meaningless as any
 * other role — which is why every earlier discovery pass, run as Platform Admin, concluded the
 * payment surface did not exist.
 */
import { expect, test } from '@playwright/test'
import { BillingPage, MFG_PAYMENT_METHODS } from '../../pages/eptts-web/billing.page'
import { stateFor } from '../../lib/apps'

// The setup project logs in as the manufacturer for this portal and caches the state:
// data/eptts-billing/automation.json names EPTTS_WEB_MFG_USERNAME as its credential, so
// stateFor('eptts-billing') is a MANUFACTURER session, not an admin one. That is the whole
// point -- the payment surface does not render for an admin.
test.use({
  storageState: stateFor('eptts-billing'),
  ignoreHTTPSErrors: true,
})

interface MethodsResponse {
  invoiceId: string
  methods: { code: string; displayName: string }[]
}

test('BIL_PAY_001 — Validate that the payment method chooser offers exactly the methods the platform reports as available for the acting role', async ({
  page,
}) => {
  test.slow()

  const billing = BillingPage.openAs(page, 'manufacturer', '📄 Invoices')
  await billing.expectShell().expectHeading('Billing Portal')

  // Find a PENDING invoice from the rendered list rather than hardcoding a number: invoices are
  // real records on a shared tenant, and the one this suite raised last week may since have been
  // settled by somebody else.
  const invoices = await billing.readInvoices()
  const pending = invoices.find((r) => /pending/i.test(r['Status'] ?? ''))
  test.fixme(
    !pending,
    'No invoice with status Pending exists for this MAH, so there is nothing to open a payment ' +
      'chooser against. Run WEB_CSV_009 to raise one by importing a packing CSV. Blocked on test ' +
      'data, not failed.',
  )
  const invoiceNo = (pending as Record<string, string>)['Invoice #']

  // Capture the platform's own answer for THIS invoice. The chooser requests it when it opens,
  // so the wait is armed before the click.
  const methodsPromise = page.waitForResponse(
    (r) => r.url().includes('/billing/payment-methods') && r.request().method() === 'GET',
    { timeout: 30_000 },
  )

  await billing.openPayDialog(invoiceNo)

  const response = await methodsPromise
  expect(
    response.status(),
    `GET /billing/payment-methods should answer 200 for invoice ${invoiceNo}`,
  ).toBe(200)
  const body = (await response.json()) as MethodsResponse
  const offered = body.methods.map((m) => m.displayName)
  const codes = body.methods.map((m) => m.code)

  // 1. The dialog renders exactly what the platform offered — compared as a set, so an extra
  //    button fails as loudly as a missing one.
  await billing.expectPaymentMethods(offered)

  // 2. And what the platform offered is the documented pair for a manufacturer. Asserting both
  //    halves separately keeps the two failure modes distinguishable: the UI disagreeing with
  //    the API is a rendering defect, while the API itself returning a different set is a
  //    platform or entitlement change.
  expect(
    [...codes].sort(),
    `payment method codes offered to a manufacturer for invoice ${invoiceNo}`,
  ).toEqual(['BANK_TRANSFER', 'GEIDEA'])
  expect(
    [...offered].sort(),
    'the display names the chooser is expected to render',
  ).toEqual([...MFG_PAYMENT_METHODS].sort())

  // 3. Manual payment is absent. Stated as its own assertion because it is the security-relevant
  //    one: MANUAL is implemented and merely restricted, so its appearance here would be a
  //    privilege-scope defect rather than a cosmetic surprise.
  expect(
    codes,
    'MANUAL is an admin-only settlement route and must not be offered to a manufacturer',
  ).not.toContain('MANUAL')

  await billing.cancelPayDialog()

  // The invoice is left exactly as it was found.
  await billing.expectInvoiceStatus(invoiceNo, 'Pending')
})
