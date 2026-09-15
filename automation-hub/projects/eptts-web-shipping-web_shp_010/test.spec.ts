/**
 * WEB_SHP_010 — Validate that shipping succeeds with an unpaid invoice when the billing mode is Advisory
 *
 * Feature: web-shipping   Route: /shipments
 *
 * Checks the permissive half of the billing gate: with the tenant in Advisory, an unpaid invoice
 * is recorded but must not stop a consignment leaving.
 *
 * Paired with WEB_SHP_009, which runs the SAME fixture under Enforce and requires a refusal. The
 * two together isolate billing mode as the only variable — either alone proves much less, because
 * a shipment that succeeds might simply mean the gate was never wired up.
 *
 * IT SHIPS THE STOCK ITS OWN IMPORT CREATED. The CSV import raises the invoice, the invoice covers
 * exactly those packs, and this case ships exactly that SSCC. An earlier draft picked "some
 * pending invoice" and "some SSCC" independently, which proved nothing about the pack being
 * shipped — the whole point is one consignment followed through.
 *
 * WRITES TO PRODUCTION IF THE PLATFORM LETS IT: it commissions 4 packs and one SSCC via CSV, then
 * dispatches them to a real distributor. Custody does not move on dispatch (the receiver must
 * confirm), but the shipping event is written and there is no delete. Gated behind
 * EPTTS_ALLOW_CSV_WRITE, which is the flag that owns creating stock.
 *
 * It reads the billing mode rather than setting it, and skips when the tenant is not in Advisory.
 * Setting a tenant-wide switch is BIL_CFG_008's job, and doing it here as a side effect would
 * change behaviour for everyone else on devsim without saying so.
 */
import { expect, test } from '@playwright/test'
import { requireEnv } from '../../lib/env'
import { buildCommissionPackCsv } from '../../lib/eptts-csv'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import { BillingPage } from '../../pages/eptts-web/billing.page'
import {
  openImportJobs,
  openUploadDialog,
  uploadCsv,
  waitForJob,
} from '../../pages/eptts-web/import-jobs.page'
import { addSscc, dispatch, openShipping, startInvoice } from '../../pages/eptts-web/shipping.page'

test.use({ ignoreHTTPSErrors: true })

test('WEB_SHP_010 — Validate that shipping succeeds with an unpaid invoice when the billing mode is Advisory', async ({
  browser,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_CSV_WRITE,
    'Creates stock and dispatches it on the shared devsim tenant: 4 SGTINs, 1 SSCC and a real ' +
      'shipping event, none of which can be deleted. Set EPTTS_ALLOW_CSV_WRITE=1 in ' +
      'automation-hub/.env for a deliberate run.',
  )

  const ownGln = requireEnv('EPTTS_WEB_MFG_GLN')
  const destinationGln = requireEnv('EPTTS_WEB_DISTRIBUTOR_GLN')

  // 1. The tenant must already be in Advisory. Read, never set.
  const adminCtx = await browser.newContext({
    storageState: await ensureRoleState('admin', 'eptts-billing'),
    ignoreHTTPSErrors: true,
  })
  let mode: string
  try {
    const adminPage = await adminCtx.newPage()
    const billing = BillingPage.openAs(adminPage, 'admin', '⚙️ Configuration')
    await billing.expectShell()
    mode = await billing.readBillingMode()
  } finally {
    await adminCtx.close()
  }

  test.fixme(
    mode !== 'advisory',
    `The tenant billing mode is "${mode}", not "advisory", so this case cannot say anything ` +
      `about the permissive path. BIL_CFG_008 owns changing the mode; this case only reads it. ` +
      `Blocked on environment state, not failed.`,
  )

  // 2. Create the consignment and let it raise its own invoice.
  const csv = buildCommissionPackCsv({ packCount: 4 })
  const importedAt = new Date(Date.now() - 60_000) // a minute of slack for clock skew

  const mfgCtx = await browser.newContext({
    storageState: await ensureRoleState('manufacturer'),
    ignoreHTTPSErrors: true,
  })

  try {
    const page = await mfgCtx.newPage()
    await openImportJobs(page)
    await openUploadDialog(page)
    const jobId = await uploadCsv(page, csv.path)
    const job = await waitForJob(page, jobId)

    test.info().annotations.push({
      type: 'created-on-production',
      description: `job ${jobId} | SSCC ${csv.sscc} | lot ${csv.lot} | shipped to ${destinationGln}`,
    })

    expect(
      job.status,
      `the import must succeed before shipping means anything. Platform error: ${job.error ?? '(none)'}`,
    ).toBe('completed')
    expect(job.resultSummary.packsCreated, 'four packs created').toBe(4)

    // 3. Its invoice exists and is unpaid — the precondition the gate is supposed to act on.
    const billingCtx = await browser.newContext({
      storageState: await ensureRoleState('admin', 'eptts-billing'),
      ignoreHTTPSErrors: true,
    })
    let invoiceNo: string
    try {
      const billingPage = await billingCtx.newPage()
      const billing = BillingPage.openAs(billingPage, 'admin', '📄 Invoices')
      await billing.expectShell()
      const invoice = await billing.findInvoiceForImport(4, importedAt, ownGln)
      test.fixme(
        invoice === null,
        `No pending 4-piece invoice was raised for MAH ${ownGln} by this import. Billing folds ` +
          `new packing into an ALREADY-PENDING invoice instead of raising a new one, so this ` +
          `happens whenever the MAH has an unsettled invoice. Settle it (BIL_PAY_005) and rerun. ` +
          `Blocked on environment state, not failed.`,
      )
      invoiceNo = (invoice as Record<string, string>)['Invoice #']
      await billing.expectInvoiceStatus(invoiceNo, 'Pending')
    } finally {
      await billingCtx.close()
    }

    // 4. Ship that SSCC. Under Advisory this must be allowed.
    await openShipping(page)
    const shipInvoice = `QA-SHIP-${csv.lot}`
    await startInvoice(page, destinationGln, shipInvoice)
    await addSscc(page, csv.sscc, 4)
    const outcome = await dispatch(page)

    expect(
      outcome.dispatched,
      `Advisory records without blocking, so SSCC ${csv.sscc} should dispatch even though its ` +
        `invoice ${invoiceNo} is unpaid. The platform said: ${outcome.message}`,
    ).toBe(true)
    expect(outcome.totalPacks, 'all four packs should be dispatched').toBe(4)

    // 5. And the invoice is still unpaid afterwards. Shipping must not settle anything — if it
    //    did, Advisory would be silently discharging debt rather than merely not blocking.
    const afterCtx = await browser.newContext({
      storageState: await ensureRoleState('admin', 'eptts-billing'),
      ignoreHTTPSErrors: true,
    })
    try {
      const afterPage = await afterCtx.newPage()
      const billing = BillingPage.openAs(afterPage, 'admin', '📄 Invoices')
      await billing.expectShell().expectInvoiceStatus(invoiceNo, 'Pending')
    } finally {
      await afterCtx.close()
    }
  } finally {
    await mfgCtx.close()
  }
})
