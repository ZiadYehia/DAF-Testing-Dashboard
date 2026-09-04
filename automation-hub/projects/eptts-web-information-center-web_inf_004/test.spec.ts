/**
 * WEB_INF_004 — Validate that the Pinned Announcements panel lists only pinned announcements
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the pinned panel is driven by isPinned and holds nothing else.
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

test('WEB_INF_004 — Validate that the Pinned Announcements panel lists only pinned announcements', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.expectPanelHolds(page, 'Pinned Announcements',
    [ic.FIXTURES.SYS_004, ic.FIXTURES.UGD_005])
})
