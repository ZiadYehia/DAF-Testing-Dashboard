/**
 * WEB_INF_009 — Validate that clicking an announcement card opens a detail dialog with the full body and its timestamps
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks the detail dialog carries title, category, both timestamps and the authored body.
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

test('WEB_INF_009 — Validate that clicking an announcement card opens a detail dialog with the full body and its timestamps', async ({ page }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center')
  const dialog = await ic.openDetail(page, ic.FIXTURES.DLN_003)
  const text = (await dialog.innerText()).replace(/\s+/g, ' ')
  expect(text, 'the dialog names the announcement').toContain(ic.FIXTURES.DLN_003)
  expect(text, 'the dialog shows the category').toContain('Deadlines')
  expect(text, 'the dialog shows when it was published').toContain('Published:')
  expect(text, 'the dialog shows when it takes effect').toContain('Effective:')
  expect(text, 'the dialog shows the authored body')
    .toContain('re-register every affected GTIN in the Registry portal')
})
