/**
 * WEB_SGE_002 — Validate that the Geography table displays all expected columns
 *
 * Feature: web-settings-geography   Route: /admin → tab "Geography"
 *
 * Checks that the table exposes every column the page promises.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_SGE_002 — Validate that the Geography table displays all expected columns', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/admin', 'Geography')
    .expectEnglish()
    .expectTableColumns(['Code', 'Name (EN)', 'Name (AR)'])
})
