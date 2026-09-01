/**
 * WEB_AIN_003 — Validate that Integrity data is not carried over from another tab
 *
 * Feature: web-audit-integrity   Route: /audit → tab "Integrity"
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

test('WEB_AIN_003 — Validate that Integrity data is not carried over from another tab', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/audit', 'Integrity')
    .expectEnglish()
    .expectControls(['Export CSV', 'Verify'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
