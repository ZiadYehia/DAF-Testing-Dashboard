/**
 * WEB_WHK_005 — Validate that a non-privileged role cannot reach this page
 *
 * Feature: web-webhook-history   Route: /webhook-history
 *
 * Checks that a role without permission is refused, not merely un-linked in the menu.
 *
 * Runs as the MANUFACTURER, not the admin — role isolation cannot be tested from a privileged
 * session. That this route blocks was measured (scripts/eptts-web-role-matrix.js), not assumed:
 * a manufacturer legitimately uses Shipping and Trace, so this check is only generated for
 * routes the platform actually refuses.
 *
 * Read-only: navigates and asserts, submits nothing.
 */
import { test, expect } from '@playwright/test'
import { ensureRoleState } from '../../pages/eptts-web/roles'
import { baseUrl } from '../../lib/apps'

test.use({ ignoreHTTPSErrors: true })

test('WEB_WHK_005 — Validate that a non-privileged role cannot reach this page', async ({ browser }) => {
  test.slow()
  const storageState = await ensureRoleState('manufacturer')
  const ctx = await browser.newContext({ storageState, ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  try {
    await page.goto(baseUrl('eptts-web') + '/webhook-history', { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(1500)

    const { path: landed, text } = await page.evaluate(() => ({
      path: location.pathname,
      text: document.body.innerText.slice(0, 400),
    }))
    const refused = landed !== '/webhook-history' ||
      /unauthori[sz]ed|forbidden|access denied|not permitted|no permission/i.test(text)

    expect(
      refused,
      `a manufacturer must not reach /webhook-history — landed on ${landed}`,
    ).toBe(true)
  } finally {
    await ctx.close()
  }
})
