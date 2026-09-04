/**
 * WEB_INF_019 — Validate that the search and category filters reset when the page is reloaded
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks filter state is not carried across a reload and never reaches the URL.
 *
 * Read-only: navigates and asserts, submits nothing. Depends on the QA-20260902 fixtures
 * described in data/eptts-web/features/web-information-center/knowledge.md.
 */
import { expect, test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import * as ic from '../../pages/eptts-web/information-center'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_INF_019 — Validate that the search and category filters reset when the page is reloaded', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.chooseCategory(page, 'Regulatory')
  await ic.search(page, 'recall')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await ic.latestUpdates(page).waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(2500)
  expect(page.url(), 'filter state is not written to the URL').not.toContain('category=')
  await expect(ic.latestUpdates(page).locator('[role=combobox]'), 'the category resets')
    .toHaveText(/All categories/)
  await expect(ic.latestUpdates(page).locator('input').first(), 'the search resets')
    .toHaveValue('')
  await ic.expectPanelHolds(page, 'Latest Updates', ic.VISIBLE_TAGS)
})
