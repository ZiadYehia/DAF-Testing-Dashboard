/**
 * WEB_INF_003 — Validate that Latest Updates lists each visible announcement with its category, date, title and summary
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the list holds exactly the targeted fixtures, and that a card carries its metadata.
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

test('WEB_INF_003 — Validate that Latest Updates lists each visible announcement with its category, date, title and summary', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.expectPanelHolds(page, 'Latest Updates', ic.VISIBLE_TAGS)
  const text = await ic.latestUpdates(page).innerText()
  expect(text, 'a card shows its category').toContain('Training')
  expect(text, 'a card shows its summary')
    .toContain('A live webinar covering the Masar Agent 2.4 scanning workflow.')
  expect(text, 'an untargeted announcement is withheld').not.toContain(ic.FIXTURES.REG_001)
})
