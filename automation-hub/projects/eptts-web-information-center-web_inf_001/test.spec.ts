/**
 * WEB_INF_001 — Validate that the Information Center page renders its heading and every populated panel
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the page renders its heading, all five panel headings and the language toggle.
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

test('WEB_INF_001 — Validate that the Information Center page renders its heading and every populated panel', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
    .expectEnglish()
    .expectHeading('Information Center')
    .expectNoRawTranslationKeys()
    .expectNoErrorBanner()
  for (const h of ['Pinned Announcements', 'Latest Updates', 'Upcoming Dates',
                   'Guides and Resources', 'Support and Help']) {
    await expect(ic.panel(page, h), `panel "${h}" is rendered`).toHaveCount(1)
  }
  await expect(page.locator('button.lang-toggle'), 'the toggle offers Arabic while in English')
    .toHaveText('AR')
})
