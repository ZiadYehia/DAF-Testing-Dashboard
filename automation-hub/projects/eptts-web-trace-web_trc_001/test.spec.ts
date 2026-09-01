/**
 * WEB_TRC_001 — Validate that the Trace page renders with its heading and primary controls
 *
 * Feature: web-trace   Route: /trace
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

test('WEB_TRC_001 — Validate that the Trace page renders with its heading and primary controls', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/trace')
    .expectEnglish()
    .expectHeading('Trace')
    .expectControls(['Trace Pack', 'Search for Parent Container', 'Trace'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
