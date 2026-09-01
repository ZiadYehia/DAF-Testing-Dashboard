/**
 * WEB_SET_006 — Validate that search filters the result set
 *
 * Feature: web-settings-admin   Route: /admin
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

test('WEB_SET_006 — Validate that search filters the result set', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/admin')
    .expectEnglish()
    .expectSearchFilters('Search by', 'a')
})
