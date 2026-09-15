/**
 * WEB_RCV_010 — Validate that completing a receive transfers custody of the scanned packs to the receiving party
 *
 * Feature: web-receiving   Route: /shipments/receive
 *
 * Checks the hinge of the whole supply chain. Custody does NOT move at despatch — a dispatched
 * pack stays with the sender until the receiver confirms — so until a receive completes, nothing
 * downstream exists: no onward shipping, no returns, no dispensing.
 *
 * IT BUILDS ITS OWN CONSIGNMENT, ACROSS THREE ROLES, BECAUSE IT HAS TO. The pending-receipt list
 * does not show the SSCC in its rows, so a receiver cannot address a specific consignment from the
 * list alone — and on a shared tenant with dozens of shipments awaiting receipt, "the first
 * pending row" is somebody else's. So this case imports and dispatches as the MANUFACTURER,
 * settles the clearance as the ADMIN, then receives as the DISTRIBUTOR, carrying the SSCC across.
 * That is the chain as it really runs: commission → pack → invoice → pay → ship → receive.
 *
 * THE PAYMENT IS A PRECONDITION, NOT THE SUBJECT. Under Enforce, any outstanding balance blocks
 * every dispatch by that MAH — measured, the platform refuses with "Shipping blocked by unpaid
 * invoices. Outstanding cents: 5600", naming the balance rather than the consignment. So there is
 * no dispatch to receive until the MAH owes nothing. Settled through settleAllPendingFor rather
 * than by matching an invoice to this import, because while an invoice is pending later packing
 * folds into it and no 1:1 invoice exists to match. Whether the gate itself is correct is
 * WEB_SHP_009 and WEB_SHP_011's subject, not this one's.
 *
 * IT ASSERTS WHAT SHOULD HAPPEN, AND IT CURRENTLY FAILS. Measured 2026-09-09: the scan is accepted
 * and the panel reports every item scanned, but Complete Receiving does nothing observable.
 * `POST /portal/operations/receive/shipment/{id}` answers 202 and the operation then resolves
 * `{"status":"FAILED","retryable":false,"detail":"PORTAL_COMMAND_ENVELOPE_MALFORMED"}`, leaving the
 * shipment `dispatched` with `deliveredAt` and `receivedByUserId` null — and the interface shows
 * no error at all. Filed as
 * draft:receiving-a-shipment-fails-with-portal-command-envelope-malformed-and-reports-nothing.
 *
 * Not softened to match. `retryable: false` means this is not transient, and asserting the
 * observed silence would make the defect indistinguishable from a working receive — reporting the
 * day it is fixed as a regression instead.
 *
 * WRITES TO PRODUCTION: commissions 4 packs, SETTLES the manufacturer's outstanding invoices with
 * no unpay, dispatches the packs, and attempts a custody transfer. None of it can be undone.
 * Gated behind EPTTS_ALLOW_CSV_WRITE and EPTTS_ALLOW_PAYMENT_WRITE.
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
import {
  completeReceive,
  openReceiveForInvoice,
  openReceiving,
  scanForReceipt,
} from '../../pages/eptts-web/receiving.page'

test.use({ ignoreHTTPSErrors: true })

test('WEB_RCV_010 — Validate that completing a receive transfers custody of the scanned packs to the receiving party', async ({
  browser,
}) => {
  // NOT test.slow(). This drives four roles through import, settlement, dispatch and receipt, and
  // the suite's 30s timeout only triples to 90s under slow() — less than the settlement step alone.
  test.setTimeout(900_000)
  test.fixme(
    !process.env.EPTTS_ALLOW_CSV_WRITE || !process.env.EPTTS_ALLOW_PAYMENT_WRITE,
    'Needs both gates. It commissions 4 packs, settles the manufacturer\'s outstanding invoices ' +
      'with no unpay, dispatches the packs and attempts a custody transfer on the shared devsim ' +
      'tenant. None of it can be undone. Set EPTTS_ALLOW_CSV_WRITE=1 and ' +
      'EPTTS_ALLOW_PAYMENT_WRITE=1 in automation-hub/.env for a deliberate run.',
  )

  const ownGln = requireEnv('EPTTS_WEB_MFG_GLN')
  const destinationGln = requireEnv('EPTTS_WEB_DISTRIBUTOR_GLN')
  const csv = buildCommissionPackCsv({ packCount: 4 })

  const mfgCtx = await browser.newContext({
    storageState: await ensureRoleState('manufacturer'),
    ignoreHTTPSErrors: true,
  })
  const adminCtx = await browser.newContext({
    storageState: await ensureRoleState('admin', 'eptts-billing'),
    ignoreHTTPSErrors: true,
  })
  const distCtx = await browser.newContext({
    storageState: await ensureRoleState('distributor'),
    ignoreHTTPSErrors: true,
  })

  try {
    // ---- as the MANUFACTURER: create the stock and send it -------------------------------
    const mfgPage = await mfgCtx.newPage()
    await openImportJobs(mfgPage)
    await openUploadDialog(mfgPage)
    const jobId = await uploadCsv(mfgPage, csv.path)
    const job = await waitForJob(mfgPage, jobId)

    test.info().annotations.push({
      type: 'created-on-production',
      description: `job ${jobId} | SSCC ${csv.sscc} | lot ${csv.lot} | shipped to ${destinationGln}`,
    })

    expect(
      job.status,
      `the import must succeed before there is anything to receive. Platform error: ${job.error ?? '(none)'}`,
    ).toBe('completed')

    // ---- as the ADMIN: clear the balance so the dispatch is allowed to happen ------------
    const adminPage = await adminCtx.newPage()
    const billing = BillingPage.openAs(adminPage, 'admin', '📄 Invoices')
    await billing.expectShell()
    const settled = await billing.settleAllPendingFor(ownGln)

    test.info().annotations.push({
      type: 'settled-on-production',
      description: settled.length
        ? `settled ${settled.join(', ')} so the dispatch is not blocked by clearance`
        : 'nothing outstanding — no settlement needed',
    })

    await openShipping(mfgPage)
    // The invoice number is chosen here, is unique per run, and is the ONE identifier the
    // receiving list actually renders — its columns carry no SSCC — so it is what the receiver
    // addresses the consignment by, and what the platform's shipment record is looked up on.
    const shipmentInvoice = `QA-RCV-${csv.lot}`
    await startInvoice(mfgPage, destinationGln, shipmentInvoice)
    await addSscc(mfgPage, csv.sscc, 4)
    const dispatched = await dispatch(mfgPage)

    expect(
      dispatched.dispatched,
      `the consignment must reach the distributor before it can be received. Platform said: ` +
        `${dispatched.message}`,
    ).toBe(true)

    // ---- as the DISTRIBUTOR: receive it -------------------------------------------------
    const distPage = await distCtx.newPage()
    await openReceiving(distPage)
    await openReceiveForInvoice(distPage, shipmentInvoice)
    await scanForReceipt(distPage, csv.sscc)

    const outcome = await completeReceive(distPage, shipmentInvoice)

    expect(
      outcome.received,
      `completing the receive must transfer custody: SSCC ${csv.sscc} should leave the dispatched ` +
        `state once the receiver confirms, because custody moves on receipt and not on despatch. ` +
        `The platform said: ${outcome.message}`,
    ).toBe(true)
  } finally {
    await distCtx.close()
    await adminCtx.close()
    await mfgCtx.close()
  }
})
