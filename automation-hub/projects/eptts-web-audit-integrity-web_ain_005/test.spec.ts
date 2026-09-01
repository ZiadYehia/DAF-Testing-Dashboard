/**
 * WEB_AIN_005 — Validate that search filters the Integrity list
 *
 * Feature: web-audit-integrity   Route: /audit → tab "Integrity"
 *
 * Checks that search narrows the result set rather than ignoring the input.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_AIN_005 — Validate that search filters the Integrity list', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/audit', 'Integrity')
    .expectEnglish()
    .expectSearchFilters('Filter by', 'a')
})
