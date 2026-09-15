/**
 * Capture a browser storage state for a login that cannot be scripted.
 *
 * auth.setup.ts drives data/<slug>/automation.json unattended and caches .auth/<slug>.json.
 * That stops working the moment an account is enrolled in 2FA: Keycloak asks for a one-time
 * code, and no declarative step can produce one. The devsim manufacturer
 * (janssen2@masar.com) is such an account, and it is the only role that can see the billing
 * portal's payment surface — so the alternative to this script is no coverage.
 *
 * Usage:
 *   node automation-hub/scripts/capture-state.mjs --portal eptts-billing
 *   node automation-hub/scripts/capture-state.mjs --portal eptts-registry --role admin
 *
 * It opens a REAL, VISIBLE browser, fills whatever it can from .env, and then gets out of the
 * way: you type the one-time code, tick any disclaimer, and it saves the session the moment it
 * sees you land on the portal. It deliberately does not try to interpret the login steps —
 * a human is present, so let the human answer whatever the app asks, including prompts that
 * did not exist when this script was written.
 *
 * The state is written to .auth/<slug>-<role>.json, NOT .auth/<slug>.json. That is the whole
 * point: auth.setup.ts owns the latter and overwrites it with an empty state whenever its own
 * login fails, which for a 2FA account is every time. See lib/captured-state.ts.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from '@playwright/test'

const HUB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_ROOT = process.env.DATA_ROOT ?? path.join(HUB_DIR, '..', 'data')

/** Same grammar as lib/env.ts parseEnvFile — kept in step with it deliberately. */
function loadEnv() {
  let raw
  try {
    raw = fs.readFileSync(path.join(HUB_DIR, '.env'), 'utf8')
  } catch {
    return
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    let value = m[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function die(msg) {
  console.error(`\n  ${msg}\n`)
  process.exit(1)
}

loadEnv()

const slug = arg('portal')
const role = arg('role', 'manufacturer')
const timeoutMin = Number(arg('timeout-min', '5'))

if (!slug) {
  die('--portal <slug> is required, e.g. --portal eptts-billing')
}

const cfgPath = path.join(DATA_ROOT, slug, 'automation.json')
let cfg
try {
  cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
} catch (err) {
  die(`Cannot read ${cfgPath}: ${err.message}`)
}

const base = process.env[cfg.baseUrlEnv]
if (!base) die(`${cfg.baseUrlEnv} is not set in automation-hub/.env`)

const [userKey, passKey] = cfg.credentialEnvs ?? []
const user = userKey ? process.env[userKey] : undefined
const pass = passKey ? process.env[passKey] : undefined

const statePath = path.join(HUB_DIR, '.auth', `${slug}-${role}.json`)
fs.mkdirSync(path.dirname(statePath), { recursive: true })

console.log(`
  Capturing login state
    portal   ${slug}  (${base})
    role     ${role}
    account  ${user ?? '(no credential env configured — sign in manually)'}
    output   ${statePath}
`)

// channel: 'chrome' matches pages/eptts-web/roles.ts — a real Chrome install, not the bundled
// Chromium. headless: false is the entire point: you need to see the form to answer it.
const browser = await chromium.launch({ headless: false, channel: 'chrome' })
const context = await browser.newContext({ ignoreHTTPSErrors: true })
const page = await context.newPage()

let ok = false
try {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' })

  // Fill what we can. Every step is best-effort: we may already be signed in via the shared
  // realm cookie, in which case none of these exist and that is a success, not a failure.
  for (const [sel, value] of [['#username', user], ['#password', pass]]) {
    if (!value) continue
    const field = page.locator(sel)
    if (await field.isVisible().catch(() => false)) await field.fill(value)
  }
  const submit = page.locator('#kc-login')
  if (await submit.isVisible().catch(() => false)) await submit.click()

  console.log(`  → Finish the login in the browser window.`)
  console.log(`    Type the one-time code if asked, and accept any disclaimer.`)
  console.log(`    Waiting up to ${timeoutMin} min; the state saves automatically.\n`)

  // Done when we are back on the portal origin and Keycloak's form is gone. Checking both
  // matters: the OTP step lives on the :8444 Keycloak origin for every portal, so origin alone
  // would report success while still sitting on the code prompt.
  const origin = new URL(base).origin
  const deadline = Date.now() + timeoutMin * 60_000
  while (Date.now() < deadline) {
    const onPortal = page.url().startsWith(origin)
    const onKeycloak = /\/realms\/|\/login-actions\//.test(page.url())
    const formGone = !(await page.locator('#username, #password, #otp').first().isVisible().catch(() => true))
    if (onPortal && !onKeycloak && formGone) {
      ok = true
      break
    }
    await page.waitForTimeout(1000)
  }

  if (!ok) die(`Timed out after ${timeoutMin} min still on ${page.url()} — nothing was written.`)

  // Let the SPA finish its post-login token exchange before snapshotting cookies.
  await page.waitForTimeout(2000)
  await context.storageState({ path: statePath })

  const cookies = JSON.parse(fs.readFileSync(statePath, 'utf8')).cookies ?? []
  if (cookies.length === 0) {
    die(`Saved state has no cookies — the session did not stick. Nothing usable was written.`)
  }
  console.log(`  Saved ${cookies.length} cookies to ${statePath}`)
  console.log(`  Specs reach it with capturedStateFor('${slug}', '${role}').`)

  // MIRROR AN ADMIN CAPTURE ONTO THE SETUP-OWNED PATH.
  //
  // Every existing dashboard project reads stateFor('<slug>') — .auth/<slug>.json — which
  // auth.setup.ts is supposed to fill. On this tenant it never can: every account is behind
  // TOTP, so setup times out and writes EMPTY_STATE, and ~372 committed projects then fail on
  // a redirect to Keycloak with nothing explaining why. Copying the capture there fixes all of
  // them at once, and AUTH_STATE_TTL_MIN=480 keeps setup from expiring it in half an hour.
  //
  // ONLY for --role admin. Mirroring a manufacturer capture would silently re-point every one
  // of those 372 projects at a different, less-privileged identity — they would still run, and
  // quietly assert against a smaller UI than the one they were written for. That is a worse
  // outcome than failing, so it is deliberately not offered.
  if (role === 'admin' && !process.argv.includes('--no-mirror')) {
    const shared = path.join(HUB_DIR, '.auth', `${slug}.json`)
    fs.copyFileSync(statePath, shared)
    console.log(`  Mirrored to ${shared} so existing stateFor('${slug}') projects work.`)
  } else if (role !== 'admin') {
    console.log(`  Not mirrored to .auth/${slug}.json — only --role admin is mirrored, so`)
    console.log(`  existing projects cannot be silently re-pointed at a non-admin identity.`)
  }
  console.log('')
} finally {
  await context.close()
  await browser.close()
}
