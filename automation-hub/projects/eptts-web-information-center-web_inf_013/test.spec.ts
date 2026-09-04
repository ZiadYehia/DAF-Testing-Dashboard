/**
 * WEB_INF_013 — Validate that search matches Arabic announcement content
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks search reaches the Arabic summary/body, not only the English fields.
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

test('WEB_INF_013 — Validate that search matches Arabic announcement content', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  // The Arabic word for "maintenance", which appears only in QA-20260902-SYS-004.
  await ic.search(page, '\u0635\u064a\u0627\u0646\u0629')
  await ic.expectPanelHolds(page, 'Latest Updates', [ic.FIXTURES.SYS_004])
})
