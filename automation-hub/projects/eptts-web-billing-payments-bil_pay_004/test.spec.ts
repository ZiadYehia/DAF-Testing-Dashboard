/**
 * BIL_PAY_004 — Validate that approving a submitted bank transfer settles the invoice it was submitted against
 *
 * Feature: billing-payments   Portal: https://192.168.225.195:8446 → "🏦 Bank Transfers"
 *
 * Checks the finance half of the two-party bank-transfer flow: a claim sitting in "Pending
 * review" is approved, and the invoice it names becomes Paid with a settlement timestamp.
 *
 * Together with BIL_PAY_003 this is the whole mechanism — submit does not settle, approve does.
 * Splitting them is not bookkeeping: they are performed by different roles on different screens,
 * and the interesting defect (a submission settling an invoice on its own) lives in the gap.
 *
 * IT ONLY EVER APPROVES THIS SUITE'S OWN CLAIMS. The row is selected by a reference beginning
 * `QA-TEST-DO-NOT-PROCESS-`, which is what BIL_PAY_003 submits. Approving whatever happened to be
 * top of the queue would mean this test accepting a real partner's money claim against a real
 * invoice on a shared tenant — a far worse outcome than the case not running. If no such claim
 * exists it blocks and says to run BIL_PAY_003 first.
 *
 * WRITES TO PRODUCTION IF THE PLATFORM LETS IT, and this is the irreversible half: approval
 * settles a real invoice and releases its billing hold. There is no un-approve. Gated behind
 * EPTTS_ALLOW_PAYMENT_WRITE.
 */
import { expect, test } from '@playwright/test'
import { BANK_TRANSFER_COLUMNS, BillingPage } from '../../pages/eptts-web/billing.page'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import { requireEnv } from '../../lib/env'

// Built inside the test rather than via test.use, because ensureRoleState is async.
//
// stateFor('eptts-billing') would be WRONG here: data/eptts-billing/automation.json logs in as
// the manufacturer on purpose, so setup's state for this portal is a manufacturer session and
// the Bank Transfers nav item does not exist in it at all.
test.use({ ignoreHTTPSErrors: true })

/** What BIL_PAY_003 prefixes its reference with. The safety boundary for this case. */
const OURS = /^QA-TEST-DO-NOT-PROCESS-/

test('BIL_PAY_004 — Validate that approving a submitted bank transfer settles the invoice it was submitted against', async ({
  browser,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_PAYMENT_WRITE,
    'Irreversible: approving a bank transfer settles a real invoice on the shared devsim tenant ' +
      'and releases its billing hold, and there is no un-approve. Set ' +
      'EPTTS_ALLOW_PAYMENT_WRITE=1 in automation-hub/.env for a deliberate run.',
  )

  const context = await browser.newContext({
    storageState: await ensureRoleState('admin', 'eptts-billing'),
    ignoreHTTPSErrors: true,
  })

  try {
    const page = await context.newPage()
    const billing = BillingPage.openAs(page, 'admin', '🏦 Bank Transfers')

    await billing
      .expectShell()
      // Assert the role before anything else. Read as a manufacturer this whole screen is absent,
      // and "the Approve button is missing" would read as a defect rather than a wrong session.
      .expectIdentity(requireEnv('EPTTS_WEB_ADMIN_USERNAME'), 'admin')

    // Find OUR claim, awaiting review. Never simply the first row.
    //
    // THIS RUNS BEFORE THE COLUMN ASSERTION, DELIBERATELY. An empty queue removes the whole
    // <table> from the DOM, so asserting columns first turns "there is nothing to approve" into a
    // column mismatch whose entire diff is one empty string. It also broke the case on
    // Playwright's automatic retry: the first attempt approves the only claim, the retry finds the
    // queue drained, and a case that had already done its job reported a misleading failure.
    const rows = await billing.readTable(BANK_TRANSFER_COLUMNS)
    const ours = rows.filter(
      (r) => OURS.test(r['Reference #'] ?? '') && /pending/i.test(r['Status'] ?? ''),
    )

    test.fixme(
      ours.length === 0,
      'No bank transfer submitted by this suite is awaiting review, so there is nothing safe to ' +
        'approve — and approving somebody else\'s claim is not an option. Run BIL_PAY_003 first ' +
        'to submit one. Note this is also the expected state immediately AFTER a successful run, ' +
        'because approving consumes the claim. Blocked on test data, not failed.',
    )

    // Safe to assert now: our claim is present, so the table is too.
    await billing.expectTableColumns(BANK_TRANSFER_COLUMNS)

    const claim = ours[0]
    const reference = claim['Reference #']
    const invoiceNo = claim['Invoice #']
    const amount = claim['Amount']

    test.info().annotations.push({
      type: 'settled-on-production',
      description: `approved bank transfer "${reference}" for ${amount}, settling invoice ${invoiceNo}`,
    })

    // Sanity-check the pairing before acting on it. The claim carries the invoice it settles, and
    // approving a row whose invoice number we misread would settle the wrong debt.
    expect(
      invoiceNo,
      'the claim should name the invoice it settles, so the assertion below checks the right one',
    ).toMatch(/^INV-/)

    await billing.expectBankTransferStatus(reference, 'Pending review')
    await billing.approveBankTransfer(reference)

    // 1. The claim is no longer awaiting review.
    await expect
      .poll(
        async () => {
          const now = (await billing.readTable(BANK_TRANSFER_COLUMNS)).find(
            (r) => r['Reference #'] === reference,
          )
          return (now?.['Status'] ?? '').trim().toLowerCase()
        },
        {
          timeout: 30_000,
          message: `bank transfer ${reference} should leave "Pending review" once approved`,
        },
      )
      .not.toMatch(/pending/)

    // 2. AND THE INVOICE IS NOW SETTLED. The claim changing state is not the point — the point is
    //    that the debt it names is discharged.
    //
    //    Polled, not asserted once. Approval returns before the invoice flips, and the invoice
    //    list does not refresh itself, so a single expect against the rendered table failed while
    //    the platform was behaving correctly: the settlement landed just after the 10s assertion
    //    window, and the stale table would not have shown it even later.
    await billing.waitForInvoiceStatus(invoiceNo, 'Paid')

    const invoice = (await billing.readInvoices()).find((r) => r['Invoice #'] === invoiceNo)
    expect(
      (invoice?.['Paid'] ?? '').trim(),
      `invoice ${invoiceNo} should carry a settlement timestamp now that its transfer is ` +
        `approved, not the em-dash placeholder used for unsettled rows`,
    ).not.toMatch(/^(—|-|)$/)

    // 3. And it can no longer be paid again.
    await billing.expectNoPayAction(invoiceNo)
  } finally {
    await context.close()
  }
})
