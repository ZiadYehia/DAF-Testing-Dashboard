/**
 * WEB_CSV_009 — Validate that a valid commissioning and packing CSV imports and creates the packs and the aggregation it declares
 *
 * Feature: web-commissioning-packing-csv   Route: /import-jobs
 *
 * Checks the entry point of the whole track-and-trace chain: a well-formed file commissions four
 * packs, commissions one SSCC, links all four into it, and the platform reports exactly that.
 *
 * WRITES TO PRODUCTION IF THE PLATFORM LETS IT. This case commissions four real SGTINs and one
 * real SSCC on the shared devsim tenant, and there is no delete. It also raises a billing
 * invoice, which is the point — BIL_INV_009 and the BIL_PAY_* cases consume what this creates.
 * Every identifier is run-scoped via runId() so reruns accumulate rather than collide, and every
 * pack is traceable to the run that made it through its ZTG serial and lot.
 *
 * Gated behind EPTTS_ALLOW_CSV_WRITE so a bulk or scheduled run records it blocked with that
 * reason instead of quietly minting stock.
 *
 * The verdict is the polled job payload, not the table text. `resultSummary` carries exact counts
 * where the Result column shows a rounded "4 packs, 1 aggs", and the row actions cannot be
 * clicked at all — the list self-polls and detaches its rows mid-click.
 */
import { expect, test } from '@playwright/test'
import { requireEnv } from '../../lib/env'
import { buildCommissionPackCsv } from '../../lib/eptts-csv'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import {
  openImportJobs,
  openUploadDialog,
  readUploadSource,
  uploadCsv,
  waitForJob,
} from '../../pages/eptts-web/import-jobs.page'

// NO storageState in test.use, and that is deliberate.
//
// stateFor('eptts-web') is the PLATFORM ADMIN session, and this case cannot use it: the importer
// attributes the source GLN to the acting user and then requires every row to carry that entity's
// own GLN. Run as admin, a perfectly good fixture comes back with one
// "must match your own entity GLN" error per row.
//
// The manufacturer state is built on demand by ensureRoleState, which is async — and test.use
// takes a value, not a promise. So the context is built inside the test, exactly as
// projects/eptts-web-activation-keys-web_aky_005 does for the same reason.
test.use({ ignoreHTTPSErrors: true })

test('WEB_CSV_009 — Validate that a valid commissioning and packing CSV imports and creates the packs and the aggregation it declares', async ({
  browser,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_CSV_WRITE,
    'Irreversible production write on the shared devsim tenant: this case commissions 4 SGTINs ' +
      'and 1 SSCC, raises a billing invoice, and the platform offers no delete. Set ' +
      'EPTTS_ALLOW_CSV_WRITE=1 in automation-hub/.env for a deliberate run.',
  )

  const ownGln = requireEnv('EPTTS_WEB_MFG_GLN')
  const csv = buildCommissionPackCsv({ packCount: 4 })

  // ignoreHTTPSErrors again: browser.newContext() does NOT inherit it from the config's `use`
  // block, and the production host serves a self-signed certificate.
  const context = await browser.newContext({
    storageState: await ensureRoleState('manufacturer'),
    ignoreHTTPSErrors: true,
  })

  try {
    const page = await context.newPage()

    await openImportJobs(page)
    await openUploadDialog(page)

    // The dialog states who the import will be attributed to, read-only, from the session.
    // Assert it before uploading: run as the wrong identity and the importer answers with one
    // "must match your own entity GLN" error per row, which reads as a malformed file rather
    // than a wrong login and costs real time to unpick.
    const source = await readUploadSource(page)
    expect(
      source,
      `the upload dialog should attribute this import to ${ownGln}, the GLN the fixture is ` +
        `built from. Dialog read: ${source}`,
    ).toContain(ownGln)

    const jobId = await uploadCsv(page, csv.path)
    const job = await waitForJob(page, jobId)

    // The identifiers this run put on production, recorded before the assertions so they survive
    // a failure — a downstream case (BIL_INV_009, BIL_PAY_*, WEB_SHP_*) needs to know what stock
    // it was meant to consume even when this one fell over.
    test.info().annotations.push({
      type: 'created-on-production',
      description:
        `job ${jobId} | SSCC ${csv.sscc} | lot ${csv.lot} | GTIN ${csv.gtin} | ` +
        `serials ${csv.sgtins.map((s) => s.split('(21)')[1]).join(', ')}`,
    })

    // 1. The job succeeded. Reported with the platform's own error text, because "failed" alone
    //    sends the reader back to the UI to find out why.
    expect(
      job.status,
      `import job ${jobId} should complete. Platform error: ${job.error ?? '(none reported)'}`,
    ).toBe('completed')

    // 2. Attributed to us.
    expect(job.sourceGln, 'the import should be attributed to the acting manufacturer').toBe(ownGln)
    expect(job.processedFiles, 'the single uploaded file should be processed').toBe(1)

    // 3. The counts the file declares. Asserted individually so a failure names which one moved:
    //    "packsCreated 3" and "aggregationsCreated 0" are very different defects.
    const r = job.resultSummary
    expect(r.totalRows, 'nine rows: 4 commissioning + 1 SSCC + 4 packing').toBe(9)
    expect(r.commissionRows, 'four SGTINs commissioned').toBe(4)
    expect(r.ssccCommissionRows, 'one SSCC commissioned').toBe(1)
    expect(r.packingRows, 'four packing rows').toBe(4)
    expect(r.packsCreated, 'four packs created').toBe(4)
    expect(r.aggregationsCreated, 'one aggregation created').toBe(1)
    expect(r.errorCount, `no row errors. Platform error text: ${job.error ?? '(none)'}`).toBe(0)

    // 4. Nothing was silently deduplicated.
    //
    //    This is the assertion that makes the case mean anything. Re-uploading byte-identical
    //    content is silently deduplicated and returns the EARLIER job (bug EPT-007, still open),
    //    so a fixture that was not freshly generated would report a healthy "completed" while
    //    importing nothing at all. packsSkipped is how the importer reports rows that already
    //    exist, so zero is the proof that these four packs are new.
    expect(
      r.packsSkipped,
      'no pack should be skipped as already-existing — a non-zero count here means the ' +
        'run-scoped identifiers collided with an earlier import and this job created nothing',
    ).toBe(0)
    expect(r.aggregationsSkipped, 'the aggregation should be new, not skipped').toBe(0)

    // 5. warningCount is deliberately NOT asserted to be zero.
    //
    //    A correct import of this exact shape reports warningCount 1, "Some rows could not be
    //    written", while creating all four packs with errorCount 0 and packsSkipped 0 — measured
    //    2026-09-08. The SSCC commissioning row appears to be counted as a row that produced no
    //    pack. Asserting zero would fail every healthy run; asserting exactly one would freeze a
    //    detail nobody has specified. So the check is only that warnings did not become errors.
    expect(
      r.warningCount,
      'warnings should stay bounded — a jump here means rows are being dropped in a new way',
    ).toBeLessThanOrEqual(1)
  } finally {
    await context.close()
  }
})
