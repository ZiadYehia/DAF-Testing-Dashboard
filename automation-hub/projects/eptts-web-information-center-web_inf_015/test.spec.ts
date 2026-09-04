/**
 * WEB_INF_015 — Validate that the search term and the category filter combine rather than replace each other
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks one request carries both parameters, so the filters compose.
 *
 * Read-only: navigates and asserts, submits nothing. Depends on the QA-20260902 fixtures
 * described in data/eptts-web/features/web-information-center/knowledge.md.
 */
import { expect, test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import * as ic from '../../pages/eptts-web/information-center'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_INF_015 — Validate that the search term and the category filter combine rather than replace each other', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.chooseCategory(page, 'Training')
  const composed = page.waitForRequest(
    (r) => r.url().includes('category=training') && r.url().includes('search=webinar'),
    { timeout: 20_000 })
  await ic.search(page, 'webinar')
  await composed
  await ic.expectPanelHolds(page, 'Latest Updates', [ic.FIXTURES.TRN_002])
})
