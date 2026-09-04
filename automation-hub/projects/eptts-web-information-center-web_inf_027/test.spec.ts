/**
 * WEB_INF_027 — Validate that a script tag entered in search is not executed by the page
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks a script payload is not executed and is not injected into the DOM.
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

test('WEB_INF_027 — Validate that a script tag entered in search is not executed by the page', async ({ page }) => {
  test.slow()
  let dialogFired = false
  page.on('dialog', async (d) => { dialogFired = true; await d.dismiss() })
  await DashboardPage.open(page, '/information-center')
  await ic.search(page, '<script>alert(1)</script>')
  expect(dialogFired, 'no alert dialog is raised').toBe(false)
  expect(await ic.showsEmptyState(page), 'the payload matches nothing').toBe(true)
  expect(await page.locator('main script').count(), 'no script element is injected into main')
    .toBe(0)
})
