/**
 * WEB_SBP_001 — B2B Partners renders with its content and primary controls.
 *
 * Feature: web-settings-b2b-partners   Route: /admin
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

test('WEB_SBP_001 — B2B Partners renders', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/admin', 'B2B Partners')
    .expectEnglish()
    .expectControls(['Add Partner'])
    .expectTableColumns(['Name', 'Type', 'GLN', 'API Key', 'Status'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
