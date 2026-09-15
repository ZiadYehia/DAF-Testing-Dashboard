/**
 * BIL_CFG_009 — Validate that a manufacturer cannot reach the fee configuration page
 *
 * Feature: billing-configuration   Portal: https://192.168.225.195:8446 → "⚙️ Configuration"
 *
 * Checks that the billing mode is out of a manufacturer's reach in both senses: the navigation
 * does not offer it, and the surface itself does not render when reached another way.
 *
 * Billing mode is a tenant-wide switch — the page says "applies live, no redeploy" — and one of
 * its settings blocks shipping for every party. A manufacturer able to set it could unblock its
 * own consignments, so this is a privilege boundary rather than a menu-tidiness question.
 *
 * The feature's own Edge Cases say a hidden menu entry is not sufficient, so the case asserts
 * the controls are absent from the DOM, not merely unlisted in the nav. It stops short of
 * POSTing a mode change: that would set a tenant-wide switch if the platform were wrong, and
 * BIL_CFG_008 is the case that owns writing the mode, with a restore.
 *
 * Read-only: reads the navigation and the DOM.
 */
import { expect, test } from '@playwright/test'
import { BillingPage } from '../../pages/eptts-web/billing.page'
import { stateFor } from '../../lib/apps'
import { requireEnv } from '../../lib/env'

test.use({
  storageState: stateFor('eptts-billing'),
  ignoreHTTPSErrors: true,
})

test('BIL_CFG_009 — Validate that a manufacturer cannot reach the fee configuration page', async ({
  page,
}) => {
  test.slow()

  const billing = BillingPage.openAs(page, 'manufacturer')
  await billing
    .expectShell()
    .expectIdentity(requireEnv('EPTTS_WEB_MFG_USERNAME'), 'manufacturer')
    // 1. The role's whole menu, asserted as a set. Platform Admin gets five entries; this role
    //    gets three, and Reports and Configuration are the two it does not get.
    .expectNavItems(['🧾 Unbilled Operations', '📄 Invoices'])

  // `🏠 Dashboard` is an <a href> out to :8444 rather than a nav button, so it is excluded from
  // the set above on purpose. Confirm that reading of it, so the set assertion cannot be passing
  // because the item silently changed shape.
  const home = page.getByRole('link', { name: /Dashboard/ })
  await expect(home, 'the Dashboard entry is a link out to the main dashboard').toHaveAttribute(
    'href',
    /8444/,
  )

  // 2. No Configuration entry in any form.
  for (const name of [/Configuration/, /Reports/]) {
    expect(
      await page.getByRole('button', { name }).count(),
      `a manufacturer must not be offered "${name.source}" in the billing portal`,
    ).toBe(0)
  }

  // 3. And the configuration surface is not merely unlisted — it is not rendered. `#c-mode` is
  //    the mode selector and `Apply mode` its commit button; either one present for this role
  //    would mean the page had been served and only the menu link withheld.
  expect(
    await page.locator('#c-mode').count(),
    'the billing mode selector must not be present in the DOM for a manufacturer',
  ).toBe(0)
  expect(
    await page.getByRole('button', { name: 'Apply mode' }).count(),
    'the Apply mode control must not be present in the DOM for a manufacturer',
  ).toBe(0)
  // The page's real section heading, verified live 2026-09-08. An earlier version of this
  // assertion looked for "Fee Configuration" — a heading workflow.md records but the page does
  // NOT render for anybody, so it passed vacuously and would have passed as admin too.
  expect(
    await page.getByRole('heading', { name: /Billing mode/i }).count(),
    'the billing-mode section must not render for a manufacturer',
  ).toBe(0)
  expect(
    await page.getByRole('heading', { name: /Pricing equation/i }).count(),
    'the price-band section must not render for a manufacturer',
  ).toBe(0)
})
