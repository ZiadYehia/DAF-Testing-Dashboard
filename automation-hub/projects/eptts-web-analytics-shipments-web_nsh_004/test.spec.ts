/**
 * WEB_NSH_004 — Validate that the Shipments tab reloads its data after a page refresh
 *
 * Feature: web-analytics-shipments   Route: /analytics → tab "Shipments"
 *
 * Checks that the route is reachable directly and survives a refresh — this is a fragment-mode OIDC SPA, so a reload re-runs the whole auth round trip.
 *
 * Read-only: navigates and asserts, submits nothing. Elements asserted are what discovery
 * observed on the page, not a specification.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_NSH_004 — Validate that the Shipments tab reloads its data after a page refresh', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/analytics', 'Shipments')
    .expectEnglish()
    .expectSurvivesReload('/analytics')
    .expectNoErrorBanner()
})
