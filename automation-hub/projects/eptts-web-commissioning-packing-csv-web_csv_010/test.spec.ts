/**
 * WEB_CSV_010 — Validate that a file with a single invalid row is rejected whole and commits nothing
 *
 * Feature: web-commissioning-packing-csv   Route: /import-jobs
 *
 * Checks that the importer is all-or-nothing: one bad row rejects the file, names the row, and
 * writes no packs — and that correcting that row lets the very same identifiers import cleanly.
 *
 * The two-upload shape is what makes this provable. A failed job reporting `packsCreated: 0` is
 * only the job describing itself; it says nothing about what reached the database. The second
 * upload settles it: `packsSkipped` is how the importer reports rows that already exist, so
 * `packsSkipped: 0` on a corrected file whose identifiers are unchanged proves the first attempt
 * committed nothing. That is the same argument the manual campaign used for CSV_167/CSV_168 at
 * rows 50 and 99 of 100.
 *
 * WRITES TO PRODUCTION on its second upload, deliberately: the point is that the corrected file
 * imports. So it is gated behind EPTTS_ALLOW_CSV_WRITE like WEB_CSV_009, and creates four packs
 * and one SSCC when it runs. The first upload is expected to write nothing at all.
 *
 * The fault injected is an `import` flag of 'yes' where the column accepts only I, L, 1 or 0.
 * Chosen because the platform's refusal names the row AND the column, which lets this case check
 * the diagnostic quality rather than merely the rejection.
 */
import { expect, test } from '@playwright/test'
import { requireEnv } from '../../lib/env'
import { buildCommissionPackCsvPair } from '../../lib/eptts-csv'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import {
  openImportJobs,
  openUploadDialog,
  uploadCsv,
  waitForJob,
} from '../../pages/eptts-web/import-jobs.page'

test.use({ ignoreHTTPSErrors: true })

test('WEB_CSV_010 — Validate that a file with a single invalid row is rejected whole and commits nothing', async ({
  browser,
}) => {
  test.slow()
  test.fixme(
    !process.env.EPTTS_ALLOW_CSV_WRITE,
    'The second half of this case imports a corrected file for real, commissioning 4 SGTINs and ' +
      '1 SSCC on the shared devsim tenant with no delete available. Set EPTTS_ALLOW_CSV_WRITE=1 ' +
      'in automation-hub/.env for a deliberate run.',
  )

  const ownGln = requireEnv('EPTTS_WEB_MFG_GLN')

  // ONE identity rendered twice, sharing every SGTIN, the SSCC and the lot. That sharing is the
  // whole mechanism: packsSkipped on the second upload only means anything if the identifiers are
  // the same ones the first upload was asked to write. Two independent builds would each mint
  // fresh serials, packsSkipped would be zero regardless, and the case would prove nothing while
  // appearing to pass — which is why buildCommissionPackCsvPair exists.
  const { faulted, corrected } = buildCommissionPackCsvPair('badImportFlag', { packCount: 4 })
  expect(
    corrected.sscc,
    'the pair must share its SSCC, or the packsSkipped proof below is vacuous',
  ).toBe(faulted.sscc)
  expect(
    corrected.sgtins,
    'the pair must share its SGTINs, or the packsSkipped proof below is vacuous',
  ).toEqual(faulted.sgtins)

  const context = await browser.newContext({
    storageState: await ensureRoleState('manufacturer'),
    ignoreHTTPSErrors: true,
  })

  try {
    const page = await context.newPage()
    await openImportJobs(page)

    // ---- Upload 1: the faulted file must be refused, and nothing may be written -------------
    await openUploadDialog(page)
    const badJobId = await uploadCsv(page, faulted.path)
    const bad = await waitForJob(page, badJobId)

    expect(
      bad.status,
      `a file with an invalid ${faulted.fault} on row ${faulted.faultRow} should fail, not ` +
        `import partially. Job ${badJobId} reported "${bad.status}".`,
    ).toBe('failed')

    // Nothing committed. This is the job describing itself, which is weak on its own — upload 2
    // is what corroborates it.
    expect(bad.resultSummary.packsCreated, 'a rejected file must create no packs').toBe(0)
    expect(bad.resultSummary.aggregationsCreated, 'a rejected file must create no aggregation').toBe(0)
    expect(bad.resultSummary.errorCount, 'the rejection should be reported as a row error').toBeGreaterThan(0)

    // The diagnostic names the offending row and column. A refusal that says only "invalid file"
    // is a usability defect in its own right, and this is the case that would catch it.
    const error = bad.error ?? ''
    expect(
      error,
      `the refusal should name the offending row (${faulted.faultRow}). Platform said: ${error}`,
    ).toMatch(new RegExp(`Row\\s*${faulted.faultRow}\\b`, 'i'))
    expect(
      error,
      `the refusal should name the offending column ("import"). Platform said: ${error}`,
    ).toMatch(/\bimport\b/i)

    // ---- Upload 2: the corrected file imports completely, proving nothing was committed ------
    await openImportJobs(page)
    await openUploadDialog(page)
    const goodJobId = await uploadCsv(page, corrected.path)
    const good = await waitForJob(page, goodJobId)

    test.info().annotations.push({
      type: 'created-on-production',
      description:
        `job ${goodJobId} | SSCC ${corrected.sscc} | lot ${corrected.lot} | ` +
        `GTIN ${corrected.gtin} | ` +
        `serials ${corrected.sgtins.map((s) => s.split('(21)')[1]).join(', ')}`,
    })

    expect(
      good.status,
      `the corrected file should import. Platform error: ${good.error ?? '(none reported)'}`,
    ).toBe('completed')
    expect(good.sourceGln, 'attributed to the acting manufacturer').toBe(ownGln)
    expect(good.resultSummary.packsCreated, 'all four packs created on the corrected run').toBe(4)
    expect(good.resultSummary.aggregationsCreated, 'the aggregation created').toBe(1)

    // THE PROOF. Every pack is new, so the failed attempt left nothing behind. Were the first
    // upload committing rows before hitting the bad one, they would come back as skipped here.
    expect(
      good.resultSummary.packsSkipped,
      'every pack should be created fresh. A non-zero packsSkipped means the REJECTED upload had ' +
        'already committed rows, so the importer is not all-or-nothing after all — which is the ' +
        'defect this case exists to detect.',
    ).toBe(0)
  } finally {
    await context.close()
  }
})
