/**
 * WEB_SHP_009 — Validate that shipping is blocked while an invoice is unpaid and the billing mode is Enforce
 *
 * Feature: web-shipping   Route: /shipments
 *
 * Checks the restrictive half of the billing gate, and it is the case the whole billing feature
 * exists for: Enforce means "block shipping on unpaid clearance", so an unpaid invoice must stop
 * its own stock leaving.
 *
 * IT ASSERTS WHAT THE PLATFORM SHOULD DO. Under Enforce, with clearance outstanding for this
 * manufacturer, the dispatch must be refused AND the refusal must name the billing reason. A generic
 * failure would satisfy "it did not ship" while proving nothing — the pack could have been
 * rejected for being already shipped, or the destination invalid. That distinction is the
 * difference between testing the gate and testing that something went wrong.
 *
 * If the dispatch SUCCEEDS, that is a real defect and this case fails loudly rather than being
 * softened. There is precedent for it being wrong in this direction: a filed bug records the hold
 * refusing an UNPACKING while `enforce:false`, i.e. the gate acting when it should not. This case
 * probes the opposite direction — the gate not acting when it should — which is the more dangerous
 * of the two, because product moves against money that never arrived.
 *
 * AND IT HAS BEEN SEEN BOTH WAYS, WHICH IS WHY IT NOW CHECKS THE BALANCE FIRST. On 2026-09-08 two
 * dispatches went through under `enforce:true` seconds after their clearance was raised
 * (INV-20260908-000021, INV-20260908-000022). On 2026-09-09 the same dispatch was refused —
 * "Shipping blocked by unpaid invoices. Outstanding cents: 5600" — against a balance that had
 * existed for seven hours (INV-20260909-000027). Same posture, same manufacturer, opposite
 * outcomes. The likely difference is that billing raises clearance on a slow sweep, so the first
 * two dispatches ran while the packs were packed but not yet invoiced, leaving the gate nothing to
 * find. This case therefore establishes and reads back a non-zero balance BEFORE it ships, so a
 * refusal or an escape is attributable to the gate and not to the invoicing lag.
 *
 * TWO IRREVERSIBLE WRITES AND ONE TENANT-WIDE ONE. It creates stock (4 SGTINs + 1 SSCC), and it
 * sets the billing mode to ENFORCE for the duration — which blocks shipping for EVERY party on
 * devsim until restored. The restore is polled in a `finally` and shouts if it fails. Both gates
 * must be open: EPTTS_ALLOW_CSV_WRITE and EPTTS_ALLOW_BILLING_MODE_WRITE.
 *
 * Enforce is also the one mode whose Apply raises a native window.confirm
 * (`config.billingMode.confirmEnforce`) — handled inside setBillingMode, without which the switch
 * silently does nothing and this case would "pass" by shipping under Advisory.
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

test('WEB_SHP_009 — Validate that shipping is blocked while an invoice is unpaid and the billing mode is Enforce', async ({
  browser,
}) => {
  // NOT test.slow(). The suite timeout is 30s and slow() only triples it to 90s, which is less
  // than the clearance lag this case has to wait out — the poll below was silently cut off at 90s
  // and reported the platform as never raising the invoice when it simply had not been given time.
  test.setTimeout(1_200_000)
  test.fixme(
    !process.env.EPTTS_ALLOW_CSV_WRITE || !process.env.EPTTS_ALLOW_BILLING_MODE_WRITE,
    'Needs BOTH gates. It creates stock that cannot be deleted (EPTTS_ALLOW_CSV_WRITE) and puts ' +
      'the whole devsim tenant into Enforce for the duration, blocking shipping for every party ' +
      'until it restores the mode (EPTTS_ALLOW_BILLING_MODE_WRITE). Set both in ' +
      'automation-hub/.env for a deliberate run.',
  )

  const ownGln = requireEnv('EPTTS_WEB_MFG_GLN')
  const destinationGln = requireEnv('EPTTS_WEB_DISTRIBUTOR_GLN')
  const packCount = 4

  // 1. Create the consignment FIRST, while the tenant is still permissive. Importing under
  //    Enforce would confuse two questions: this case is about shipping being blocked, not about
  //    whether packing is.
  const csv = buildCommissionPackCsv({ packCount })

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
    // 1a. The MAH's outstanding clearance BEFORE the import. Read rather than assumed either way:
    //     on a shared tenant it is usually non-zero, and when it is zero the case has to wait for
    //     its own import to be invoiced before the gate has anything to act on.
    adminPage = await adminCtx.newPage()
    billing = BillingPage.openAs(adminPage, 'admin', '📄 Invoices')
    await billing.expectShell()
    const before = await billing.readOutstandingFor(ownGln)

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

    // 2. The unpaid clearance the gate is meant to act on.
    //
    //    THE GATE IS BALANCE-BASED, SO THE PRECONDITION IS A BALANCE. The platform's own refusal
    //    is "Shipping blocked by unpaid invoices. Outstanding cents: N" — it names the MAH's
    //    total, not the consignment, and it holds EVERY dispatch by that MAH while anything is
    //    owed. So what this case needs is an unpaid balance and some stock to try to move; it
    //    does not need the balance to be attributable to its own four packs, and demanding that
    //    would test something the platform does not claim.
    //
    //    WHICH ALSO KEEPS IT OFF THE INVOICING SWEEP. Billing raises clearance asynchronously and
    //    slowly: measured 2026-09-09, a completed 4-pack import left the balance untouched for a
    //    full 4-minute poll, and INV-20260909-000027 was seen growing 8 → 12 → 16 → 20 → 24, one
    //    step per run, each step landing only after the run that caused it had finished. Waiting
    //    for this import's own invoice would mean waiting out that sweep — and would make the
    //    case's verdict depend on it.
    let outstanding = before
    if (outstanding.pieces === 0) {
      // Nothing owed at the start, so the gate would have nothing to act on and a dispatch SHOULD
      // succeed. Wait for this import's clearance to be raised rather than asserting into a
      // vacuum. If the sweep has not run by the deadline, that is environment state, not a defect
      // in the gate, and the fixme below says so instead of failing.
      await expect
        .poll(
          async () => {
            outstanding = await billing!.readOutstandingFor(ownGln)
            return outstanding.pieces
          },
          {
            timeout: 720_000,
            intervals: [10_000, 20_000, 30_000],
            message: `waiting for billing to raise the clearance for this import of ${packCount} packs`,
          },
        )
        .toBeGreaterThan(0)
    }

    test.fixme(
      outstanding.pieces === 0 || outstanding.invoiceNo === null,
      `MAH ${ownGln} has no unpaid invoice, so Enforce has nothing to hold and this case cannot ` +
        `distinguish a working gate from an absent one. Billing had not raised the clearance for ` +
        `this import within 12 minutes — it sweeps unbilled operations into an invoice on its own ` +
        `schedule. Rerun once the invoice exists. Blocked on environment state, not failed.`,
    )
    // Not re-asserted as "Pending" here: readOutstandingFor already selected on unpaid status,
    // and an invoice that has aged into OVERDUE is still unpaid clearance. Asserting the literal
    // word would fail on a debt that had merely got old.
    const invoiceNo = outstanding.invoiceNo as string

    test.info().annotations.push({
      type: 'clearance-under-test',
      description: `invoice ${invoiceNo}, ${outstanding.pieces} unpaid pieces owed by ${ownGln}`,
    })

    // 3. Switch the tenant to Enforce, and confirm the BACKEND agrees before relying on it.
    //    Asserting the posture rather than the dropdown matters here more than anywhere: if the
    //    switch silently failed, the dispatch below would be refused-or-allowed under Advisory
    //    and the case would report the opposite of the truth.
    billing = BillingPage.openAs(adminPage, 'admin', '⚙️ Configuration')
    await billing.expectShell()
    original = await billing.readBillingMode()
    await billing.setBillingMode('enforce')

    await expect
      .poll(async () => (await billing!.readPosture()).enforce, {
        timeout: 30_000,
        intervals: [500, 1_000, 2_000],
        message:
          'the platform posture must report enforce:true before this case can mean anything. ' +
          'Enforce is the one mode whose Apply raises a native confirm, so a false here usually ' +
          'means the dialog was not accepted and the mode never changed.',
      })
      .toBe(true)

    // 4. Attempt the dispatch. A refusal is the expected outcome.
    await openShipping(page)
    await startInvoice(page, destinationGln, `QA-SHIP-${csv.lot}`)
    await addSscc(page, csv.sscc, 4)
    const outcome = await dispatch(page)

    expect(
      outcome.dispatched,
      `Enforce means "block shipping on unpaid clearance", so SSCC ${csv.sscc} must NOT dispatch ` +
        `while invoice ${invoiceNo} is unpaid. It dispatched anyway, which means product left ` +
        `against money that never arrived. Platform said: ${outcome.message}`,
    ).toBe(false)

    // 5. And it must be the RIGHT refusal. Routed through a reason check so a rejection for some
    //    unrelated cause (already shipped, bad destination, timeout) cannot satisfy the case.
    expect(
      outcome.message,
      `the refusal should name the billing reason — unpaid clearance, a billing hold or the ` +
        `invoice. Without that this case cannot distinguish the billing gate from any other ` +
        `failure. Platform said: ${outcome.message}`,
    ).toMatch(BILLING_REASON)
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
            `[WEB_SHP_009] FAILED TO RESTORE the billing mode after 30s. The tenant is on ` +
              `"${restored}" and should be "${original}" (${BILLING_MODES[original]}). EVERY ` +
              `party on devsim is blocked from shipping until this is fixed by hand at ` +
              `https://192.168.225.195:8446 → Configuration.`,
          )
        }
      } catch (err) {
        console.error(
          `[WEB_SHP_009] RESTORE THREW: ${err}. The tenant may still be in Enforce, which blocks ` +
            `shipping for everyone. Check it by hand.`,
        )
      }
    }
    await adminCtx.close()
    await mfgCtx.close()
  }
})
