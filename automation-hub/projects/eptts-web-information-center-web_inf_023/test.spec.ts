/**
 * WEB_INF_023 — Validate that an announcement not targeted to the signed-in user is withheld from the page
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks a published announcement with no audience row is absent from every surface.
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

test('WEB_INF_023 — Validate that an announcement not targeted to the signed-in user is withheld from the page', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  const whole = await page.locator('main .ic-page').innerText()
  expect(whole, 'the untargeted announcement appears nowhere on the page')
    .not.toContain(ic.FIXTURES.REG_001)
  await ic.search(page, 'REG-001')
  expect(await ic.showsEmptyState(page), 'searching for it returns the empty state').toBe(true)
  await ic.search(page, '')
  await ic.chooseCategory(page, 'Regulatory')
  await ic.expectPanelHolds(page, 'Latest Updates', [ic.FIXTURES.URG_006])
})
