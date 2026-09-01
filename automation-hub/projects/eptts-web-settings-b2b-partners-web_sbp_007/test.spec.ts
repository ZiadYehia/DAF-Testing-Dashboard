/**
 * WEB_SBP_007 — Validate that B2B Partners rejects a GLN with an invalid check digit
 *
 * Feature: web-settings-b2b-partners   Route: /admin → tab "B2B Partners"
 *
 * Checks that a GLN whose check digit does not compute is refused by the create form.
 *
 * WRITES TO PRODUCTION IF THE PLATFORM LETS IT. Two independent barriers keep that from
 * happening: only the GLN is filled, so required-field validation still blocks the record
 * even when the check digit is not validated; and the row count is compared before and
 * after, so a record that IS created is reported by GLN for manual removal. The test does
 * not delete it — that is another production write.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_SBP_007 — Validate that B2B Partners rejects a GLN with an invalid check digit', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/admin', 'B2B Partners')
    .expectEnglish()
    .expectCreateFormRejectsBadGln('Add Partner')
})
