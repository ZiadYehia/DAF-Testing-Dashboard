/**
 * Automation Hub — shared login helpers (app-agnostic).
 *
 * Specs normally never script a login: the `setup` project (auth.setup.ts) logs in
 * once per target app and caches storage state, which specs opt into via
 * `test.use({ storageState: stateFor('<app>') })`. These helpers exist for the
 * setup itself and for specs that must guarantee auth (or that test login itself).
 * App-specific flows live in lib/apps.ts.
 */
import type { Page } from '@playwright/test'
import { getTargetApp, baseUrl } from './apps'

/** Drive the app's login flow from scratch. Assumes an unauthenticated page. */
export async function login(page: Page, app: string): Promise<void> {
  await getTargetApp(app).login(page)
}

/**
 * Navigate to `path` (relative to the app's base URL) and log in first if the app
 * bounced us to a login screen. With fresh cached storage state this is just the
 * navigation; with a stale one it recovers instead of failing.
 */
export async function ensureLoggedIn(page: Page, app: string, path = '/'): Promise<void> {
  const base = baseUrl(app)
  await page.goto(base + path)
  const needsLogin =
    /login/i.test(page.url()) ||
    (await page
      .getByRole('button', { name: /log ?in|sign ?in/i })
      .or(page.getByText(/log ?in with/i))
      .first()
      .waitFor({ state: 'visible', timeout: 2_000 })
      .then(() => true)
      .catch(() => false))
  if (needsLogin) {
    await login(page, app)
    await page.goto(base + path)
  }
}
