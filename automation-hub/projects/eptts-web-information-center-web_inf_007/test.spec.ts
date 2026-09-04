/**
 * WEB_INF_007 — Validate that Guides and Resources lists the training and user-guide categories
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the panel aggregates exactly the training and user_guides categories.
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

test('WEB_INF_007 — Validate that Guides and Resources lists the training and user-guide categories', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.expectPanelHolds(page, 'Guides and Resources',
    [ic.FIXTURES.TRN_002, ic.FIXTURES.UGD_005])
})
