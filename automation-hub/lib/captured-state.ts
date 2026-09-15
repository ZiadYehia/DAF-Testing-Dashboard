/**
 * Automation Hub — hand-captured storage states, for logins a script cannot complete.
 *
 * Most target apps log in unattended: auth.setup.ts drives data/<slug>/automation.json and
 * caches .auth/<slug>.json. That breaks the moment an account is enrolled in 2FA — Keycloak
 * asks for a One-time code, and no amount of declarative steps can produce one.
 *
 * The devsim manufacturer (janssen2@masar.com) is such an account, and it is the ONLY role that
 * can see the billing portal's payment surface, so the choice is between a hand-captured state
 * and no coverage at all.
 *
 * The split of ownership is what makes this safe:
 *
 *   .auth/<slug>.json          owned by auth.setup.ts. Rewritten whenever it goes stale, and
 *                              set to EMPTY_STATE when the login fails — which, for a 2FA
 *                              account, is every time.
 *   .auth/<slug>-<role>.json   owned by the operator, via scripts/capture-state.mjs. setup
 *                              never reads or writes it.
 *
 * Captured states therefore live under the second name. Putting one at the first name would
 * work exactly until the TTL lapsed and setup replaced it with an empty state, and the symptom
 * would be a redirect to Keycloak in the middle of an unrelated spec.
 *
 * The same reasoning is already applied to non-admin roles in pages/eptts-web/roles.ts; this
 * module differs only in that nothing can rebuild the state automatically, so a missing or
 * expired file has to be reported as an instruction rather than retried.
 */
import fs from 'fs'
import path from 'path'
import type { Page } from '@playwright/test'
import { HUB_DIR } from './env'
import { baseUrl, getTargetApp } from './apps'

/**
 * How long a captured state is trusted, in hours.
 *
 * This is NOT AUTH_STATE_TTL_MIN. That governs states a script can rebuild on demand, so 30
 * minutes costs nothing but a re-login. A captured state can only be rebuilt by a human typing
 * a code, so the same 30 minutes would mean re-capturing between one spec and the next. The
 * real bound is the Keycloak SSO session, which outlives it — so the TTL here exists to turn
 * "the session expired" into a clear message instead of a redirect mid-spec.
 */
const CAPTURED_TTL_HOURS = Number(process.env.AUTH_CAPTURED_STATE_TTL_HOURS ?? 8)

/** Path a captured state is written to and read from. Not validated for existence. */
export function capturedStatePath(slug: string, role: string): string {
  return path.join(HUB_DIR, '.auth', `${slug}-${role}.json`)
}

/**
 * Resolve a captured storage state for `test.use({ storageState: ... })`.
 *
 * Throws at collection time — with the command to run — when the state is missing, empty or
 * older than the TTL. That is deliberately louder than returning the path anyway: Playwright's
 * own error for an absent storage state names the file and nothing else, and an EMPTY_STATE
 * file does not error at all, it just silently starts an unauthenticated run that fails later
 * on a locator, somewhere unrelated to the cause.
 */
export function capturedStateFor(slug: string, role: string): string {
  getTargetApp(slug) // actionable error if the portal itself isn't registered
  const file = capturedStatePath(slug, role)
  const how =
    `Run:\n` +
    `  node automation-hub/scripts/capture-state.mjs --portal ${slug} --role ${role}\n` +
    `It opens a real browser, signs in, and waits for you to type the one-time code.`

  let stat: fs.Stats
  try {
    stat = fs.statSync(file)
  } catch {
    throw new Error(
      `No captured login state for "${slug}" as "${role}" (${file}).\n` +
        `This account's login cannot be scripted — it is enrolled in 2FA.\n${how}`,
    )
  }

  // An EMPTY_STATE file is 34 bytes of {"cookies":[],"origins":[]}. Treat it as absent: it is
  // what auth.setup.ts writes when a login fails, and reading it would start a signed-out run.
  const body = fs.readFileSync(file, 'utf8')
  let cookieCount = 0
  try {
    cookieCount = (JSON.parse(body).cookies ?? []).length
  } catch {
    throw new Error(`Captured login state for "${slug}" as "${role}" is not valid JSON (${file}).\n${how}`)
  }
  if (cookieCount === 0) {
    throw new Error(
      `Captured login state for "${slug}" as "${role}" holds no cookies (${file}).\n` +
        `Either the capture did not complete, or a failed auth.setup run overwrote it.\n${how}`,
    )
  }

  const ageHours = (Date.now() - stat.mtimeMs) / 3_600_000
  if (ageHours > CAPTURED_TTL_HOURS) {
    throw new Error(
      `Captured login state for "${slug}" as "${role}" is ${ageHours.toFixed(1)}h old, past the ` +
        `${CAPTURED_TTL_HOURS}h limit (${file}).\n` +
        `The Keycloak session behind it has probably expired.\n${how}`,
    )
  }

  return file
}

/**
 * Navigate to `path` on a portal whose login cannot be scripted, and fail with the fix when the
 * session has gone.
 *
 * This is the counterpart to lib/auth.ts's ensureLoggedIn, and it deliberately does the OPPOSITE
 * on the unhappy path. ensureLoggedIn recovers a stale state by re-running the login flow, which
 * is right when a script can complete that flow. Here it cannot: the account is behind TOTP, so
 * the recovery attempt would fill the password, land on the one-time-code prompt, and then time
 * out waiting for a shell that will never render. The spec would report a 45-second timeout on a
 * locator, which says nothing about the actual cause.
 *
 * So this checks for the bounce and reports it as an instruction instead.
 */
export async function ensureCapturedSession(
  page: Page,
  slug: string,
  role: string,
  route = '/',
): Promise<void> {
  await page.goto(baseUrl(slug) + route)

  // Keycloak owns /realms/ and /login-actions/ on the :8444 origin for every portal, so the URL
  // is the reliable signal — checking for a visible #username would miss the OTP step, which is
  // a different form on the same origin.
  const bounced = /\/realms\/|\/login-actions\//.test(page.url())
  if (bounced) {
    throw new Error(
      `The captured session for "${slug}" as "${role}" has expired — ${page.url()} bounced to Keycloak.\n` +
        `It cannot be renewed automatically: this account requires a one-time code.\n` +
        `Run:\n` +
        `  node automation-hub/scripts/capture-state.mjs --portal ${slug} --role ${role}\n`,
    )
  }
}
