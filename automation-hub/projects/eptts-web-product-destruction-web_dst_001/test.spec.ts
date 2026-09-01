/**
 * WEB_DST_001 — Validate that the Product Destruction page renders with its heading and primary controls
 *
 * Feature: web-product-destruction   Route: /destruction
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

test('WEB_DST_001 — Validate that the Product Destruction page renders with its heading and primary controls', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/destruction')
    .expectEnglish()
    .expectHeading('Product Destruction')
    .expectControls(['Initiate Destruction Request'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
