/**
 * Helpers for the Commissioning and Packing CSV import (:8444 /import-jobs).
 *
 * Plain exported functions rather than a FluentPage subclass, following the precedent of
 * pages/eptts-web/information-center.ts: the interesting part of this screen is not a chain of
 * assertions, it is one asynchronous job whose VERDICT lives in an API payload. A fluent chain
 * would have to smuggle that payload out through a mutable field, which reads worse than
 * returning it.
 *
 * Everything here was measured against the live page on 2026-09-08, and three of the four
 * decisions below exist because the obvious approach does not work.
 *
 * 1. THE FILE INPUT IS HIDDEN, AND THAT IS FINE. The dropzone is a `div.csv-drop-zone`; the real
 *    control is an `input[type=file][accept=".csv,text/csv"]` with `display: none`.
 *    `setInputFiles` operates on the DOM and does not require visibility, so it is both simpler
 *    and more robust than clicking the dropzone and catching a file chooser.
 *
 * 2. NEVER CLICK A ROW ACTION. The job table self-polls roughly every second and re-renders,
 *    detaching its rows. A normal Playwright click on the row's eye button fails its
 *    actionability wait with "element is not stable" and then "element was detached from the
 *    DOM" — verified. Reading the DOM is fine; clicking it is not. Nothing here needs to.
 *
 * 3. THE JOB ID COMES FROM THE UPLOAD, SO A SPEC CAN FIND ITS OWN JOB. Uploading is a three-step
 *    presigned-S3 flow —
 *      POST /uploads/sessions                      -> 201, returns the session and its PUT URL
 *      PUT  <presigned S3 URL>                     -> 200, the bytes go straight to storage
 *      POST /uploads/sessions/{id}/complete        -> 201, validates and CREATES THE IMPORT JOB
 *    and that last response carries `{ importJobId, status: 'processing' }`. Without it a spec
 *    would have to guess that the newest row is its own, which is false the moment two runs
 *    overlap or somebody else uploads — and this is a shared tenant where that happens.
 *
 * 4. THE VERDICT IS THE POLLED PAYLOAD, NOT THE 201. `complete` answers `processing`; the import
 *    finishes about a second later. The page is already polling `GET /aggregation/import-jobs`,
 *    so the job's own row in those responses is the cheapest reliable source of truth, and it
 *    carries the exact `resultSummary` counts instead of the table's rounded "4 packs, 1 aggs".
 */
import { expect, type Page } from '@playwright/test'
import { ensureLoggedIn } from '../../lib/auth'

/** Terminal job states. `cancelled` is real — observed on a job that errored during validation. */
const TERMINAL = ['completed', 'failed', 'cancelled'] as const

export interface ImportResultSummary {
  totalRows: number
  commissionRows: number
  ssccCommissionRows: number
  packingRows: number
  ssccPackingRows: number
  packsCreated: number
  packsSkipped: number
  aggregationsCreated: number
  aggregationsSkipped: number
  aggregationsUpdated: number
  errorCount: number
  warningCount: number
  skippedCount: number
  chunkErrors: number
  issuesTruncated: boolean
}

export interface ImportJob {
  id: string
  status: string
  sourceGln: string | null
  receivingGln: string | null
  totalFiles: number
  processedFiles: number
  error: string | null
  resultSummary: ImportResultSummary
  rowCount: string
  createdBy?: { email?: string }
}

/** Open /import-jobs, logged in and settled. */
export async function openImportJobs(page: Page): Promise<void> {
  await ensureLoggedIn(page, 'eptts-web', '/import-jobs')
  await expect(page.getByRole('heading', { name: 'Commissioning and Packing CSV' })).toBeVisible({
    timeout: 45_000,
  })
}

/**
 * The read-only "Source (Manufacturer)" identity the dialog will attribute the import to.
 *
 * Asserted by the positive case before uploading, because the importer refuses any row whose
 * GLNs are not this entity's own. Getting it wrong produces 14 identical row errors that look
 * like a malformed file rather than a wrong session.
 */
export async function readUploadSource(page: Page): Promise<string> {
  const dialog = page.getByRole('dialog', { name: 'Upload CSV File' })
  await expect(dialog).toBeVisible({ timeout: 20_000 })
  return (await dialog.innerText()).replace(/\s+/g, ' ').trim()
}

/** Open the Upload CSV dialog. */
export async function openUploadDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Upload CSV' }).click()
  await expect(page.getByRole('dialog', { name: 'Upload CSV File' })).toBeVisible({
    timeout: 20_000,
  })
}

/**
 * Attach a file, submit, and return the id of the import job it created.
 *
 * The `complete` response is awaited rather than the click, so a spec never has to sleep. Upload
 * stays disabled until a file is attached, which is asserted so a silent no-op cannot look like
 * a passing upload.
 */
export async function uploadCsv(page: Page, filePath: string): Promise<string> {
  const dialog = page.getByRole('dialog', { name: 'Upload CSV File' })
  await dialog.locator('input[type=file]').setInputFiles(filePath)

  const upload = dialog.getByRole('button', { name: 'Upload', exact: true })
  await expect(
    upload,
    'the Upload button should enable once a CSV is attached — it starts disabled',
  ).toBeEnabled({ timeout: 10_000 })

  const completed = page.waitForResponse(
    (r) => /\/uploads\/sessions\/[^/]+\/complete$/.test(r.url()) && r.request().method() === 'POST',
    { timeout: 60_000 },
  )
  await upload.click()

  const response = await completed

  /**
   * THE STATUS AND THE PLATFORM'S REASON GO IN THE MESSAGE, AND THAT IS LOAD-BEARING.
   *
   * Both run recorders classify a failure by its FIRST error line, via
   * `src/lib/infrastructure-failure.cjs`, so that a platform outage is never written down as a
   * defect. This assertion used to read only "the upload session should complete and create an
   * import job" — no status, no reason — so when protected retention storage went down on
   * 2026-09-09 and every `complete` call answered 503, the classifier saw nothing to recognise
   * and WEB_CSV_009 and WEB_CSV_010 were both recorded as genuine failures. Two invented defects
   * from one outage, which is exactly what that classifier exists to prevent.
   *
   * The platform is precise about this and worth quoting verbatim: it answers
   * `{"reason":"upload-retention-unavailable","message":"The file was uploaded, but protected
   * retention storage is temporarily unavailable. Nothing was imported. Retry completion after
   * storage is restored.","retryAfterSeconds":60}`.
   */
  const reason = await response.text().catch(() => '')
  expect(
    response.status(),
    `the upload session should complete and create an import job. The platform answered ` +
      `${response.status()}: ${reason.slice(0, 400) || '(no body)'}`,
  ).toBe(201)
  const body = (await response.json()) as { importJobId?: string; status?: string }
  expect(body.importJobId, 'the complete response should name the import job it created').toBeTruthy()
  return body.importJobId as string
}

/**
 * Wait for one job to reach a terminal state and return it.
 *
 * Reads the list responses the page is already polling, so this adds no traffic of its own and
 * needs no bearer token. It matches on the id from `uploadCsv`, never on "the newest row" — on a
 * shared tenant that is somebody else's import as often as not.
 */
export async function waitForJob(page: Page, jobId: string, timeoutMs = 90_000): Promise<ImportJob> {
  let latest: ImportJob | undefined

  page.on('response', (response) => {
    if (!/\/aggregation\/import-jobs(\?|$)/.test(response.url())) return
    void response
      .json()
      .then((payload: { data?: ImportJob[] }) => {
        const hit = (payload.data ?? []).find((j) => j.id === jobId)
        if (hit) latest = hit
      })
      .catch(() => {
        /* a response that is not JSON is not our list */
      })
  })

  await expect
    .poll(() => latest?.status, {
      timeout: timeoutMs,
      message:
        `import job ${jobId} never reached a terminal state (${TERMINAL.join('/')}). The page ` +
        `polls GET /aggregation/import-jobs itself, so either the job is genuinely stuck or the ` +
        `list stopped being refreshed.`,
    })
    .toMatch(/^(completed|failed|cancelled)$/)

  return latest as ImportJob
}

/** Refresh the job list without clicking a row. */
export async function refreshJobs(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Refresh' }).click()
}
