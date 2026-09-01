/**
 * WEB_RCV_006 — Validate that search handles a no-match value without error
 *
 * Feature: web-receiving   Route: /shipments/receive
 *
 * Checks that a filter matching nothing shows an empty state rather than stale rows or an endless spinner.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_RCV_006 — Validate that search handles a no-match value without error', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/shipments/receive')
    .expectEnglish()
    .expectEmptyState('Search by', 'zzz-no-such-record-zzz')
})
