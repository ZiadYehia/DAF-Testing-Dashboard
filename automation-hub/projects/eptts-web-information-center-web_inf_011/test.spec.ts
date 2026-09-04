/**
 * WEB_INF_011 — Validate that opening an announcement detail increments its recorded view count
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Reads VIEWS on /admin/announcements, opens the detail once, and re-reads it.
 *
 * NOT read-only: it deliberately increments a counter on a QA fixture. That is the only
 * way to observe the behaviour, and the counter is test data.
 *
 * Depends on the QA-20260902 fixtures described in
 * data/eptts-web/features/web-information-center/knowledge.md.
 */
import { expect, test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import * as ic from '../../pages/eptts-web/information-center'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
// Specs here that switch to Arabic do so in their OWN context: the state FILE is not
// rewritten, so the next spec still starts in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_INF_011 — Validate that opening an announcement detail increments its recorded view count', async ({ page }) => {
  test.slow()
  const viewsFor = async (tag: string): Promise<number> => {
    await DashboardPage.open(page, '/admin/announcements')
    const row = page.locator('main tbody tr').filter({ hasText: tag })
    await row.first().waitFor({ state: 'visible', timeout: 30_000 })
    const cells = row.first().locator('td')
    return Number((await cells.nth(4).innerText()).trim())
  }
  const before = await viewsFor(ic.FIXTURES.DLN_003)

  await DashboardPage.open(page, '/information-center')
  const dialog = await ic.openDetail(page, ic.FIXTURES.DLN_003)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden({ timeout: 10_000 })

  const after = await viewsFor(ic.FIXTURES.DLN_003)
  expect(after, `one detail open raises the view count from ${before}`).toBe(before + 1)
})
