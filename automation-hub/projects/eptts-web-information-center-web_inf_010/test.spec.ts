/**
 * WEB_INF_010 — Validate that the detail dialog closes and leaves the page state intact
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks Escape dismisses the dialog without disturbing the list behind it.
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

test('WEB_INF_010 — Validate that the detail dialog closes and leaves the page state intact', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  const before = await ic.tagsIn(page, 'Latest Updates')
  const dialog = await ic.openDetail(page, ic.FIXTURES.DLN_003)
  await page.keyboard.press('Escape')
  await expect(dialog, 'Escape closes the dialog').toBeHidden({ timeout: 10_000 })
  expect(await ic.tagsIn(page, 'Latest Updates'), 'the list behind the dialog is unchanged')
    .toEqual(before)
})
