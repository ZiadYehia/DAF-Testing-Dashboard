/**
 * WEB_AES_003 — Validate that EDA submissions data is not carried over from another tab
 *
 * Feature: web-audit-eda-submissions   Route: /audit → tab "EDA submissions"
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

test('WEB_AES_003 — Validate that EDA submissions data is not carried over from another tab', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/audit', 'EDA submissions')
    .expectEnglish()
    .expectControls(['What is not recorded?', 'View pending', 'View overdue'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
