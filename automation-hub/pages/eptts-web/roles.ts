/**
 * Cached login state for a SECOND dashboard role.
 *
 * The hub's auth.setup caches one storage state per app, which is the admin. Role-isolation
 * cases need a non-privileged user as well — "a manufacturer must not reach this page" cannot
 * be tested from an admin session.
 *
 * Rather than log in inside every one of those specs (there are ~50, at roughly ten seconds
 * each), the state is cached on disk with a TTL, exactly as auth.setup does for the admin.
 * The first spec that needs it pays for the login; the rest reuse it.
 *
 * The switch to English happens here too. A fresh login lands in Arabic, and a spec that then
 * looks for English text fails on a locator rather than on its subject.
 */
import fs from 'fs'
import path from 'path'
import { chromium } from '@playwright/test'
import { requireEnv } from '../../lib/env'

const HUB_DIR = path.join(__dirname, '..', '..')
const AUTH_DIR = path.join(HUB_DIR, '.auth')

/** Same TTL auth.setup uses, for the same reason: a session outlives a suite run. */
const TTL_MIN = Number(process.env.AUTH_STATE_TTL_MIN ?? 30)

export type DashboardRole = 'admin' | 'manufacturer'

const CREDS: Record<Exclude<DashboardRole, 'admin'>, { user: string; pass: string }> = {
  manufacturer: {
    user: 'EPTTS_WEB_MFG_USERNAME',
    pass: 'EPTTS_WEB_MFG_PASSWORD',
  },
} as never

export function statePathFor(role: DashboardRole): string {
  return role === 'admin'
    ? path.join(AUTH_DIR, 'eptts-web.json')
    : path.join(AUTH_DIR, `eptts-web-${role}.json`)
}

/**
 * Ensure a cached storage state exists for the role, logging in if it is missing or stale.
 *
 * Returns the path, so a spec can `test.use({ storageState: await ensureRoleState('manufacturer') })`.
 */
export async function ensureRoleState(role: DashboardRole): Promise<string> {
  const statePath = statePathFor(role)
  if (role === 'admin') return statePath // owned by lib/auth.setup.ts

  fs.mkdirSync(AUTH_DIR, { recursive: true })
  try {
    const age = Date.now() - fs.statSync(statePath).mtimeMs
    if (age < TTL_MIN * 60_000) return statePath
  } catch { /* absent — log in below */ }

  const base = requireEnv('EPTTS_WEB_BASE_URL').replace(/\/$/, '')
  const creds = CREDS[role as Exclude<DashboardRole, 'admin'>]
  const user = requireEnv(creds.user)
  const pass = requireEnv(creds.pass)

  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    // Self-signed certificate on the production host.
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await ctx.newPage()
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Either the Keycloak form or the app shell appears; which one is not knowable up front.
    await page.locator('#username, nav, aside, [class*="layout-menu"]').first()
      .waitFor({ state: 'visible', timeout: 45_000 })

    if (await page.locator('#username').count()) {
      await page.fill('#username', user)
      await page.fill('#password', pass)
      await page.click('#kc-login')
      await page.locator('nav, aside, [class*="layout-menu"]').first()
        .waitFor({ state: 'visible', timeout: 60_000 })
    }
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

    // A production-access disclaimer modal appears on login and its backdrop intercepts every
    // click beneath it — including the language toggle below. Dismiss it first, or the next
    // action fails with an unexplained click timeout.
    const ack = page.locator(
      'app-disclaimer-modal input[type=checkbox], .disclaimer-backdrop input[type=checkbox]').first()
    if (await ack.count()) await ack.click().catch(() => {})
    const accept = page.locator('.disclaimer-accept-btn').first()
    if (await accept.count()) {
      await accept.click().catch(() => {})
      await page.waitForTimeout(800)
    }

    // A fresh login lands in Arabic; the toggle reads EN while Arabic is active.
    const toEnglish = page.getByRole('button', { name: 'EN' }).first()
    if (await toEnglish.count()) {
      await toEnglish.click()
      await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'ltr',
        { timeout: 15_000 }).catch(() => {})
      await page.waitForTimeout(1000)
    }

    await ctx.storageState({ path: statePath })
    return statePath
  } finally {
    await browser.close()
  }
}
