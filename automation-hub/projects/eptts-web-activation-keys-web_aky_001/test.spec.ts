/**
 * WEB_AKY_001 — Validate that the Desktop Agent - Activation Keys page renders with its heading and primary controls
 *
 * Feature: web-activation-keys   Route: /activation-keys
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

test('WEB_AKY_001 — Validate that the Desktop Agent - Activation Keys page renders with its heading and primary controls', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/activation-keys')
    .expectEnglish()
    .expectHeading('Desktop Agent - Activation Keys')
    .expectControls(['Generate Keys', 'All (0)', 'Active (0)'])
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
})
