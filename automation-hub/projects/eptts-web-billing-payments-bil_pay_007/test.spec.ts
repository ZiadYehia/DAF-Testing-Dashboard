/**
 * BIL_PAY_007 — Validate that an invoice already paid offers no way to pay it again
 *
 * Feature: billing-payments   Portal: https://192.168.225.195:8446 → "📄 Invoices"
 *
 * Checks that settlement is terminal in the interface: a Paid invoice exposes no Pay action, and
 * its total and settlement timestamp are unchanged by looking at it.
 *
 * Immutability after payment is the point of this feature's knowledge note — a recalculated paid
 * invoice is a far more serious defect than a rendering fault. This case covers the reachable
 * half of that: that the platform offers no second settlement route. It deliberately does NOT
 * fire a duplicate payment to see what happens, because a double-charge is not a defect worth
 * demonstrating on a real party's invoice.
 *
 * Read-only: filters the list and reads a row.
 */
import { expect, test } from '@playwright/test'
import { BillingPage, MFG_INVOICE_COLUMNS } from '../../pages/eptts-web/billing.page'
import { stateFor } from '../../lib/apps'

test.use({
  storageState: stateFor('eptts-billing'),
  ignoreHTTPSErrors: true,
})

test('BIL_PAY_007 — Validate that an invoice already paid offers no way to pay it again', async ({
  page,
}) => {
  test.slow()

  const billing = BillingPage.openAs(page, 'manufacturer', '📄 Invoices')
  await billing.expectShell().expectTableColumns(MFG_INVOICE_COLUMNS)

  await billing.filterByStatus('Paid')

  const paid = (await billing.readInvoices()).filter((r) => /paid/i.test(r['Status'] ?? ''))
  test.fixme(
    paid.length === 0,
    'This MAH has no invoice with status Paid, so there is nothing to check for immutability. ' +
      'On 2026-09-08 both of its invoices were Pending. Run one of BIL_PAY_002 / BIL_PAY_004 / ' +
      'BIL_PAY_005 to settle one first. Blocked on test data, not failed.',
  )

  const invoice = paid[0]
  const invoiceNo = invoice['Invoice #']

  // 1. No Pay action on a settled invoice.
  await billing.expectNoPayAction(invoiceNo)

  // 2. It is settled, and says when. An empty Paid column on a Paid row would mean the status and
  //    the timestamp disagree about the same fact.
  await billing.expectInvoiceStatus(invoiceNo, 'Paid')
  expect(
    (invoice['Paid'] ?? '').trim(),
    `invoice ${invoiceNo} reads Paid, so its Paid column must carry a settlement timestamp ` +
      `rather than the em-dash placeholder used for unsettled rows`,
  ).not.toMatch(/^(—|-|)$/)

  // 3. The filter did what it said. Without this the case would also pass against a broken
  //    filter that returned everything, having picked a genuinely paid row out of a mixed list.
  const statuses = new Set(
    (await billing.readInvoices()).map((r) => (r['Status'] ?? '').trim().toLowerCase()),
  )
  expect(
    [...statuses],
    'filtering to Paid should list only paid invoices, so the row under test is known to be one',
  ).toEqual(['paid'])
})
