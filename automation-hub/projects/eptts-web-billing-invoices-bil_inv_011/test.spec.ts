/**
 * BIL_INV_011 — Validate that a manufacturer sees only its own invoices and no other MAH identifier
 *
 * Feature: billing-invoices   Portal: https://192.168.225.195:8446 → "📄 Invoices"
 *
 * Checks tenant isolation on a financial list: the manufacturer's view carries no MAH GLN column,
 * offers no filter by MAH GLN, and leaks no other party's GLN into any cell.
 *
 * The column difference is not cosmetic. Platform Admin sees ten columns including MAH GLN and a
 * `f-gln` filter, because an admin legitimately spans parties. A manufacturer seeing either would
 * mean the page was rendering the cross-party view to a single-party role — and the filter is the
 * more serious of the two, since a filter implies a queryable set behind it.
 *
 * Read-only: reads the header, the filters and every cell.
 */
import { expect, test } from '@playwright/test'
import { BillingPage, MFG_INVOICE_COLUMNS } from '../../pages/eptts-web/billing.page'
import { stateFor } from '../../lib/apps'
import { requireEnv } from '../../lib/env'

test.use({
  storageState: stateFor('eptts-billing'),
  ignoreHTTPSErrors: true,
})

test('BIL_INV_011 — Validate that a manufacturer sees only its own invoices and no other MAH identifier', async ({
  page,
}) => {
  test.slow()

  const ownGln = requireEnv('EPTTS_WEB_MFG_GLN')

  const billing = BillingPage.openAs(page, 'manufacturer', '📄 Invoices')
  await billing
    .expectShell()
    // Assert the identity before the isolation claim. Read as the wrong role this whole case
    // would pass or fail for reasons having nothing to do with isolation.
    .expectIdentity(requireEnv('EPTTS_WEB_MFG_USERNAME'), 'manufacturer')
    // 1. Nine columns, and no MAH GLN among them.
    .expectTableColumns(MFG_INVOICE_COLUMNS)

  const headers = (await page.locator('table thead th').allInnerTexts()).map((h) =>
    h.trim().toLowerCase(),
  )
  expect(
    headers.some((h) => /mah|gln/.test(h)),
    'the manufacturer view must not carry a MAH GLN column — that is the cross-party admin view',
  ).toBe(false)

  // 2. No filter by MAH GLN. Checked by id and by placeholder, because a filter is a stronger
  //    signal than a column: it implies a set of other parties that could be selected.
  expect(
    await page.locator('#f-gln').count(),
    'the manufacturer view must not offer a MAH GLN filter',
  ).toBe(0)
  expect(
    await page.getByPlaceholder(/mah gln/i).count(),
    'the manufacturer view must not offer a MAH GLN filter',
  ).toBe(0)

  // 3. No foreign GLN anywhere in the list. A 13-digit run is the GS1 shape; the invoice
  //    numbers (INV-YYYYMMDD-NNNNNN) and money cells cannot collide with it, and the acting
  //    party's own GLN is allowed if it appears at all.
  const invoices = await billing.readInvoices()
  test.fixme(
    invoices.length === 0,
    'This MAH has no invoices listed, so there is nothing to inspect for leakage. Run ' +
      'WEB_CSV_009 to raise one. Blocked on test data, not failed.',
  )

  const foreign = new Set<string>()
  for (const row of invoices) {
    for (const [column, cell] of Object.entries(row)) {
      for (const match of (cell ?? '').matchAll(/(?<!\d)\d{13}(?!\d)/g)) {
        if (match[0] !== ownGln) foreign.add(`${row['Invoice #']} / ${column}: ${match[0]}`)
      }
    }
  }
  expect(
    [...foreign],
    'no GLN other than the acting manufacturer should appear in its own invoice list',
  ).toEqual([])
})
