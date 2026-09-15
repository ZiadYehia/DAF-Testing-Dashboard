/**
 * BIL_PAY_003 — Validate that a bank transfer can be submitted against a pending invoice and is held for approval without settling it
 *
 * Feature: billing-payments   Portal: https://192.168.225.195:8446 → "📄 Invoices" → "💰 Pay" → "Bank Transfer"
 *
 * Checks the manufacturer's half of the two-party bank-transfer flow: the form states the debt
 * and where to send the money, the claim submits, and — the part worth testing — the invoice does
 * NOT become Paid.
 *
 * THAT LAST ASSERTION IS THE POINT. A submitted transfer is a claim awaiting finance review, not
 * a payment. If the invoice flipped to Paid on submission, an unverified claim would release the
 * billing hold and let stock ship against money that never arrived. BIL_PAY_004 covers the
 * admin-side approval that legitimately does settle it.
 *
 * WRITES TO PRODUCTION IF THE PLATFORM LETS IT. This submits a real bank-transfer record into a
 * real finance queue on the shared devsim tenant, with a synthetic reference and a generated
 * receipt image. It does not move money and does not settle the invoice, but somebody will see
 * the claim — so the reference is prefixed to make it obviously test data, and the case is gated
 * behind EPTTS_ALLOW_PAYMENT_WRITE.
 *
 * It targets the LOWEST-VALUE pending invoice on purpose: if the platform is wrong about not
 * settling, the exposure should be as small as the tenant allows.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { expect, test } from '@playwright/test'
import { BillingPage } from '../../pages/eptts-web/billing.page'
import { stateFor } from '../../lib/apps'
import { runId } from '../../lib/eptts-api'

// The setup project logs in as the manufacturer for this portal, which is the role that owes the
// invoice and therefore the only one that sees "💰 Pay" at all.
test.use({
  storageState: stateFor('eptts-billing'),
  ignoreHTTPSErrors: true,
})

/** Money as cents, from a cell like "3038.00 EGP", for choosing the cheapest invoice. */
function cents(cell: string): number {
  const m = /(\d+(?:\.\d+)?)/.exec((cell ?? '').replace(/,/g, ''))
  return m ? Math.round(Number(m[1]) * 100) : Number.POSITIVE_INFINITY
}

/**
 * A real 1x1 PNG, written per run.
 *
 * The receipt input accepts `.jpg,.jpeg,.png,.pdf` by MIME type as well as extension, so a text
 * file renamed to .png would be a different test — one about upload validation, not about the
 * transfer flow. These are the actual bytes of a minimal valid PNG, so a rejection here means the
 * upload path is broken rather than that the fixture was never an image.
 */
function writeReceipt(): string {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  )
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eptts-receipt-'))
  const file = path.join(dir, `qa-transfer-receipt-${runId()}.png`)
  fs.writeFileSync(file, png)
  return file
}

test('BIL_PAY_003 — Validate that a bank transfer can be submitted against a pending invoice and is held for approval without settling it', async ({
  page,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_PAYMENT_WRITE,
    'Submits a real bank-transfer claim into the finance queue on the shared devsim tenant. It ' +
      'does not move money and does not settle the invoice, but it is a record somebody has to ' +
      'action. Set EPTTS_ALLOW_PAYMENT_WRITE=1 in automation-hub/.env for a deliberate run.',
  )

  const billing = BillingPage.openAs(page, 'manufacturer', '📄 Invoices')
  await billing.expectShell()

  const pending = (await billing.readInvoices())
    .filter((r) => /pending/i.test(r['Status'] ?? ''))
    .sort((a, b) => cents(a['Total'] ?? '') - cents(b['Total'] ?? ''))

  test.fixme(
    pending.length === 0,
    'No invoice with status Pending exists for this MAH, so there is no debt to submit a ' +
      'transfer against. Run WEB_CSV_009 to raise one. Blocked on test data, not failed.',
  )

  const invoiceNo = pending[0]['Invoice #']
  const total = pending[0]['Total']

  // A reference that is unmistakably test data to whoever opens the finance queue, and traceable
  // back to the run that created it.
  const reference = `QA-TEST-DO-NOT-PROCESS-${runId()}`
  const transferDate = new Date().toISOString().slice(0, 10)
  const receipt = writeReceipt()

  test.info().annotations.push({
    type: 'created-on-production',
    description:
      `bank transfer claim "${reference}" submitted against invoice ${invoiceNo} (${total}). ` +
      `Awaiting finance review — reject it rather than approving, unless BIL_PAY_004 is being run.`,
  })

  await billing
    .openPayDialog(invoiceNo)
    .choosePaymentMethod('Bank Transfer')
    .expectBankTransferForm(invoiceNo)
    .submitBankTransfer({ reference, date: transferDate, receiptPath: receipt })

  // 1. The submission was accepted. Asserted via the dialog closing and no error surfacing,
  //    because the portal reports success with a toast rather than a page change.
  await expect(
    page.locator('div.dialog').getByRole('heading', { name: 'Pay by Bank Transfer' }),
    `the transfer form should close once the claim is accepted. If it is still open, the ` +
      `submission was refused — check for a missing-fields message.`,
  ).toBeHidden({ timeout: 20_000 })

  // 2. AND THE INVOICE IS STILL PENDING. The whole reason this case exists.
  await page.reload()
  await billing.goTo('📄 Invoices').expectInvoiceStatus(invoiceNo, 'Pending')

  const after = (await billing.readInvoices()).find((r) => r['Invoice #'] === invoiceNo)
  expect(
    (after?.['Paid'] ?? '').trim(),
    `invoice ${invoiceNo} must NOT carry a settlement timestamp: a submitted bank transfer is a ` +
      `claim awaiting finance review, and treating it as payment would release the billing hold ` +
      `for money that has not arrived`,
  ).toMatch(/^(—|-|)$/)

  // 3. And it still offers Pay, because it is still owed.
  await billing.openPayDialog(invoiceNo).cancelPayDialog()
})
