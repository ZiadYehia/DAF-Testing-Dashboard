/**
 * WEB_SHP_005 — Validate that the page surfaces a backend failure instead of failing silently
 *
 * Feature: web-shipping   Route: /shipments
 *
 * Checks that a failing API is reported to the user; an empty table after a 500 is indistinguishable from genuinely having no data.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_SHP_005 — Validate that the page surfaces a backend failure instead of failing silently', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/shipments')
    .expectEnglish()
    .expectBackendFailureHandled('v1/entities')
})
