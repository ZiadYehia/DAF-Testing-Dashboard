/**
 * WEB_INF_022 — Validate that the chosen language persists across a page reload
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks localStorage.lang carries the choice through a reload.
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

test('WEB_INF_022 — Validate that the chosen language persists across a page reload', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center').expectEnglish()
  await page.locator('button.lang-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('main .ic-page').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(2000)

  await expect(page.locator('html'), 'Arabic survives the reload').toHaveAttribute('lang', 'ar')
  await expect(page.locator('html'), 'RTL survives the reload').toHaveAttribute('dir', 'rtl')
  expect(await page.evaluate(() => localStorage.getItem('lang')), 'the choice is persisted')
    .toBe('ar')
})
