/**
 * WEB_INF_021 — Validate that an active search term and category survive a language switch
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks switching language preserves the filter state and the filtered result set.
 *
 * Depends on the QA-20260902 fixtures described in
 * data/eptts-web/features/web-information-center/knowledge.md.
 */
import { expect, test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import * as ic from '../../pages/eptts-web/information-center'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
// Specs here that switch to Arabic do so in their OWN context: the state FILE is not
// rewritten, so the next spec still starts in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_INF_021 — Validate that an active search term and category survive a language switch', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center').expectEnglish()
  await ic.chooseCategory(page, 'Regulatory')
  await ic.search(page, 'recall')
  await ic.expectPanelHolds(page, 'Latest Updates', [ic.FIXTURES.URG_006])

  await page.locator('button.lang-toggle').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await page.waitForTimeout(1500)

  // The panel heading is Arabic now, so locate the search box by position instead.
  await expect(page.locator('main input').first(), 'the search term survives the switch')
    .toHaveValue('recall')
  const combo = await page.locator('main [role=combobox]').first().innerText()
  expect(combo, 'the selected category survives the switch, rendered in Arabic')
    .toMatch(/[\u0600-\u06FF]/)
  expect(await page.locator('main .ic-page').innerText(), 'the filtered result is unchanged')
    .toContain(ic.FIXTURES.URG_006)
})
