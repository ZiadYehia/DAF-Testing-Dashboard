/**
 * WEB_INF_017 — Validate that each category value filters Latest Updates to announcements in that category
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks all five populated categories map to exactly their own announcement.
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

test('WEB_INF_017 — Validate that each category value filters Latest Updates to announcements in that category', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  const expected: Record<string, string> = {
    System: ic.FIXTURES.SYS_004,
    Training: ic.FIXTURES.TRN_002,
    Deadlines: ic.FIXTURES.DLN_003,
    'User Guides': ic.FIXTURES.UGD_005,
    Regulatory: ic.FIXTURES.URG_006,
  }
  for (const [label, tag] of Object.entries(expected)) {
    await ic.chooseCategory(page, label)
    await ic.expectPanelHolds(page, 'Latest Updates', [tag])
  }
})
