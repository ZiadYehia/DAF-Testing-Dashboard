/**
 * WEB_ARE_007 — Validate that Regulatory events rejects a GLN with an invalid check digit
 *
 * Feature: web-audit-regulatory-events   Route: /audit → tab "Regulatory events"
 *
 * Checks that a GLN whose check digit does not compute is refused with a message, rather than quietly looked up and reported as "no results" — which tells the user their GLN does not exist when in fact it is malformed.
 *
 * Read-only: a filter runs a query and submits nothing. The four "Add …" forms carrying
 * this same case wording are a different matter and use a guarded protocol instead.
 */
import { test } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

// The cached login state carries localStorage.lang=en, so the UI opens in English.
test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_ARE_007 — Validate that Regulatory events rejects a GLN with an invalid check digit', async ({ page }) => {
  test.slow()
  await DashboardPage.openTab(page, '/audit', 'Regulatory events')
    .expectEnglish()
    .expectGlnFilterRejectsBadCheckDigit('13-digit GLN')
})
