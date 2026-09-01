/**
 * WEB_WHK_002 — Validate that /webhook-history is reachable by direct URL and survives a refresh
 *
 * Feature: web-webhook-history   Route: /webhook-history
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

test('WEB_WHK_002 — Validate that /webhook-history is reachable by direct URL and survives a refresh', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/webhook-history')
    .expectEnglish()
    .expectSurvivesReload('/webhook-history')
    .expectNoErrorBanner()
})
