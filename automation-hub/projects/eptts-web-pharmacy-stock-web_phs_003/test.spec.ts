/**
 * WEB_PHS_003 — Validate that the table displays all expected columns
 *
 * Feature: web-pharmacy-stock   Route: /pharmacy-stock
 *
 * Checks that the table exposes every column the page promises.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_PHS_003 — Validate that the table displays all expected columns', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/pharmacy-stock')
    .expectEnglish()
    .expectTableColumns(['PHARMACY', 'GLN', 'PRODUCT', 'ITEM CODE', 'INVOICE', 'RECEIVED'])
})
