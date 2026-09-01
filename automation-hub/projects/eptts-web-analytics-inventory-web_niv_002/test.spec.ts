/**
 * WEB_NIV_002 — Validate that the Inventory table displays all expected columns
 *
 * Feature: web-analytics-inventory   Route: /analytics → tab "Inventory"
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

test('WEB_NIV_002 — Validate that the Inventory table displays all expected columns', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/analytics', 'Inventory')
    .expectEnglish()
    .expectTableColumns(['LOCATION', 'PRODUCT', 'GTIN', 'BATCH', 'EXPIRY', 'ON-HAND'])
})
