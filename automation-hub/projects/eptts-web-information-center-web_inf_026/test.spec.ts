/**
 * WEB_INF_026 — Validate that a SQL fragment entered in search is treated as a literal search term
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the search parameter is parameterised: the fragment matches nothing and destroys nothing.
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

test('WEB_INF_026 — Validate that a SQL fragment entered in search is treated as a literal search term', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.search(page, "'; DROP TABLE announcements;--")
  expect(await ic.showsEmptyState(page), 'the fragment matches nothing').toBe(true)
  await expect(page.locator('.p-toast-message'), 'no database error is surfaced')
    .toHaveCount(0)
  // The real assertion: the data is still there afterwards.
  await ic.search(page, '')
  await ic.expectPanelHolds(page, 'Latest Updates', ic.VISIBLE_TAGS)
})
