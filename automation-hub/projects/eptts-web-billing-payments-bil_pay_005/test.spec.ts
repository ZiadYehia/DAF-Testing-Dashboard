/**
 * BIL_PAY_005 — Validate that Platform Admin can settle a pending invoice by manual payment
 *
 * Feature: billing-payments   Portal: https://192.168.225.195:8446 → "📄 Invoices" → "💰 Pay"
 *
 * Checks the third settlement route: an admin records a payment received outside the platform,
 * and the invoice becomes Paid with the payment recorded against it.
 *
 * `Manual settlement (admin)` is the method the server withholds from a manufacturer behind
 * `errManualRestricted`. BIL_PAY_006 asserts its absence for that role; this case asserts its
 * presence and effect for an admin. Together they pin the entitlement from both sides, which is
 * stronger than either alone — a method that had silently become available to everyone would
 * still pass BIL_PAY_005.
 *
 * IT ONLY EVER SETTLES OUR OWN MAH'S INVOICE. An admin sees EVERY MAH's invoices here, and the
 * cheapest pending one on the tenant usually belongs to somebody else. The row is therefore
 * selected by `MAH GLN === EPTTS_WEB_MFG_GLN`. Paying a stranger's invoice would be a far worse
 * outcome than the case not running.
 *
 * WRITES TO PRODUCTION IF THE PLATFORM LETS IT, irreversibly: settlement discharges a real debt
 * and releases the billing hold that Enforce mode uses to block shipping. There is no unpay.
 * Gated behind EPTTS_ALLOW_PAYMENT_WRITE.
 */
import { expect, test } from '@playwright/test'
import { ADMIN_PAYMENT_METHODS, BillingPage } from '../../pages/eptts-web/billing.page'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import { requireEnv } from '../../lib/env'

// Built inside the test because ensureRoleState is async. stateFor('eptts-billing') would be the
// MANUFACTURER session — data/eptts-billing/automation.json logs in as the MAH on purpose — and
// manual settlement is not offered to that role at all.
test.use({ ignoreHTTPSErrors: true })

/** Money as cents, from a cell like "4634.00 EGP". */
function cents(cell: string): number {
  const m = /(\d+(?:\.\d+)?)/.exec((cell ?? '').replace(/,/g, ''))
  return m ? Math.round(Number(m[1]) * 100) : Number.POSITIVE_INFINITY
}

test('BIL_PAY_005 — Validate that Platform Admin can settle a pending invoice by manual payment', async ({
  browser,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_PAYMENT_WRITE,
    'Irreversible: manual settlement discharges a real invoice on the shared devsim tenant and ' +
      'releases its billing hold. There is no unpay. Set EPTTS_ALLOW_PAYMENT_WRITE=1 in ' +
      'automation-hub/.env for a deliberate run.',
  )

  const ourGln = requireEnv('EPTTS_WEB_MFG_GLN')

  const context = await browser.newContext({
    storageState: await ensureRoleState('admin', 'eptts-billing'),
    ignoreHTTPSErrors: true,
  })

  try {
    const page = await context.newPage()
    const billing = BillingPage.openAs(page, 'admin', '📄 Invoices')

    await billing
      .expectShell()
      .expectIdentity(requireEnv('EPTTS_WEB_ADMIN_USERNAME'), 'admin')

    // Our MAH's pending invoices only, cheapest first. The MAH GLN column exists only in the
    // admin view, which is exactly why this scoping is possible here and unnecessary elsewhere.
    const ours = (await billing.readInvoices())
      .filter((r) => (r['MAH GLN'] ?? '') === ourGln && /pending/i.test(r['Status'] ?? ''))
      .sort((a, b) => cents(a['Total'] ?? '') - cents(b['Total'] ?? ''))

    test.fixme(
      ours.length === 0,
      `No pending invoice exists for MAH ${ourGln}, so there is nothing of ours to settle — and ` +
        `settling another MAH's invoice is not an option. Run WEB_CSV_009 to raise one by ` +
        `importing a packing CSV. Blocked on test data, not failed.`,
    )

    const invoice = ours[0]
    const invoiceNo = invoice['Invoice #']
    const total = invoice['Total']
    const pieces = invoice['Pieces']

    test.info().annotations.push({
      type: 'settled-on-production',
      description:
        `manually settled invoice ${invoiceNo} for MAH ${ourGln}: ${total} across ${pieces} ` +
        `pieces. Irreversible.`,
    })

    await billing.openPayDialog(invoiceNo)

    // 1. Admin is offered all three methods, manual among them. Compared as a set so a method
    //    quietly disappearing fails as loudly as one appearing.
    await billing.expectPaymentMethods(ADMIN_PAYMENT_METHODS)

    // 2. Settle it. choosePaymentMethod accepts the native confirm() this raises — without that
    //    the click is a silent no-op, which is the trap documented on acceptNextConfirm.
    await billing.choosePaymentMethod('Manual settlement (admin)')

    // 3. The invoice is Paid. Polled: settlement is asynchronous and the list does not refresh
    //    itself, so a single assertion fails against a platform that is behaving correctly.
    await billing.waitForInvoiceStatus(invoiceNo, 'Paid')

    const after = (await billing.readInvoices()).find((r) => r['Invoice #'] === invoiceNo)
    expect(
      (after?.['Paid'] ?? '').trim(),
      `invoice ${invoiceNo} should carry a settlement timestamp once paid, not the em-dash ` +
        `placeholder used for unsettled rows`,
    ).not.toMatch(/^(—|-|)$/)

    // 4. The amount did not move. A settlement that also re-totalled the invoice would be a far
    //    more serious defect than one that failed outright, and this feature's knowledge note
    //    calls it out specifically: a recalculated paid invoice is the worst case here.
    expect(
      after?.['Total'],
      `settling ${invoiceNo} must not change what it charges`,
    ).toBe(total)
    expect(after?.['Pieces'], `settling ${invoiceNo} must not change its piece count`).toBe(pieces)

    // 5. And it can no longer be paid.
    await billing.expectNoPayAction(invoiceNo)
  } finally {
    await context.close()
  }
})
