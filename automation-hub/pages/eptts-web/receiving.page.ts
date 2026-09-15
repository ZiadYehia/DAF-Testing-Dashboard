/**
 * Receiving on the main dashboard (:8444 /shipments/receive) — the receiver's half of a transfer.
 *
 * CUSTODY MOVES HERE, NOT AT DESPATCH. The repo's domain knowledge calls this the single most
 * misunderstood rule in the flow: a dispatched pack stays with the sender until the receiver
 * confirms. So this screen is the hinge of the whole chain — nothing downstream (onward shipping,
 * returns, dispensing) is reachable until a receive completes.
 *
 * Measured against devsim on 2026-09-09 as testdistributor3@eptts.com. The flow is:
 *
 *   1. the pending list, filtered by `Search by SSCC...` (there are 20 rows a page, so finding a
 *      specific consignment by eye is not viable)
 *   2. `Receive` on the row, which opens a SCAN panel: "0 / 1 item(s) scanned", the products
 *      expected, and `#barcodeInput` ("Focus and scan barcode...")
 *   3. scanning the SSCC — the panel then reads "SSCC scanned successfully — packs included"
 *   4. `Complete Receiving`, which raises a PrimeNG confirm ("Confirm receiving all items?")
 *
 * Three shapes carry over from shipping.page.ts, and for the same reasons:
 *  - button names have a LEADING SPACE from their icon spans (`" Complete Receiving"`), so they
 *    are matched by regex;
 *  - the confirm is a DOM dialog (`.p-confirmdialog-accept-button`), not a native one, so it must
 *    be clicked and cannot be handled by a Playwright dialog listener;
 *  - completion is ASYNCHRONOUS — `POST /portal/operations/receive/shipment/{id}` answers 202 and
 *    the verdict arrives on the operations stream. The 202 is not success.
 *
 * That last point is not theoretical here. On this tenant the operation currently resolves
 * `{"status":"FAILED","retryable":false,"detail":"PORTAL_COMMAND_ENVELOPE_MALFORMED"}` while the
 * UI shows nothing at all, so a helper that trusted the 202 would report every receive as
 * successful. See draft:receiving-a-shipment-fails-with-portal-command-envelope-malformed-and-reports-nothing.
 */
import { expect, type Locator, type Page } from '@playwright/test'
import { ensureLoggedIn } from '../../lib/auth'

/** What a receive attempt did, judged on the shipment rather than on the click. */
export interface ReceiveOutcome {
  /** True only when the shipment actually left the dispatched state. */
  received: boolean
  /** The shipment's status as the platform reports it afterwards. */
  status: string
  /** The platform's own words: the operation detail, a toast, or why nothing was observed. */
  message: string
}

/**
 * The receiver's session bearer, observed on the portal's own traffic.
 *
 * Needed because the only trustworthy answer to "did custody move?" comes from the shipments API,
 * and the token lives in a JS closure — never in a cookie or localStorage — so it can only be read
 * off the wire. Keyed by Page so several receivers can be driven in one test without crosstalk.
 */
const bearers = new WeakMap<Page, string>()

export async function openReceiving(page: Page): Promise<void> {
  if (!bearers.has(page)) {
    page.on('request', (req) => {
      const header = req.headers()['authorization']
      if (header && req.url().includes('/masar-service/api/v1/')) bearers.set(page, header)
    })
  }
  await ensureLoggedIn(page, 'eptts-web', '/shipments/receive')
  await expect(
    page.getByPlaceholder('Search by SSCC...'),
    'the receiving list should render its SSCC filter — that is the first control the flow needs',
  ).toBeVisible({ timeout: 45_000 })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
}

/**
 * Find a pending shipment by its INVOICE NUMBER and open its scan panel.
 *
 * ADDRESSED BY INVOICE NUMBER, NOT BY SSCC, AND THAT MATTERS. The list's columns are Invoice
 * Number / From / Dispatch Date / Items / Status / Actions — the SSCC appears nowhere in a row. So
 * although the page offers a "Search by SSCC..." box, a caller cannot confirm that filtering by it
 * selected the right consignment, and on a tenant with dozens of shipments awaiting receipt "the
 * first row" is usually somebody else's. The invoice number IS rendered, and a test that dispatched
 * the consignment chose it, so it is both controllable and verifiable. An earlier version filtered
 * by SSCC and read the first row, which would have scanned the consignment under test into a
 * stranger's shipment had the filter silently not applied.
 *
 * Polled rather than read once: despatch resolves asynchronously through /portal/operations, and
 * the receiving list does not poll itself, so a just-dispatched shipment takes a moment to appear.
 */
export async function openReceiveForInvoice(
  page: Page,
  invoiceNumber: string,
  timeoutMs = 120_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (let attempt = 1; ; attempt++) {
    await openReceiving(page)
    const row = await findPendingRow(page, invoiceNumber)
    if (row) {
      await row.getByRole('button', { name: /Receive/ }).click()
      await expect(
        page.locator('#barcodeInput'),
        'clicking Receive should open the scan panel',
      ).toBeVisible({ timeout: 20_000 })
      return
    }
    if (Date.now() > deadline) {
      throw new Error(
        `No pending shipment for invoice ${invoiceNumber} appeared in this receiver's list ` +
          `within ${Math.round(timeoutMs / 1000)}s (${attempt} attempts). Either it was never ` +
          `dispatched to this party, or it has already been received.`,
      )
    }
    await page.waitForTimeout(5_000)
  }
}

/**
 * Wait up to `ms` for a locator to become visible, and report rather than throw.
 *
 * NOT `locator.isVisible({ timeout })`, WHICH DOES NOT WAIT — that call is a non-retrying snapshot
 * and its `timeout` option does nothing. Used here to ask "is the row listed yet?", it answered
 * for the instant the filter was applied, before the list had re-rendered, and so reported "not
 * listed" for a consignment that was about to appear. In completeReceive that is the difference
 * between "still awaiting receipt" and "received", i.e. it could invent a custody transfer.
 */
async function visibleWithin(locator: Locator, ms: number): Promise<boolean> {
  return await locator
    .waitFor({ state: 'visible', timeout: ms })
    .then(() => true)
    .catch(() => false)
}

/**
 * The pending row for one invoice number, or null if it is not listed.
 *
 * TOLERANT OF THE FILTER BAR VANISHING, WHICH IS WHY IT RETURNS null INSTEAD OF ASSERTING. Typing
 * into a filter box narrows the list live, and when nothing matches the page swaps the whole list
 * — filter controls included — for its empty state. So `Search` is present before the value is
 * typed and gone immediately after, which is how a click on it threw "waiting for
 * getByRole('button', { name: /^Search$/ })" on a run where the shipment had not yet reached the
 * receiver's list. Enter is the fallback for that state, and "not listed" is reported as a value
 * so callers can retry or interpret it.
 */
async function findPendingRow(page: Page, invoiceNumber: string) {
  const filter = page.getByPlaceholder('Search by invoice number...')
  await filter.fill(invoiceNumber)
  const search = page.getByRole('button', { name: /^\s*Search\s*$/ })
  if (await visibleWithin(search, 5_000)) {
    await search.click()
  } else {
    await filter.press('Enter').catch(() => {})
  }
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  const row = page.locator('table tbody tr').filter({ hasText: invoiceNumber })
  const listed = await visibleWithin(row.first(), 10_000)
  return listed ? row.first() : null
}

/** Scan an SSCC into the open panel and confirm the panel accepted it. */
export async function scanForReceipt(page: Page, sscc: string): Promise<void> {
  const input = page.locator('#barcodeInput')
  await input.fill(sscc)
  await input.press('Enter')

  await expect(
    page.getByText(/scanned successfully/i),
    `the panel should acknowledge SSCC ${sscc} — it reports "SSCC scanned successfully — packs ` +
      `included" when it accepts one`,
  ).toBeVisible({ timeout: 20_000 })
  await expect(
    page.getByText(/All items scanned/i),
    'the panel should report every expected item scanned before completion is offered',
  ).toBeVisible({ timeout: 20_000 })
}

/**
 * Complete the receive and report what the PLATFORM did, not what the click did.
 *
 * JUDGED FROM THE SHIPMENT RECORD, VIA THE API, BECAUSE THE SCREEN CANNOT BE TRUSTED HERE — and
 * neither can the list. Two weaker judgements were tried and both produced a green run on a
 * shipment the platform had not touched:
 *
 *   1. "the row no longer says Dispatched" — anything other than that exact word, including a
 *      cell that had not painted yet, counted as success;
 *   2. "the row is gone from the pending list" — the same empty state is produced by a filter
 *      that matched nothing, which is indistinguishable from a completed receive.
 *
 * Both reported RECEIVED while `GET /shipments` still held `"status":"dispatched"`,
 * `deliveredAt: null`, `receivedByUserId: null`. Custody transfer is the single most consequential
 * assertion in this suite — everything downstream depends on it — so it is read from the record
 * the platform itself keeps: a receive has happened when the shipment leaves `dispatched` AND the
 * platform stamps who received it and when. Half of that is not enough; `deliveredAt` alone could
 * be set by a status change that never assigned custody.
 */
export async function completeReceive(
  page: Page,
  invoiceNumber: string,
  timeoutMs = 90_000,
): Promise<ReceiveOutcome> {
  const toasts: string[] = []
  const collect = async () => {
    for (const t of await page.locator('.p-toast-message, div.toast, [role=alert]').all()) {
      const text = (await t.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
      if (text && !toasts.includes(text)) toasts.push(text)
    }
  }

  await page.getByRole('button', { name: /Complete Receiving/ }).click()

  // The PrimeNG confirm: "Confirm receiving all items?" with a "Yes, Complete" accept. Waited for
  // rather than sampled — sampling it once raced the render and silently skipped the confirm,
  // which is the mistake that made a dispatch look like a platform hang earlier in this suite.
  const accept = page.locator('div.p-confirmdialog .p-confirmdialog-accept-button')
  if (await accept.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) {
    await accept.click()
    await accept.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})
  }

  // Completion is asynchronous — POST /portal/operations/receive/shipment/{id} answers 202 and the
  // verdict arrives later — so the record is polled rather than read once.
  const deadline = Date.now() + timeoutMs
  let last = '(the shipment was never found in this receiver\'s shipment list)'
  for (;;) {
    await collect()
    const shipment = await readShipment(page, invoiceNumber)
    if (shipment) {
      last = `status=${shipment.status} deliveredAt=${shipment.deliveredAt ?? 'null'} receivedBy=${shipment.receivedByUserId ?? 'null'}`
      const moved =
        !/^(draft|dispatched)$/i.test(shipment.status ?? '') &&
        shipment.deliveredAt != null &&
        shipment.receivedByUserId != null
      if (moved) {
        return {
          received: true,
          status: shipment.status ?? 'unknown',
          message: toasts.join(' | ') || '(no message shown, but the record moved)',
        }
      }
    }
    if (Date.now() > deadline) {
      return {
        received: false,
        status: 'dispatched',
        message:
          (toasts.join(' | ') || '(the interface displayed no message at all)') +
          ` — after ${Math.round(timeoutMs / 1000)}s the platform's own record for invoice ` +
          `${invoiceNumber} still read ${last}, so custody never moved. Completion is async via ` +
          `POST /portal/operations/receive/shipment/{id}; query that operation for the reason ` +
          `the platform does not display.`,
      }
    }
    await page.waitForTimeout(3_000)
  }
}

/**
 * One shipment as the platform records it, looked up by invoice number.
 *
 * Read through the page's own session so it carries the receiver's identity and role — a shipment
 * a distributor cannot see is a shipment it cannot receive, and asking as somebody else would hide
 * that. Returns null rather than throwing when the token has not been observed yet or the record
 * is absent, because the caller is polling and both are ordinary transient states.
 */
export async function readShipment(
  page: Page,
  invoiceNumber: string,
): Promise<{
  id?: string
  status?: string
  deliveredAt?: string | null
  receivedByUserId?: string | null
  ssccs?: string[]
} | null> {
  const auth = bearers.get(page)
  if (!auth) return null
  return await page
    .evaluate(
      async ([auth, invoiceNumber]) => {
        const res = await fetch('/masar-service/api/v1/shipments?size=200', {
          headers: { Authorization: auth },
        })
        if (!res.ok) return null
        const body = await res.json()
        const rows = body.items ?? body.data ?? body
        if (!Array.isArray(rows)) return null
        // THE FIELD IS `erpInvoiceNumber`, NOT `invoiceNumber`. Matching on the latter — which is
        // what the receiving list's column heading ("Invoice Number") suggests — compares against
        // `undefined` for every row, finds nothing, and makes completeReceive report "the shipment
        // was never found" no matter what the platform actually did. That is a false negative that
        // looks exactly like the defect it is meant to detect. `invoiceNumber` is kept only as a
        // fallback in case the field is ever renamed to match the column.
        const match = rows.find(
          (s: Record<string, unknown>) =>
            s.erpInvoiceNumber === invoiceNumber || s.invoiceNumber === invoiceNumber,
        )
        if (!match) return null
        return {
          id: match.id,
          status: match.status,
          deliveredAt: match.deliveredAt,
          receivedByUserId: match.receivedByUserId,
          // The SSCCs actually on the shipment, which is the only place they are exposed — the
          // receiving list's rows do not carry them.
          ssccs: Array.isArray(match.items)
            ? match.items
                .map((i: Record<string, unknown>) => i.sscc)
                .filter((s: unknown): s is string => typeof s === 'string')
            : [],
        }
      },
      [auth, invoiceNumber] as const,
    )
    .catch(() => null)
}
