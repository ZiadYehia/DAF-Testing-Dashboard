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
import { baseUrl } from '../../lib/apps'
import { requireEnv } from '../../lib/env'

const HUB_DIR = path.join(__dirname, '..', '..')
const AUTH_DIR = path.join(HUB_DIR, '.auth')

/** Same TTL auth.setup uses, for the same reason: a session outlives a suite run. */
const TTL_MIN = Number(process.env.AUTH_STATE_TTL_MIN ?? 30)

export type DashboardRole = 'admin' | 'manufacturer' | 'distributor' | 'pharmacy' | 'inspector'

/**
 * Which portal to log into. Registered target apps only — the slug resolves its base URL
 * through lib/apps.ts, so an unknown one fails at collection time with the list of known apps.
 */
export type Portal = 'eptts-web' | 'eptts-billing' | 'eptts-registry'

/**
 * Which env keys hold each role's credentials.
 *
 * All five were probed against the live tenant on 2026-09-08. `distributor` and `inspector`
 * signed in and reported the identities below; the eFinance accounts that used to serve those
 * roles are now REJECTED by Keycloak and are deliberately not referenced here.
 *
 *   distributor   testdistributor3@eptts.com   role=distributor  gln=5413868000108  Test Distributor
 *   inspector     inspector@masar.local        role=inspector    gln=9999999999999  Masar Platform Pilot
 *
 * The distributor GLN matters: it is the party the shipping cases dispatch TO, so the same
 * account that receives a consignment is the one whose GLN appears in the destination selector.
 *
 * `pharmacy` is listed because dispensing needs it, but its login timed out when probed - treat
 * it as unproven until a case actually signs in with it.
 */
const CREDS: Record<DashboardRole, { user: string; pass: string }> = {
  admin: {
    user: 'EPTTS_WEB_ADMIN_USERNAME',
    pass: 'EPTTS_WEB_ADMIN_PASSWORD',
  },
  manufacturer: {
    user: 'EPTTS_WEB_MFG_USERNAME',
    pass: 'EPTTS_WEB_MFG_PASSWORD',
  },
  distributor: {
    user: 'EPTTS_DEVSIM_DISTRIBUTOR_EMAIL',
    pass: 'EPTTS_DEVSIM_DISTRIBUTOR_PASSWORD',
  },
  pharmacy: {
    user: 'EPTTS_DEVSIM_PHARMACY_EMAIL',
    pass: 'EPTTS_DEVSIM_PHARMACY_PASSWORD',
  },
  inspector: {
    user: 'EPTTS_DEVSIM_INSPECTOR_EMAIL',
    pass: 'EPTTS_DEVSIM_INSPECTOR_PASSWORD',
  },
}

/**
 * Where a role's cached state lives.
 *
 * The one special case is admin on the dashboard, which auth.setup.ts already builds and owns.
 * Every other combination gets its own `<portal>-<role>.json` that setup neither reads nor
 * writes — including ADMIN ON ANOTHER PORTAL, which matters more than it looks: setup builds
 * `.auth/eptts-billing.json` from data/eptts-billing/automation.json, and that config logs in as
 * the MANUFACTURER on purpose (the payment surface only exists for the party that owes). Reusing
 * that path for an admin case would hand it a manufacturer session and the case would fail
 * looking for controls the role legitimately cannot see.
 */
export function statePathFor(role: DashboardRole, portal: Portal = 'eptts-web'): string {
  if (portal === 'eptts-web' && role === 'admin') return path.join(AUTH_DIR, 'eptts-web.json')
  return path.join(AUTH_DIR, `${portal}-${role}.json`)
}

/**
 * Ensure a cached storage state exists for the role, logging in if it is missing or stale.
 *
 * Returns the path, so a spec can
 * `browser.newContext({ storageState: await ensureRoleState('admin', 'eptts-billing') })`.
 */
export async function ensureRoleState(
  role: DashboardRole,
  portal: Portal = 'eptts-web',
): Promise<string> {
  const statePath = statePathFor(role, portal)
  if (portal === 'eptts-web' && role === 'admin') return statePath // owned by lib/auth.setup.ts

  fs.mkdirSync(AUTH_DIR, { recursive: true })
  try {
    const age = Date.now() - fs.statSync(statePath).mtimeMs
    if (age < TTL_MIN * 60_000) return statePath
  } catch { /* absent — log in below */ }

  // Resolved through the target-app registry rather than a hardcoded env key, so each portal
  // gets its own origin. The old version read EPTTS_WEB_BASE_URL unconditionally, which is 8444.
  const base = baseUrl(portal).replace(/\/$/, '')
  const creds = CREDS[role]
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
    //
    // ALL THREE ACKNOWLEDGEMENTS ARE REQUIRED. The modal's Accept button is bound to
    // `disabled: !allConsentsGiven()`, where that is termsAccepted && privacyAccepted &&
    // consentFormAccepted. An earlier version of this function ticked a single
    // `input[type=checkbox]` — .first() of three — so Accept stayed disabled, its click was
    // swallowed by the .catch below, and the EN toggle then failed against a backdrop that was
    // still up. Same defect as the one in data/eptts-web/automation.json; fixed in both places.
    //
    // The boxes are PrimeNG p-checkbox components with stable inputIds, and their <label for=...>
    // is what we click: PrimeNG hides the real input behind a styled box, so a label click is the
    // native way to toggle it.
    for (const id of ['disclaimer-consent-terms', 'disclaimer-consent-privacy', 'disclaimer-consent-form']) {
      const box = page.locator(`label[for="${id}"]`).first()
      if (await box.count()) await box.click().catch(() => {})
    }
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
