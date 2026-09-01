#!/usr/bin/env node
/**
 * Record which dashboard routes a non-privileged role can reach.
 *
 * Usage:
 *   node scripts/eptts-web-role-matrix.js <out.json> [--role manufacturer]
 *
 * WHY THIS EXISTS
 *
 * Every dashboard feature carries a generated case worded "a non-privileged role cannot reach
 * this page". That wording is not true of every page: a manufacturer is a legitimate user of
 * Shipping, Receiving and Dispensing, so asserting it there would fail a working product.
 *
 * So rather than guess which pages are admin-only, this measures it. The result decides which
 * routes get an automated role-isolation check (the ones that DO block) and which need a
 * product decision (an admin-looking page that does NOT block).
 *
 * Read-only: it navigates and observes. Nothing is submitted.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const FEATURES = path.join(REPO, 'data', 'eptts-web', 'features')
const OUT = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
if (!OUT) {
  console.error('usage: node scripts/eptts-web-role-matrix.js <out.json> [--role manufacturer]')
  process.exit(1)
}
const roleArg = process.argv.indexOf('--role')
const ROLE = roleArg !== -1 ? process.argv[roleArg + 1] : 'manufacturer'

function loadEnv() {
  const out = {}
  for (const line of fs.readFileSync(path.join(REPO, 'automation-hub', '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}
const ENV = loadEnv()
const BASE = (ENV.EPTTS_WEB_BASE_URL || '').replace(/\/$/, '')
const USER = ENV[ROLE === 'manufacturer' ? 'EPTTS_WEB_MFG_USERNAME' : 'EPTTS_WEB_ADMIN_USERNAME']
const PASS = ENV[ROLE === 'manufacturer' ? 'EPTTS_WEB_MFG_PASSWORD' : 'EPTTS_WEB_ADMIN_PASSWORD']

/** Distinct routes from the authored workflows, with the features that use them. */
function routes() {
  const byRoute = new Map()
  for (const feature of fs.readdirSync(FEATURES)) {
    const wf = path.join(FEATURES, feature, 'workflow.md')
    if (!fs.existsSync(wf)) continue
    const md = fs.readFileSync(wf, 'utf8')
    const m = /\| \*\*Route\*\* \| `([^`]+)`/.exec(md)
    if (!m) continue
    const route = m[1]
    if (!route.startsWith('/')) continue          // registry/billing live on other hosts
    if (!byRoute.has(route)) byRoute.set(route, [])
    byRoute.get(route).push(feature)
  }
  return [...byRoute.entries()].sort()
}

async function main() {
  const { chromium } = require(path.join(REPO, 'node_modules', '@playwright', 'test'))
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1500, height: 1000 } })
  const page = await ctx.newPage()

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.locator('#username, nav, aside').first().waitFor({ state: 'visible', timeout: 45_000 })
  if (await page.locator('#username').count()) {
    await page.fill('#username', USER)
    await page.fill('#password', PASS)
    await page.click('#kc-login')
    await page.locator('nav, aside').first().waitFor({ state: 'visible', timeout: 60_000 })
  }
  await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {})

  // A production-access disclaimer modal blocks every click beneath it until accepted.
  const ack = page.locator(
    'app-disclaimer-modal input[type=checkbox], .disclaimer-backdrop input[type=checkbox]').first()
  if (await ack.count()) await ack.click().catch(() => {})
  const accept = page.locator('.disclaimer-accept-btn').first()
  if (await accept.count()) { await accept.click().catch(() => {}); await page.waitForTimeout(800) }

  const en = page.getByRole('button', { name: 'EN' }).first()
  if (await en.count()) { await en.click(); await page.waitForTimeout(1500) }
  console.log(`logged in as ${ROLE}`)

  const results = []
  for (const [route, features] of routes()) {
    let landed = route
    let blocked = false
    let note = ''
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 40_000 })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      await page.waitForTimeout(1500)
      const r = await page.evaluate(() => ({
        path: location.pathname,
        text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400),
      }))
      landed = r.path
      // Blocked either by redirect or by an in-page denial.
      blocked = r.path !== route ||
        /unauthori[sz]ed|forbidden|access denied|not permitted|no permission/i.test(r.text)
      if (r.path !== route) note = `redirected to ${r.path}`
    } catch (err) {
      blocked = true
      note = `navigation failed: ${String(err.message).split('\n')[0].slice(0, 80)}`
    }
    results.push({ route, features, blocked, landed, note })
    console.log(`  ${blocked ? 'BLOCKED' : 'allowed'}  ${route.padEnd(30)} ${note}`)
  }

  await browser.close()
  fs.writeFileSync(OUT, JSON.stringify({ role: ROLE, base: BASE, results }, null, 2) + '\n')

  const blocked = results.filter((r) => r.blocked)
  console.log(`\n${blocked.length} of ${results.length} route(s) block ${ROLE}`)
  console.log(`written to ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
