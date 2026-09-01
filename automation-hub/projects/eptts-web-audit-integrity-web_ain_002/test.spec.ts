/**
 * WEB_AIN_002 — Validate that the Integrity table displays all expected columns
 *
 * Feature: web-audit-integrity   Route: /audit → tab "Integrity"
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

test('WEB_AIN_002 — Validate that the Integrity table displays all expected columns', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/audit', 'Integrity')
    .expectEnglish()
    .expectTableColumns(['GLN', 'EVENTS', 'FIRST EVENT', 'LAST EVENT', 'LAST VERIFIED', 'VERDICT'])
})
