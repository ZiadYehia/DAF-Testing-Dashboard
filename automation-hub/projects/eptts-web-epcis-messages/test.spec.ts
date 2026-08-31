/**
 * WEB_EPC_001 — EPCIS Messages renders with its heading and primary controls.
 *
 * Feature: web-epcis-messages   Route: /epcis-b2b
 *
 * Read-only: this navigates and asserts, and submits nothing. Every P1 page here can write
 * an EPCIS event against production, so a render check is the part that is safe to replay
 * on any schedule.
 *
 * Elements asserted below are what discovery observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_EPC_001 — EPCIS Messages renders', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/epcis-b2b')
    .expectEnglish()
    .expectHeading('EPCIS Messages')
    .expectControls(['Send', 'Clear', 'Refresh'])
    .expectTableColumns(['MESSAGE ID', 'SENDER', 'RECEIVER', 'EVENT TYPE', 'STATUS'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
