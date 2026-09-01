/**
 * WEB_MOB_003 — Validate that the table displays all expected columns
 *
 * Feature: web-mobile-versions   Route: /mobile-versions
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

test('WEB_MOB_003 — Validate that the table displays all expected columns', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/mobile-versions')
    .expectEnglish()
    .expectTableColumns(['ID', 'ANDROID VERSION', 'ANDROID STATUS', 'IOS VERSION', 'IOS STATUS', 'CREATED'])
})
