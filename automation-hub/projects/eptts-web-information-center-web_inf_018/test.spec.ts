/**
 * WEB_INF_018 — Validate that the category clear icon resets the filter to All categories
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the clear affordance exists and restores the unfiltered list.
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

test('WEB_INF_018 — Validate that the category clear icon resets the filter to All categories', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.chooseCategory(page, 'Regulatory')
  await ic.expectPanelHolds(page, 'Latest Updates', [ic.FIXTURES.URG_006])
  expect(await ic.clearCategory(page), 'the dropdown offers a clear icon').toBe(true)
  await expect(ic.latestUpdates(page).locator('[role=combobox]'), 'the filter is reset')
    .toHaveText(/All categories/)
  await ic.expectPanelHolds(page, 'Latest Updates', ic.VISIBLE_TAGS)
})
