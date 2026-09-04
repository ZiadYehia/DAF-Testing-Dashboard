/**
 * WEB_INF_005 — Validate that an announcement flagged as an urgent banner renders above the panels
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the urgent region renders ahead of the first panel section in .ic-page.
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

test('WEB_INF_005 — Validate that an announcement flagged as an urgent banner renders above the panels', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  const banner = await ic.urgentBannerText(page)
  expect(banner, 'the urgent announcement renders above the first panel')
    .toContain(ic.FIXTURES.URG_006)
})
