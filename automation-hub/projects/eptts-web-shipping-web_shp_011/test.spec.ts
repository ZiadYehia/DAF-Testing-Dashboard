/**
 * WEB_SHP_011 — Validate that shipping succeeds under Enforce once the invoice is paid
 *
 * Feature: web-shipping   Route: /shipments
 *
 * Checks the other side of the Enforce gate: with the clearance settled, the same consignment
 * that Enforce is supposed to hold back must be allowed through.
 *
 * This is the case that makes WEB_SHP_009 meaningful. A gate that blocks everything is as broken
 * as one that blocks nothing, so the suite needs both halves: 009 requires a refusal while the
 * invoice is unpaid, 011 requires success once it is paid, and the only difference between them
 * is the payment.
 *
 * WHAT IT CURRENTLY PROVES IS WEAKER THAN IT LOOKS, AND THAT IS WORTH SAYING. WEB_SHP_009 has
 * established that Enforce does not block an UNPAID invoice either
 * (draft:enforce-billing-mode-does-not-block-shipping-on-unpaid-clearance), so a pass here does
 * not yet demonstrate that payment is what unlocked the shipment — under the current defect
 * everything ships regardless. The case is still correct and still worth keeping: it is the
 * assertion that must go on holding after the gate is fixed, and the pair 009/011 is how a fix
 * gets verified rather than guessed at.
 *
 * THREE WRITES, ALL DELIBERATE: it creates stock, SETTLES a real invoice, and puts the tenant into
 * Enforce for the duration. All three gates must be open — EPTTS_ALLOW_CSV_WRITE,
 * EPTTS_ALLOW_PAYMENT_WRITE and EPTTS_ALLOW_BILLING_MODE_WRITE — and the mode is restored in a
 * `finally` that shouts if it cannot.
 */
import { expect, test, type Page } from '@playwright/test'
import { requireEnv } from '../../lib/env'
import { buildCommissionPackCsv } from '../../lib/eptts-csv'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import { BILLING_MODES, BillingPage, type BillingMode } from '../../pages/eptts-web/billing.page'
import {
  openImportJobs,
  openUploadDialog,
  uploadCsv,
  waitForJob,
} from '../../pages/eptts-web/import-jobs.page'
import { addSscc, dispatch, openShipping, startInvoice } from '../../pages/eptts-web/shipping.page'

test.use({ ignoreHTTPSErrors: true })

test('WEB_SHP_011 — Validate that shipping succeeds under Enforce once the invoice is paid', async ({
  browser,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_CSV_WRITE ||
      !process.env.EPTTS_ALLOW_PAYMENT_WRITE ||
      !process.env.EPTTS_ALLOW_BILLING_MODE_WRITE,
    'Needs all three gates: it creates stock that cannot be deleted, SETTLES a real invoice with ' +
      'no unpay, and puts the whole devsim tenant into Enforce until it restores the mode. Set ' +
      'EPTTS_ALLOW_CSV_WRITE, EPTTS_ALLOW_PAYMENT_WRITE and EPTTS_ALLOW_BILLING_MODE_WRITE in ' +
      'automation-hub/.env for a deliberate run.',
  )

  const ownGln = requireEnv('EPTTS_WEB_MFG_GLN')
  const destinationGln = requireEnv('EPTTS_WEB_DISTRIBUTOR_GLN')

  const csv = buildCommissionPackCsv({ packCount: 4 })
  const importedAt = new Date(Date.now() - 60_000)

  const mfgCtx = await browser.newContext({
    storageState: await ensureRoleState('manufacturer'),
    ignoreHTTPSErrors: true,
  })
  const adminCtx = await browser.newContext({
    storageState: await ensureRoleState('admin', 'eptts-billing'),
    ignoreHTTPSErrors: true,
  })

  let billing: BillingPage | undefined
  let original: BillingMode | undefined
  // Hoisted so the finally can re-open Configuration on it. Declared inside the try, the
  // restore could not reach it and the tenant was left in Enforce.
  let adminPage: Page | undefined

  try {
    // 1. Create the consignment.
    const page = await mfgCtx.newPage()
    await openImportJobs(page)
    await openUploadDialog(page)
    const jobId = await uploadCsv(page, csv.path)
    const job = await waitForJob(page, jobId)

    test.info().annotations.push({
      type: 'created-on-production',
      description: `job ${jobId} | SSCC ${csv.sscc} | lot ${csv.lot}`,
    })
    expect(job.status, `import must succeed. Platform error: ${job.error ?? '(none)'}`).toBe('completed')

    // 2. Find ITS invoice and settle it. Scoped to our own MAH's invoice for this import — never
    //    "the cheapest pending", which on a shared tenant is usually somebody else's debt.
    adminPage = await adminCtx.newPage()
    billing = BillingPage.openAs(adminPage, 'admin', '📄 Invoices')
    await billing.expectShell()

    const invoice = await billing.findInvoiceForImport(4, importedAt, ownGln)
    test.fixme(
      invoice === null,
      `No pending 4-piece invoice was raised for MAH ${ownGln} by this import — billing folds new ` +
        `packing into an already-pending invoice rather than raising its own. Settle the ` +
        `outstanding one (BIL_PAY_005) and rerun, so this case has a single invoice it can pay ` +
        `and attribute. Blocked on environment state, not failed.`,
    )
    const invoiceNo = (invoice as Record<string, string>)['Invoice #']

    test.info().annotations.push({
      type: 'settled-on-production',
      description: `settled invoice ${invoiceNo} (${(invoice as Record<string, string>)['Total']}) to unblock shipping`,
    })

    await billing.openPayDialog(invoiceNo)
    await billing.choosePaymentMethod('Manual settlement (admin)')
    await billing.waitForInvoiceStatus(invoiceNo, 'Paid')

    // 3. Now switch to Enforce. With the clearance settled there is nothing left to hold back.
    billing = BillingPage.openAs(adminPage, 'admin', '⚙️ Configuration')
    await billing.expectShell()
    original = await billing.readBillingMode()
    await billing.setBillingMode('enforce')

    await expect
      .poll(async () => (await billing!.readPosture()).enforce, {
        timeout: 30_000,
        intervals: [500, 1_000, 2_000],
        message:
          'the posture must report enforce:true, or this case is not testing Enforce at all. ' +
          'Enforce is the one mode whose Apply raises a native confirm.',
      })
      .toBe(true)

    // 4. Ship it. This must be allowed.
    await openShipping(page)
    await startInvoice(page, destinationGln, `QA-SHIP-${csv.lot}`)
    await addSscc(page, csv.sscc, 4)
    const outcome = await dispatch(page)

    expect(
      outcome.dispatched,
      `invoice ${invoiceNo} is settled, so Enforce has no unpaid clearance to block and SSCC ` +
        `${csv.sscc} must dispatch. Platform said: ${outcome.message}`,
    ).toBe(true)
    expect(outcome.totalPacks, 'all four packs should be dispatched').toBe(4)

    // 5. And settlement was not undone by shipping.
    const after = BillingPage.openAs(adminPage, 'admin', '📄 Invoices')
    await after.expectShell().expectInvoiceStatus(invoiceNo, 'Paid')
  } finally {
    if (original && adminPage) {
      try {
        // RE-OPEN CONFIGURATION BEFORE RESTORING. The `billing` handle may have been navigated
        // elsewhere by a later step — WEB_SHP_011 ends by re-reading the Invoices tab on the same
        // admin page — and `#c-mode` only exists on Configuration. Restoring through a stale
        // handle threw "locator.selectOption: Timeout ... waiting for locator('#c-mode')" and left
        // the tenant in ENFORCE, which is the single worst state to walk away from. Rebuilding the
        // page object here costs one navigation and makes the restore independent of whatever the
        // test did last.
        const cfg = BillingPage.openAs(adminPage, 'admin', '⚙️ Configuration')
        await cfg.expectShell()
        await cfg.setBillingMode(original)
        let restored: string = original
        const deadline = Date.now() + 30_000
        for (;;) {
          restored = (await cfg.readPosture()).mode.toLowerCase()
          if (restored === original || Date.now() > deadline) break
          await new Promise((r) => setTimeout(r, 1_000))
        }
        if (restored !== original) {
          console.error(
            `[WEB_SHP_011] FAILED TO RESTORE the billing mode after 30s. The tenant is on ` +
              `"${restored}" and should be "${original}" (${BILLING_MODES[original]}). Fix it by ` +
              `hand at https://192.168.225.195:8446 → Configuration.`,
          )
        }
      } catch (err) {
        console.error(`[WEB_SHP_011] RESTORE THREW: ${err}. Check the tenant billing mode by hand.`)
      }
    }
    await adminCtx.close()
    await mfgCtx.close()
  }
})
