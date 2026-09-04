/**
 * WEB_INF_012 — Validate that search narrows Latest Updates to announcements matching the term
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the server-side search returns only the matching announcement.
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

test('WEB_INF_012 — Validate that search narrows Latest Updates to announcements matching the term', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.search(page, 'webinar')
  await ic.expectPanelHolds(page, 'Latest Updates', [ic.FIXTURES.TRN_002])
})
