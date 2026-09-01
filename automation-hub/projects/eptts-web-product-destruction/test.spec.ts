/**
 * WEB_DST_001 — Product Destruction renders with its content and primary controls.
 *
 * Feature: web-product-destruction   Route: /destruction
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

test('WEB_DST_001 — Product Destruction renders', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/destruction')
    .expectEnglish()
    .expectHeading('Product Destruction')
    .expectControls(['Initiate Destruction Request'])
    .expectTableColumns(['ID', 'REASON', 'STATUS', 'INITIATOR GLN', 'ITEMS'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
