/**
 * WEB_SSY_005 — Validate that System never displays a full API key
 *
 * Feature: web-settings-system   Route: /admin → tab "System"
 *
 * Checks that no API key is rendered in full — the platform cannot re-display an issued key, so one shown on screen is a long-lived credential leaked into the UI.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_SSY_005 — Validate that System never displays a full API key', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/admin', 'System')
    .expectEnglish()
    .expectNoFullApiKey()
})
