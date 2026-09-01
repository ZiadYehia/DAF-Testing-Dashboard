/**
 * WEB_SUL_002 — Validate that the User Locks table displays all expected columns
 *
 * Feature: web-settings-user-locks   Route: /admin → tab "User Locks"
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

test('WEB_SUL_002 — Validate that the User Locks table displays all expected columns', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/admin', 'User Locks')
    .expectEnglish()
    .expectTableColumns(['Email', 'Entity', 'Role', 'Lock Status', 'Actions'])
})
