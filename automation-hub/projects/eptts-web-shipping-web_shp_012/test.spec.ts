/**
 * WEB_SHP_012 — Validate that shipping is blocked under Enforce when the packs are unpaid but their invoice has not been raised yet
 *
 * Feature: web-shipping   Route: /shipments
 *
 * The sibling of WEB_SHP_009, and the one that matters more. WEB_SHP_009 proves the hold works on
 * debt that has already been invoiced. This one asks whether it works on debt that exists but has
 * not been invoiced YET — which, because billing raises clearance on a slow asynchronous sweep, is
 * the state every consignment passes through immediately after it is packed.
 *
 * WHY THAT IS THE INTERESTING CASE. Pack-then-ship is the normal working sequence: a manufacturer
 * commissions and packs a consignment and dispatches it. The invoice covering those packs appears
 * minutes to tens of minutes later — INV-20260909-000027 was watched growing 8 → 12 → 16 → 20 → 24
 * pieces, one 4-pack import per step, each step landing only after the run that caused it had
 * finished, and a 4-minute poll of the balance straight after a completed import never saw it move.
 * So if the hold can only see invoiced clearance, the ordinary workflow outruns it and the control
 * is decorative in practice while looking correct in tests that pause.
 *
 * IT ASSERTS WHAT SHOULD HAPPEN AND IS EXPECTED TO FAIL. Measured 2026-09-08, twice, under a
 * polled and confirmed `enforce:true`: SSCC 054138689833600011 and SSCC 254138684176500015 both
 * dispatched successfully within seconds of their clearance being raised. Filed as
 * draft:billing-enforce-does-not-see-freshly-raised-clearance-so-pack-then-ship-bypasses-the-hold.
 * Asserting the observed escape instead would report the fix as a regression.
 *
 * IT DELIBERATELY DOES NOT WAIT. Everything between the import completing and the dispatch is kept
 * to the minimum, because the wait is the variable under test. If this case ever passes, check that
 * it passed quickly — a slow run can pass for the wrong reason, by giving the sweep time to raise
 * the invoice and thereby testing WEB_SHP_009 all over again. The elapsed time from import to
 * dispatch is recorded as an annotation so that is visible in the run.
 *
 * THREE IRREVERSIBLE WRITES, ONE OF THEM TENANT-WIDE. It SETTLES the manufacturer's outstanding
 * invoices with no unpay (so that the only clearance in play is the un-invoiced kind), creates
 * stock that cannot be deleted, and puts devsim into Enforce for the duration — blocking shipping
 * for every party until the `finally` restores it. All three gates must be open.
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

/** Words that make a refusal the RIGHT refusal rather than merely a refusal. */
const BILLING_REASON = /billing|unpaid|clearance|invoice|hold|settle/i

test('WEB_SHP_012 — Validate that shipping is blocked under Enforce when the packs are unpaid but their invoice has not been raised yet', async ({
  browser,
}) => {
  test.setTimeout(900_000)
  test.fixme(
    !process.env.EPTTS_ALLOW_CSV_WRITE ||
      !process.env.EPTTS_ALLOW_PAYMENT_WRITE ||
      !process.env.EPTTS_ALLOW_BILLING_MODE_WRITE,
    'Needs all three gates: it settles real invoices with no unpay (EPTTS_ALLOW_PAYMENT_WRITE), ' +
      'creates stock that cannot be deleted (EPTTS_ALLOW_CSV_WRITE), and puts the whole devsim ' +
      'tenant into Enforce until it restores the mode (EPTTS_ALLOW_BILLING_MODE_WRITE). Set all ' +
      'three in automation-hub/.env for a deliberate run.',
  )

  const ownGln = requireEnv('EPTTS_WEB_MFG_GLN')
  const destinationGln = requireEnv('EPTTS_WEB_DISTRIBUTOR_GLN')
  const packCount = 4
  const csv = buildCommissionPackCsv({ packCount })

  const mfgCtx = await browser.newContext({
    storageState: await ensureRoleState('manufacturer'),
    ignoreHTTPSErrors: true,
  })
  const adminCtx = await browser.newContext({
    storageState: await ensureRoleState('admin', 'eptts-billing'),
    ignoreHTTPSErrors: true,
  })

  let original: BillingMode | undefined
  let adminPage: Page | undefined

  try {
    // 1. Clear the slate. Any pre-existing balance would block the dispatch on its own and this
    //    case would "pass" without ever testing the un-invoiced window — the exact false pass
    //    WEB_SHP_009 is for. A zero balance is what makes the two cases distinguishable.
    adminPage = await adminCtx.newPage()
    let billing = BillingPage.openAs(adminPage, 'admin', '📄 Invoices')
    await billing.expectShell()
    const settled = await billing.settleAllPendingFor(ownGln)
    test.info().annotations.push({
      type: 'settled-on-production',
      description: settled.length
        ? `settled ${settled.join(', ')} so the only clearance in play is un-invoiced`
        : 'nothing outstanding — no settlement needed',
    })

    const opening = await billing.readOutstandingFor(ownGln)
    expect(
      opening.pieces,
      `MAH ${ownGln} must owe nothing before the import, or the dispatch would be held by the ` +
        `pre-existing balance and this case would prove nothing about un-invoiced clearance. ` +
        `Still outstanding: ${opening.pieces} pieces on ${opening.invoiceNo ?? 'none'}.`,
    ).toBe(0)

    // 2. Enforce, confirmed at the backend before anything is shipped. Set BEFORE the import so
    //    no part of the window is spent switching modes.
    billing = BillingPage.openAs(adminPage, 'admin', '⚙️ Configuration')
    await billing.expectShell()
    original = await billing.readBillingMode()
    await billing.setBillingMode('enforce')

    await expect
      .poll(async () => (await billing.readPosture()).enforce, {
        timeout: 30_000,
        intervals: [500, 1_000, 2_000],
        message:
          'the platform posture must report enforce:true before this case can mean anything. ' +
          'Enforce is the one mode whose Apply raises a native confirm, so a false here usually ' +
          'means the dialog was not accepted and the mode never changed.',
      })
      .toBe(true)

    // 3. Pack, then ship, with nothing in between. The shipping page is opened up front so that
    //    the only work after the import completes is the dispatch itself.
    const page = await mfgCtx.newPage()
    await openImportJobs(page)
    await openUploadDialog(page)
    const jobId = await uploadCsv(page, csv.path)
    const job = await waitForJob(page, jobId)

    test.info().annotations.push({
      type: 'created-on-production',
      description: `job ${jobId} | SSCC ${csv.sscc} | lot ${csv.lot}`,
    })
    expect(
      job.status,
      `the import must succeed first. Platform error: ${job.error ?? '(none)'}`,
    ).toBe('completed')

    const importedAt = Date.now()
    await openShipping(page)
    await startInvoice(page, destinationGln, `QA-RACE-${csv.lot}`)
    await addSscc(page, csv.sscc, packCount)
    const outcome = await dispatch(page)
    const elapsedSeconds = Math.round((Date.now() - importedAt) / 1000)

    test.info().annotations.push({
      type: 'window-under-test',
      description:
        `${elapsedSeconds}s elapsed between the import completing and the dispatch. A PASS here ` +
        `is only meaningful if this is small — a slow run gives the invoicing sweep time to raise ` +
        `the clearance, which turns this case into WEB_SHP_009.`,
    })

    // 4. The verdict. These four packs are unpaid the moment they exist; whether billing has
    //    caught up is the platform's own bookkeeping problem and not a licence to ship.
    expect(
      outcome.dispatched,
      `Enforce means "block shipping on unpaid clearance". SSCC ${csv.sscc} was packed ` +
        `${elapsedSeconds}s ago and nothing has been paid for it, so it must NOT dispatch — ` +
        `whether or not billing has finished raising the invoice. It dispatched anyway, which ` +
        `means the hold can be outrun by shipping promptly, and pack-then-ship is the normal ` +
        `working sequence. Platform said: ${outcome.message}`,
    ).toBe(false)

    expect(
      outcome.message,
      `the refusal should name the billing reason, so that a rejection for some unrelated cause ` +
        `(already shipped, bad destination, timeout) cannot satisfy this case. Platform said: ` +
        `${outcome.message}`,
    ).toMatch(BILLING_REASON)
  } finally {
    if (original && adminPage) {
      try {
        // Re-open Configuration rather than reusing a handle: `#c-mode` exists only on that tab,
        // and restoring through a page that had navigated elsewhere once left devsim in Enforce.
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
            `[WEB_SHP_012] FAILED TO RESTORE the billing mode after 30s. The tenant is on ` +
              `"${restored}" and should be "${original}" (${BILLING_MODES[original]}). EVERY ` +
              `party on devsim is blocked from shipping until this is fixed by hand at ` +
              `https://192.168.225.195:8446 → Configuration.`,
          )
        }
      } catch (err) {
        console.error(
          `[WEB_SHP_012] RESTORE THREW: ${err}. The tenant may still be in Enforce, which blocks ` +
            `shipping for everyone. Check it by hand.`,
        )
      }
    }
    await adminCtx.close()
    await mfgCtx.close()
  }
})
