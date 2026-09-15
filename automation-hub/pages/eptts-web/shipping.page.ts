/**
 * Shipping and receiving on the main dashboard (:8444) — /shipments and /shipments/receive.
 *
 * Plain functions rather than a FluentPage subclass, like import-jobs.page.ts and for the same
 * reason: what matters here is an asynchronous outcome (did the platform accept the dispatch, and
 * if not, why) rather than a chain of visual assertions. A refusal message is the assertion in
 * half these cases, so it has to be returned, not swallowed.
 *
 * Everything below was driven end to end against devsim on 2026-09-08, dispatching SSCC
 * 254138686930300015 to Test Distributor 5413868000108. Four things caught me out, and each is
 * encoded rather than described:
 *
 * 1. BUTTON NAMES CARRY A LEADING SPACE. `Start Invoice` and `Dispatch to <destination>` render an
 *    icon span before the label, so their accessible names are `" Start Invoice"` and
 *    `" Dispatch to Test Distributor"`. An exact match without the space finds nothing. Matching
 *    on a regex sidesteps it — the same trap dashboard.page.ts documents for PrimeNG tabs.
 *
 * 2. THE UNPRINTED-LABELS GATE IS A DOM DIALOG, NOT A NATIVE ONE. Dispatching without printing
 *    raises a PrimeNG confirm: "Unprinted Labels — N SSCC label(s) not yet confirmed printed.
 *    Dispatch anyway?" It must be CLICKED (`.p-confirmdialog-accept-button` — note the
 *    `-button` suffix; `.p-confirmdialog-accept` does not exist). This is the exact opposite of
 *    the billing portal on :8446, where every write is a native `window.confirm` that must be
 *    handled by a dialog listener and cannot be clicked. Confusing the two silently no-ops in one
 *    direction and hangs in the other.
 *
 * 3. THE `p-confirmdialog` CUSTOM ELEMENT IS EMPTY. Its content lives in a sibling
 *    `div.p-confirmdialog`, so querying the custom element finds no buttons at all.
 *
 * 4. DISPATCH IS ASYNCHRONOUS. `POST /portal/operations/ship/draft/{id}` answers 202 and the
 *    verdict arrives separately on `GET /portal/operations/{opId}/stream`. Treating the 202 as
 *    success would report a refused shipment as shipped — which is precisely the mistake the
 *    api-* suite's rules warn about for every async write on this platform.
 */
import { expect, type Page } from '@playwright/test'
import { ensureLoggedIn } from '../../lib/auth'

/** What a dispatch attempt did. `refusal` carries the platform's own words when it declined. */
export interface DispatchOutcome {
  dispatched: boolean
  /** The success panel's text, or the refusal/toast text. Always the platform's own wording. */
  message: string
  /** Packs the success panel reported, or null when it refused. */
  totalPacks: number | null
}

/**
 * Open /shipments and wait until it is actually usable.
 *
 * Anchored on the destination selector, NOT on a heading. The word "Shipping" appears twice on
 * this page — once as the page title and once as the section heading above "Create shipping
 * invoices, scan items…" — so a `getByRole('heading', { name: 'Shipping' })` is a strict-mode
 * violation, and an `.or(...)` built to dodge that was flaky: it resolved before Angular had
 * rendered the form, and the first `startInvoice` call then found no `p-select`.
 *
 * The `p-select` is unique to this screen and is the first thing a caller needs, so waiting for
 * it means "the page is ready" rather than "some text appeared".
 */
export async function openShipping(page: Page): Promise<void> {
  await ensureLoggedIn(page, 'eptts-web', '/shipments')
  await expect(
    page.locator('p-select').first(),
    'the /shipments destination selector should render — it is the first control the flow needs',
  ).toBeVisible({ timeout: 45_000 })
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
}

/**
 * Choose a destination by GLN and open a draft invoice.
 *
 * Matched on GLN rather than name, because the selector lists a distributor AND every one of its
 * branches, each captioned with the same parent name: "Test Distributor" appears once as the
 * entity and again under 40-odd branches like "Main Warehouse / 5413868010008". A name match is
 * ambiguous; the GLN is not.
 */
export async function startInvoice(page: Page, destinationGln: string, invoiceNumber: string): Promise<void> {
  await page.locator('p-select').first().click()
  const search = page.getByRole('searchbox')
  if (await search.count()) await search.fill(destinationGln)

  const option = page.getByRole('option').filter({ hasText: destinationGln }).first()
  await expect(
    option,
    `destination GLN ${destinationGln} should be offered. The selector is known to load only a ` +
      `page of partners per type, so an absent GLN may be that defect rather than a missing party.`,
  ).toBeVisible({ timeout: 20_000 })
  await option.click()

  const number = page.getByPlaceholder('Enter invoice number...')
  await expect(
    number,
    'the invoice number field should enable once a destination is chosen — it reads ' +
      '"Select a destination first" until then',
  ).toBeEnabled({ timeout: 15_000 })
  await number.fill(invoiceNumber)

  // Leading space in the accessible name; matched by regex so it cannot bite.
  await page.getByRole('button', { name: /Start Invoice/ }).click()
  await expect(
    page.getByText(`Invoice: ${invoiceNumber}`),
    `the draft should open for invoice ${invoiceNumber}`,
  ).toBeVisible({ timeout: 20_000 })
}

/** Scan an 18-digit SSCC into the open draft and confirm it was accepted. */
export async function addSscc(page: Page, sscc: string, expectedPacks: number): Promise<void> {
  const scan = page.getByPlaceholder('Scan SSCC barcode...')
  await scan.fill(sscc)
  await scan.press('Enter')

  await expect(
    page.getByText(sscc),
    `SSCC ${sscc} should be listed on the draft after scanning`,
  ).toBeVisible({ timeout: 20_000 })
  await expect(
    page.getByText(`${expectedPacks} pack(s) total`),
    `the draft should total ${expectedPacks} packs once ${sscc} is added`,
  ).toBeVisible({ timeout: 20_000 })
}

/**
 * Dispatch the open draft and report what the platform decided.
 *
 * Does NOT assert success. A refusal is the expected outcome for the Enforce case, so the caller
 * decides what the result should have been — and gets the platform's own words either way, which
 * matters because "the right refusal" is a separate question from "was it refused".
 */
export async function dispatch(page: Page, timeoutMs = 90_000): Promise<DispatchOutcome> {
  await page.getByRole('button', { name: /Dispatch to/ }).click()

  // The unprinted-labels gate. Scoped to the sibling div because the custom element carries no
  // content, and accepted rather than dismissed: printing labels is not what any of these cases
  // are about.
  //
  // WAITED FOR, NOT SAMPLED. An earlier version asked `isVisible()` once, immediately after the
  // click. When the dialog had not rendered yet that check was false, the confirm was skipped,
  // the dispatch was therefore never confirmed — and the draft simply stayed a Draft while this
  // function waited out its full 90 seconds and reported "no outcome". It looked exactly like a
  // platform hang: shipment QA-SHIP-ZTGMTTC17OX5IO sat in the history as Draft while three
  // earlier ones from the same code were In Transit. Intermittent, and entirely ours.
  //
  // A miss is tolerated rather than fatal because the gate only appears when labels are
  // unprinted, which is a state the platform decides, not this helper.
  const accept = page.locator('div.p-confirmdialog .p-confirmdialog-accept-button')
  const appeared = await accept
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
  if (appeared) {
    await accept.click()
    // And confirm it actually closed, so a swallowed click cannot masquerade as a confirmed one.
    await accept.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {})
  }

  // Dispatch is async, so poll for whichever of the two outcomes lands.
  const success = page.getByText('Shipment dispatched successfully.')
  const failure = page.locator('.p-toast-message, [role=alert]').filter({ hasText: /fail|error|block|unpaid|refus|denied/i })

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await success.isVisible().catch(() => false)) {
      const panel = await page.locator('main').innerText()
      const packs = /Total Packs:\s*(\d+)/.exec(panel)
      return {
        dispatched: true,
        message: panel.slice(panel.indexOf('Shipment Dispatched')).replace(/\s+/g, ' ').trim().slice(0, 400),
        totalPacks: packs ? Number(packs[1]) : null,
      }
    }
    if (await failure.first().isVisible().catch(() => false)) {
      return {
        dispatched: false,
        message: (await failure.first().innerText()).replace(/\s+/g, ' ').trim().slice(0, 400),
        totalPacks: null,
      }
    }
    await page.waitForTimeout(1_000)
  }

  return {
    dispatched: false,
    message:
      `no outcome after ${Math.round(timeoutMs / 1000)}s — neither the "Shipment dispatched ` +
      `successfully." panel nor an error appeared. Dispatch answers 202 and resolves on ` +
      `/portal/operations/{id}/stream, so this is an unresolved async operation rather than a refusal.`,
    totalPacks: null,
  }
}

/** Open the receiving screen, for the party a consignment was sent to. */
export async function openReceiving(page: Page): Promise<void> {
  await ensureLoggedIn(page, 'eptts-web', '/shipments/receive')
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
}
