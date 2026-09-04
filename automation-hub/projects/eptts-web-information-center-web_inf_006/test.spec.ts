/**
 * WEB_INF_006 — Validate that Upcoming Dates lists announcements carrying an event date
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the panel is driven by eventDate and renders that date.
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

test('WEB_INF_006 — Validate that Upcoming Dates lists announcements carrying an event date', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.expectPanelHolds(page, 'Upcoming Dates', [ic.FIXTURES.DLN_003])
  expect(await ic.panel(page, 'Upcoming Dates').innerText(), 'the event date is rendered')
    .toContain('Sep 30, 2026')
})
