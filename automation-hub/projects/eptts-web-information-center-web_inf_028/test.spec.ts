/**
 * WEB_INF_028 — Validate that a failing announcements endpoint surfaces an error rather than an empty page
 *
 * Feature: web-information-center   Route: /information-center
 *
 * KNOWN PLATFORM GAP — see
 * data/eptts-web/bugs/web-information-center/a-failed-announcements-request-leaves-the-panel-showing-no-announcements-found.md
 *
 * This asserts what a CORRECT system does: a panel whose request failed does not present
 * itself as an empty result set. The platform currently shows "No announcements found" and
 * only a transient toast, so the assertion fails and test.fail() records that as the known
 * gap. The day it is fixed this flips to an unexpected pass — "remove the marker".
 *
 * Do NOT rewrite this to assert the empty state. Asserting the defect makes the case pass,
 * which combined with test.fail() reports the defect as FIXED.
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

test('WEB_INF_028 — Validate that a failing announcements endpoint surfaces an error rather than an empty page', async ({ page }) => {
  test.slow()
  test.fail(true, 'platform gap: a failed announcements request renders the empty state, and the only error signal is a toast that auto-dismisses after ~15s')

  await page.route('**/information-center/announcements*', (route) => {
    const url = route.request().url()
    const isUnfilteredList = /announcements(\?|$)/.test(url) && !/category=/.test(url)
    return isUnfilteredList ? route.abort('failed') : route.continue()
  })

  await DashboardPage.open(page, '/information-center')
  // Well past the toast's auto-dismiss, which is where the defect actually bites.
  await page.waitForTimeout(18_000)

  const panelText = await ic.latestUpdates(page).innerText()
  expect(panelText, 'a panel whose request failed does not claim there are no announcements')
    .not.toContain('No announcements found')
})
