/**
 * WEB_INF_030 — Validate that a panel with no matching announcements renders its empty state
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks an unpopulated category shows the empty state while keeping its controls.
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

test('WEB_INF_030 — Validate that a panel with no matching announcements renders its empty state', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.chooseCategory(page, 'Integration')
  expect(await ic.showsEmptyState(page), 'the panel shows its empty state').toBe(true)
  await expect(ic.latestUpdates(page).locator('h3'), 'the panel heading remains')
    .toHaveCount(1)
  await expect(ic.latestUpdates(page).locator('input').first(), 'the search control remains')
    .toBeVisible()
})
