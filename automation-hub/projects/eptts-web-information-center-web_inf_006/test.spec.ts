/**
 * WEB_INF_006 — Validate that the page handles an expired session
 *
 * Feature: web-information-center   Route: /information-center
 *
 * Checks that an expired session sends the user back to sign in rather than showing a broken page.
 *
 * The session is ended by clearing the browser's cookies, which is what an expired Keycloak
 * session looks like to the app. Read-only: nothing is submitted, and the cached state file on
 * disk is untouched — only this context's copy is cleared.
 */
import { test, expect } from '@playwright/test'
import { DashboardPage } from '../../pages/eptts-web/dashboard.page'
import { stateFor } from '../../lib/apps'

test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })

test('WEB_INF_006 — Validate that the page handles an expired session', async ({ page, context }) => {
  test.slow()
  await DashboardPage.open(page, '/information-center').expectEnglish()

  await context.clearCookies()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(2000)

  // Either the Keycloak form or an explicit signed-out state. What must NOT happen is the
  // app carrying on as though the session were still valid, or hanging on a blank page.
  const signedOut = await page.evaluate(() =>
    !!document.querySelector('#kc-login, #username') ||
    /sign in|log in|session (has )?expired/i.test(document.body.innerText))
  expect(
    signedOut,
    'an expired session returns the user to sign-in instead of leaving a broken page',
  ).toBe(true)
})
