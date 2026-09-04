/**
 * WEB_INF_020 — Validate that the language toggle switches the page to Arabic in right-to-left layout
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the AR toggle sets lang/dir and translates the headings and the placeholder.
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

test('WEB_INF_020 — Validate that the language toggle switches the page to Arabic in right-to-left layout', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center').expectEnglish()
  await page.locator('button.lang-toggle').click()
  await expect(page.locator('html'), 'the document switches to Arabic').toHaveAttribute('lang', 'ar')
  await expect(page.locator('html'), 'the document switches to RTL').toHaveAttribute('dir', 'rtl')
  await expect(page.locator('button.lang-toggle'), 'the toggle now offers English').toHaveText('EN')
  const headings = await page.locator('main h2, main h3').allInnerTexts()
  expect(headings.length, 'the page still renders its heading and five panels').toBe(6)
  for (const h of headings) {
    expect(h, `heading "${h}" is rendered in Arabic`).toMatch(/[\u0600-\u06FF]/)
  }
  const placeholder = await page.locator('main input').first().getAttribute('placeholder')
  expect(placeholder ?? '', 'the search placeholder is translated').toMatch(/[\u0600-\u06FF]/)
})
