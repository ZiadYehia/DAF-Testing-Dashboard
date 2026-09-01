/**
 * WEB_ARE_005 — Validate that search filters the Regulatory events list
 *
 * Feature: web-audit-regulatory-events   Route: /audit → tab "Regulatory events"
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

test('WEB_ARE_005 — Validate that search filters the Regulatory events list', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/audit', 'Regulatory events')
    .expectEnglish()
    .expectSearchFilters('Search descriptions', 'a')
})
