/**
 * WEB_EPC_001 — Validate that the EPCIS Messages page renders with its heading and primary controls
 *
 * Feature: web-epcis-messages   Route: /epcis-b2b
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

test('WEB_EPC_001 — Validate that the EPCIS Messages page renders with its heading and primary controls', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/epcis-b2b')
    .expectEnglish()
    .expectHeading('EPCIS Messages')
    .expectControls(['Send', 'Clear', 'Refresh'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
