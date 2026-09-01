/**
 * WEB_XML_001 — Validate that the EPCIS XML Transactions page renders with its heading and primary controls
 *
 * Feature: web-epcis-xml-upload   Route: /bulk-upload
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

test('WEB_XML_001 — Validate that the EPCIS XML Transactions page renders with its heading and primary controls', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/bulk-upload')
    .expectEnglish()
    .expectHeading('EPCIS XML Transactions')
    .expectControls(['Download XML template', 'Submit all queued (0)', 'Clear'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
