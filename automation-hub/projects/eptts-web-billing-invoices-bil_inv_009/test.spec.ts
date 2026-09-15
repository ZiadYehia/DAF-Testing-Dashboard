/**
 * BIL_INV_009 — Validate that a completed packing import increases the pending invoice by the packs it created
 *
 * Feature: billing-invoices   Portal: https://192.168.225.195:8446 → "📄 Invoices"
 *
 * Checks the join between an operation and the money charged for it: import a known number of
 * packs, and the MAH's billed piece count must rise by at least that many.
 *
 * IT IS A DELTA, NOT AN EQUALITY, AND THAT IS DELIBERATE. The obvious assertion — "a new invoice
 * appears whose Pieces equals the packs imported" — is false on this platform whenever the MAH
 * already has an unpaid invoice: billing folds new packing into the open one instead of raising a
 * new one. `INV-20260908-000002` was watched growing 434 → 473 → 654 → 662 pieces across a single
 * day for exactly that reason. With no unpaid invoice outstanding the 1:1 does hold (a 4-pack
 * import produced a 4-piece, 28.00 EGP invoice), so this case asserts the delta — which is true
 * in both worlds — and additionally checks the 1:1 when it applies.
 *
 * "At least" rather than "exactly" is the honest bound: devsim is shared and other parties pack
 * while a case runs, so demanding an exact delta would fail for reasons unrelated to the code.
 *
 * WRITES TO PRODUCTION: it commissions 4 packs and one SSCC to have something to be billed for.
 * Gated behind EPTTS_ALLOW_CSV_WRITE.
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

test.use({ ignoreHTTPSErrors: true })

const PACKS = 4

/** Total pieces across the MAH's PENDING invoices — what an import is expected to increase. */
function pendingPieces(rows: Record<string, string>[], gln: string): number {
  return rows
    .filter((r) => /pending/i.test(r['Status'] ?? ''))
    .filter((r) => r['MAH GLN'] === undefined || r['MAH GLN'] === gln)
    .reduce((sum, r) => sum + Number((r['Pieces'] ?? '').replace(/\D/g, '') || 0), 0)
}

test('BIL_INV_009 — Validate that a completed packing import increases the pending invoice by the packs it created', async ({
  browser,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_CSV_WRITE,
    'Commissions 4 SGTINs and 1 SSCC on the shared devsim tenant so there is something to bill ' +
      'for, and none of it can be deleted. Set EPTTS_ALLOW_CSV_WRITE=1 in automation-hub/.env ' +
      'for a deliberate run.',
  )

  const ownGln = requireEnv('EPTTS_WEB_MFG_GLN')

  // 1. The billed piece count BEFORE the import. Read as admin, because only the admin view
  //    carries the MAH GLN column needed to scope the sum to our own party.
  const adminCtx = await browser.newContext({
    storageState: await ensureRoleState('admin', 'eptts-billing'),
    ignoreHTTPSErrors: true,
  })

  try {
    const adminPage = await adminCtx.newPage()
    let billing = BillingPage.openAs(adminPage, 'admin', '📄 Invoices')
    await billing.expectShell()
    const before = pendingPieces(await billing.readInvoices(), ownGln)

    // 2. Import a known number of packs.
    const csv = buildCommissionPackCsv({ packCount: PACKS })
    const importedAt = new Date(Date.now() - 60_000)

    const mfgCtx = await browser.newContext({
      storageState: await ensureRoleState('manufacturer'),
      ignoreHTTPSErrors: true,
    })
    let job
    try {
      const page = await mfgCtx.newPage()
      await openImportJobs(page)
      await openUploadDialog(page)
      const jobId = await uploadCsv(page, csv.path)
      job = await waitForJob(page, jobId)
      test.info().annotations.push({
        type: 'created-on-production',
        description: `job ${jobId} | SSCC ${csv.sscc} | lot ${csv.lot}`,
      })
    } finally {
      await mfgCtx.close()
    }

    expect(
      job.status,
      `the import must succeed before its billing means anything. Platform error: ${job.error ?? '(none)'}`,
    ).toBe('completed')
    expect(job.resultSummary.packsCreated, `${PACKS} packs created`).toBe(PACKS)

    // 3. The billed piece count AFTER. Polled, because billing raises the charge asynchronously
    //    after the import completes, and the invoice list does not refresh itself.
    billing = BillingPage.openAs(adminPage, 'admin', '📄 Invoices')
    await billing.expectShell()

    await expect
      .poll(
        async () => {
          const fresh = BillingPage.openAs(adminPage, 'admin', '📄 Invoices')
          await fresh.expectShell()
          return pendingPieces(await fresh.readInvoices(), ownGln)
        },
        {
          timeout: 60_000,
          intervals: [2_000, 3_000, 5_000],
          message:
            `the billed pending pieces for MAH ${ownGln} should rise by at least ${PACKS} after ` +
            `an import of ${PACKS} packs. It was ${before} before. Billing charges asynchronously, ` +
            `so this polls rather than asserting once.`,
        },
      )
      .toBeGreaterThanOrEqual(before + PACKS)

    // 4. When the MAH had no unpaid invoice, the import gets its OWN invoice — and then the
    //    stronger 1:1 claim is checkable, including the operations it says it covers.
    const dedicated = await billing.findInvoiceForImport(PACKS, importedAt, ownGln)
    if (dedicated) {
      const invoiceNo = dedicated['Invoice #']
      expect(
        Number((dedicated['Pieces'] ?? '').replace(/\D/g, '')),
        `invoice ${invoiceNo} was raised for this import alone, so its Pieces should be ${PACKS}`,
      ).toBe(PACKS)
      expect(
        (dedicated['Paid'] ?? '').trim(),
        `invoice ${invoiceNo} is new and unpaid, so its Paid column should be the em-dash placeholder`,
      ).toMatch(/^(—|-|)$/)

      // The Details dialog names the operations it bills. This is the only place the platform
      // joins a packing operation to its charge, so it is the strongest link available.
      await billing.expectInvoiceCoversOperations(invoiceNo, PACKS)
    } else {
      test.info().annotations.push({
        type: 'folded-into-existing-invoice',
        description:
          `No dedicated ${PACKS}-piece invoice was raised: the MAH already had an unpaid invoice, ` +
          `so billing folded these packs into it. The delta assertion above still holds; the 1:1 ` +
          `and operations-covered checks were skipped because they do not apply in this state.`,
      })
    }
  } finally {
    await adminCtx.close()
  }
})
