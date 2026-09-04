/**
 * WEB_INF_014 — Validate that a search term matching nothing renders the empty state without error
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks a no-match search shows the empty state and keeps the page usable.
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

test('WEB_INF_014 — Validate that a search term matching nothing renders the empty state without error', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  await ic.search(page, 'zzzznomatch')
  expect(await ic.showsEmptyState(page), 'the panel shows its empty state').toBe(true)
  expect(await ic.tagsIn(page, 'Latest Updates'), 'no announcement is listed').toEqual([])
  await expect(ic.latestUpdates(page).locator('input').first(), 'the term is retained')
    .toHaveValue('zzzznomatch')
})
