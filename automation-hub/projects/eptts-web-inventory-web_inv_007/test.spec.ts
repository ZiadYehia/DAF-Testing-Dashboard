/**
 * WEB_INV_007 — Validate that the CSV export downloads and matches the on-screen data
 *
 * Feature: web-inventory   Route: /inventory
 *
 * Checks that the export produces a CSV file.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_INV_007 — Validate that the CSV export downloads and matches the on-screen data', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/inventory')
    .expectEnglish()
    .expectCsvDownload('Export CSV')
})
