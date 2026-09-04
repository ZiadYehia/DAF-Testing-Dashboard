/**
 * WEB_INF_008 — Validate that Support and Help lists the system category
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the panel is driven by the system category alone.
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

test('WEB_INF_008 — Validate that Support and Help lists the system category', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.expectPanelHolds(page, 'Support and Help', [ic.FIXTURES.SYS_004])
})
