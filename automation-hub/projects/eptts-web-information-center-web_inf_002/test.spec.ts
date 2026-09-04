/**
 * WEB_INF_002 — Validate that /information-center is reachable by direct URL and survives a refresh
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks deep-linking the route and that a refresh renders the same content.
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

test('WEB_INF_002 — Validate that /information-center is reachable by direct URL and survives a refresh', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center').expectHeading('Information Center')
  const before = await ic.tagsIn(page, 'Latest Updates')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await ic.latestUpdates(page).waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(2500)
  expect(new URL(page.url()).pathname, 'the route did not redirect').toBe('/information-center')
  expect(await ic.tagsIn(page, 'Latest Updates'), 'the same announcements render after refresh')
    .toEqual(before)
})
