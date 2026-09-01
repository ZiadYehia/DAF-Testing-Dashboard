/**
 * WEB_SBP_002 — Validate that the B2B Partners table displays all expected columns
 *
 * Feature: web-settings-b2b-partners   Route: /admin → tab "B2B Partners"
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

test('WEB_SBP_002 — Validate that the B2B Partners table displays all expected columns', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/admin', 'B2B Partners')
    .expectEnglish()
    .expectTableColumns(['Name', 'Type', 'GLN', 'API Key', 'Status', 'Created'])
})
