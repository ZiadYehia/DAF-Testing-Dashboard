/**
 * WEB_SSY_001 — Validate that the System tab opens and loads its own content
 *
 * Feature: web-settings-system   Route: /admin → tab "System"
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

test('WEB_SSY_001 — Validate that the System tab opens and loads its own content', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/admin', 'System')
    .expectEnglish()
    .expectControls(['New POS Partner'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
