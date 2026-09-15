/**
 * BIL_INV_010 — Validate that the invoice total equals the billing charge plus the eService fee
 *
 * Feature: billing-invoices   Portal: https://192.168.225.195:8446 → "📄 Invoices"
 *
 * Checks the arithmetic of every listed invoice by recomputing it, rather than reading the total
 * and agreeing with itself.
 *
 * This feature's knowledge note asks for exactly that: verify `subtotal + fees = total`
 * independently rather than trusting the displayed total. A case that read the total and
 * asserted it equalled itself would pass against any arithmetic defect at all.
 *
 * Money is compared in integer cents. Comparing the parsed floats would make 0.1 + 0.2 fail a
 * correct invoice, which is a worse outcome than the defect being looked for.
 *
 * Read-only: reads the table.
 */
import { expect, test } from '@playwright/test'
import { BillingPage, MFG_INVOICE_COLUMNS } from '../../pages/eptts-web/billing.page'
import { stateFor } from '../../lib/apps'

test.use({
  storageState: stateFor('eptts-billing'),
  ignoreHTTPSErrors: true,
})

/**
 * A money cell like "3038.00 EGP" as { cents, currency }.
 *
 * The currency is kept rather than stripped: three amounts that add up correctly but are not all
 * in the same currency is a real defect, and dropping the suffix would hide it.
 */
function money(cell: string): { cents: number; currency: string } {
  const text = (cell ?? '').replace(/,/g, '').trim()
  const m = /^(\d+(?:\.\d+)?)\s*([A-Za-z]{3})?$/.exec(text)
  if (!m) throw new Error(`cannot read "${cell}" as an amount`)
  return { cents: Math.round(Number(m[1]) * 100), currency: (m[2] ?? '').toUpperCase() }
}

test('BIL_INV_010 — Validate that the invoice total equals the billing charge plus the eService fee', async ({
  page,
}) => {
  test.slow()

  const billing = BillingPage.openAs(page, 'manufacturer', '📄 Invoices')
  await billing.expectShell().expectTableColumns(MFG_INVOICE_COLUMNS)

  const invoices = await billing.readInvoices()
  test.fixme(
    invoices.length === 0,
    'This MAH has no invoices listed, so there is no arithmetic to check. Run WEB_CSV_009 to ' +
      'raise one by importing a packing CSV. Blocked on test data, not failed.',
  )

  for (const row of invoices) {
    const no = row['Invoice #']
    const charge = money(row['Billing charge'])
    const eservice = money(row['eService'])
    const total = money(row['Total'])

    expect(
      charge.cents + eservice.cents,
      `invoice ${no}: billing charge ${row['Billing charge']} + eService ${row['eService']} ` +
        `should equal the stated total ${row['Total']}`,
    ).toBe(total.cents)

    // All three in one currency. A currency-less cell is tolerated only if none of them carry
    // one, so a list that stops rendering the suffix does not silently pass as "all equal".
    const currencies = new Set([charge.currency, eservice.currency, total.currency])
    expect(
      currencies.size,
      `invoice ${no}: billing charge, eService and total should all be in one currency, got ` +
        `${[...currencies].join(', ')}`,
    ).toBe(1)

    // Pieces is what the charge is levied on, so a billed invoice with nothing in it is either a
    // phantom charge or a lost line.
    const pieces = Number((row['Pieces'] ?? '').replace(/\D/g, ''))
    expect(pieces, `invoice ${no}: Pieces should be a positive count`).toBeGreaterThan(0)
    if (total.cents > 0) {
      expect(
        pieces,
        `invoice ${no} charges ${row['Total']} so it must bill at least one piece`,
      ).toBeGreaterThan(0)
    }
  }
})
