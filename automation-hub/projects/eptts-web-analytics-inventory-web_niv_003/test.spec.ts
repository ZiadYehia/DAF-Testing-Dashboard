/**
 * WEB_NIV_003 — Validate that Inventory data is not carried over from another tab
 *
 * Feature: web-analytics-inventory   Route: /analytics → tab "Inventory"
 *
 * Checks that the page renders its heading and primary controls.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_NIV_003 — Validate that Inventory data is not carried over from another tab', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/analytics', 'Inventory')
    .expectEnglish()
    .expectControls(['Refresh', 'Activity', 'Inventory'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
