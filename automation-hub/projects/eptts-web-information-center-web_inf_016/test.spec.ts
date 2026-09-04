/**
 * WEB_INF_016 — Validate that clearing the search field restores the unfiltered list
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks emptying the search box reloads the full result set.
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

test('WEB_INF_016 — Validate that clearing the search field restores the unfiltered list', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.search(page, 'webinar')
  await ic.expectPanelHolds(page, 'Latest Updates', [ic.FIXTURES.TRN_002])
  await ic.search(page, '')
  await ic.expectPanelHolds(page, 'Latest Updates', ic.VISIBLE_TAGS)
})
