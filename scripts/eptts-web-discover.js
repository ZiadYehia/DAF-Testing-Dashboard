#!/usr/bin/env node
/**
 * Walk the EPTTS dashboard sidebar and record what is actually on each page.
 *
 * Usage:
 *   node scripts/eptts-web-discover.js <out-dir> [--routes a,b,c] [--role admin|manufacturer]
 *
 * Writes:
 *   <out-dir>/manifest.json      the shape scripts/eptts-web-dashboard-features.js consumes
 *   <out-dir>/shots/<slug>.jpg   one screenshot per page
 *
 * WHY A SCRIPT AND NOT THE MCP BROWSER
 *
 * Both drive the same Playwright. The difference is that this is re-runnable and its output
 * is a single reviewable artifact, so a second pass after a platform change is one command
 * rather than ~100 interactive steps. It also keeps the extraction rules in one place, which
 * is what makes two pages comparable.
 *
 * JPG, NOT PNG: `.gitignore` has a blanket `*.png`, so PNG evidence is silently never
 * committed. Every screenshot here is written as .jpg on purpose.
 *
 * WHAT IT DOES NOT DO
 *
 * It records only what is observable without interacting: no form submission, no row
 * clicking, nothing that writes. Discovery must be safe to run against production.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const OUT = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
if (!OUT) {
  console.error('usage: node scripts/eptts-web-discover.js <out-dir> [--routes a,b] [--role admin|manufacturer]')
  process.exit(1)
}

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`))
  return inline ? inline.slice(flag.length + 1) : null
}

const ROLE = argValue('--role') || 'admin'
const ONLY = (argValue('--routes') || '').split(',').map((s) => s.trim()).filter(Boolean)

// ─── env ─────────────────────────────────────────────────────────────────────

function loadEnv() {
  const p = path.join(REPO, 'automation-hub', '.env')
  const out = {}
  if (!fs.existsSync(p)) return out
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}
const ENV = loadEnv()
const BASE = (ENV.EPTTS_WEB_BASE_URL || 'https://192.168.225.195:8444').replace(/\/$/, '')
const CREDS = {
  admin: { user: ENV.EPTTS_WEB_ADMIN_USERNAME, pass: ENV.EPTTS_WEB_ADMIN_PASSWORD },
  manufacturer: { user: ENV.EPTTS_WEB_MFG_USERNAME, pass: ENV.EPTTS_WEB_MFG_PASSWORD },
}[ROLE]
if (!CREDS?.user || !CREDS?.pass) {
  console.error(`missing credentials for role "${ROLE}" in automation-hub/.env`)
  process.exit(1)
}

// ─── the sidebar, as given ───────────────────────────────────────────────────
//
// `slug` is the feature slug the generator will use; `name` is the PAGE_META key half.

const PAGES = [
  ['information-center', '/information-center', 'Information Center'],

  ['shipping', '/shipments', 'Shipping'],
  ['receiving', '/shipments/receive', 'Receiving'],
  ['dispensing', '/dispensing', 'Dispensing'],
  ['return-shipping', '/return-to-branch', 'Return Shipping'],
  ['return-receiving', '/pending-returns', 'Return Receiving'],
  ['cancel-transfer', '/cancellations', 'Cancel Transfer'],
  ['transfer-history', '/shipments/history', 'Transfer History'],
  ['operations', '/operations', 'Operations'],

  ['individual-packs', '/aggregation/individual-packs', 'Individual Packs'],
  ['aggregation', '/aggregation', 'Aggregation'],
  ['repack', '/repack-ingest', 'Repack'],

  ['scan-pack', '/scanning', 'Scan Pack'],
  ['product-destruction', '/destruction', 'Product Destruction'],
  ['product-verification', '/verify', 'Product Verification'],
  ['product-recall', '/recalls', 'Product Recall'],

  ['epcis-xml-upload', '/bulk-upload', 'EPCIS XML Transactions'],
  ['commissioning-packing-csv', '/import-jobs', 'Commissioning and Packing CSV'],

  ['products', '/products', 'Product Display'],
  ['inventory', '/inventory', 'Inventory'],
  ['pharmacy-stock', '/pharmacy-stock', 'Pharmacy Stock'],
  ['mdm-registry', '/mdm-registry', 'MDM Registry'],

  ['trace', '/trace', 'Trace'],
  ['epcis-messages', '/epcis-b2b', 'EPCIS Messages'],
  ['message-log', '/message-log', 'Message Log'],
  ['webhook-history', '/webhook-history', 'Webhook History'],

  ['command-center', '/dashboard', 'Command Center'],
  ['reporting', '/reporting', 'Reports'],
  ['analytics', '/analytics', 'Analytics'],
  ['violations', '/violations', 'Violations'],
  ['audit-console', '/audit', 'Audit Console'],

  ['settings-admin', '/admin', 'Settings'],
  ['announcements', '/admin/announcements', 'Announcements'],
  ['mobile-versions', '/mobile-versions', 'Mobile Versions'],

  ['integration-downloads', '/integration-downloads', 'Integration Downloads'],
  ['master-data', '/master-data', 'Master Data Snapshots'],
  ['pos-partners', '/pos-partners', 'POS Partners'],

  ['agent-monitoring', '/agent-monitoring', 'Desktop Agent Monitoring'],
  ['agent-devices', '/agent-devices', 'Desktop Agent Devices'],
  ['activation-keys', '/activation-keys', 'Activation Keys'],
  ['agent-updates', '/agent-updates', 'Desktop Agent Updates'],
]

// ─── the extractor, evaluated in the page ────────────────────────────────────
//
// Kept as one function so every page is measured identically. Caps are deliberate: a
// 400-row table would otherwise dominate the manifest without telling us anything more.

const EXTRACT = () => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  const uniq = (a) => [...new Set(a.filter(Boolean))]
  const vis = (el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }

  const headings = uniq([...document.querySelectorAll('h1,h2,h3')].filter(vis).map(txt)).slice(0, 12)

  const buttons = uniq(
    [...document.querySelectorAll('button, a[role="button"], [role="button"]')]
      .filter(vis)
      .map(txt)
      .filter((t) => t && t.length < 40),
  ).slice(0, 30)

  // PrimeNG tabs carry role=tab and a leading space in innerText.
  const tabs = uniq(
    [...document.querySelectorAll('[role="tab"], p-tab')]
      .filter(vis)
      .map((el) => txt(el))
      .filter(Boolean),
  ).slice(0, 30)

  const inputs = [...document.querySelectorAll('input, select, textarea')]
    .filter(vis)
    .slice(0, 30)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || el.getAttribute('formcontrolname') || '',
      placeholder: el.getAttribute('placeholder') || '',
      label: (el.getAttribute('aria-label') || '').trim(),
      options: el.tagName.toLowerCase() === 'select'
        ? [...el.querySelectorAll('option')].map((o) => txt(o)).slice(0, 12)
        : undefined,
    }))

  const tables = [...document.querySelectorAll('table')]
    .filter(vis)
    .slice(0, 6)
    .map((t) => ({
      columns: [...t.querySelectorAll('thead th, thead td')].map(txt).filter(Boolean).slice(0, 25),
      rowCount: t.querySelectorAll('tbody tr').length,
    }))
    .filter((t) => t.columns.length > 0)

  // KPI/stat cards: a short label with a number near it. Heuristic, so capped and labelled.
  const kpis = uniq(
    [...document.querySelectorAll('[class*="card"], [class*="stat"], [class*="kpi"], [class*="metric"]')]
      .filter(vis)
      .map(txt)
      .filter((t) => t && t.length < 80 && /\d/.test(t)),
  ).slice(0, 14)

  return {
    headings,
    buttons,
    tabs,
    inputs,
    tables,
    kpis,
    bodyText: txt(document.body).slice(0, 400),
    hasError: /404|not found|forbidden|unauthori[sz]ed|access denied|something went wrong/i
      .test(txt(document.body).slice(0, 2000)),
  }
}

// ─── run ─────────────────────────────────────────────────────────────────────

async function main() {
  const { chromium } = require(path.join(REPO, 'node_modules', '@playwright', 'test'))
  const shots = path.join(OUT, 'shots')
  fs.mkdirSync(shots, { recursive: true })

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,               // the host serves a self-signed certificate
    viewport: { width: 1600, height: 1000 },
  })
  const page = await ctx.newPage()

  // XHR is recorded per page, so the manifest can say which API each screen calls.
  let xhr = []
  page.on('response', (res) => {
    const u = res.url()
    if (!/\/api\/|\/masar-service\/|\/registry-service\//.test(u)) return
    if (/\.(js|css|woff2?|png|jpg|svg)$/i.test(u)) return
    xhr.push(`${res.request().method()} ${res.status()} ${u.replace(BASE, '')}`)
  })

  const isAuthUrl = (u) => /openid-connect\/auth/.test(String(u))

  /**
   * Navigate to an app route and wait until we are actually ON it.
   *
   * This app is an OIDC SPA in *fragment* response mode, so its access token lives in
   * memory. A full page load therefore always bounces through Keycloak — silently, using
   * the SSO cookie, but it IS a round trip. Extracting straight after `goto` reads the
   * login page mid-redirect and reports every screen as three inputs and no content.
   *
   * So: go, then wait for the URL to leave the auth endpoint, then let Angular render.
   */
  async function gotoApp(route) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    if (isAuthUrl(page.url())) {
      await page.waitForURL((u) => !isAuthUrl(u), { timeout: 45_000 })
    }
    await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {})
    await page.waitForTimeout(1500)
  }

  const LOGIN_FORM = '#kc-login, input[name="username"]'
  const APP_SHELL = 'nav, aside, [class*="sidebar"], [class*="layout-menu"]'

  /**
   * Log in only if asked to.
   *
   * `goto('/')` may land on the Keycloak form, OR go straight through on an existing SSO
   * cookie — and the redirect chain means the answer is not knowable from the first URL.
   * Racing "form appeared" against "app shell appeared" is what makes this reliable; a
   * fixed wait then a URL test gives a different answer depending on timing.
   */
  async function ensureLoggedIn() {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const sawForm = await Promise.race([
      page.waitForSelector(LOGIN_FORM, { timeout: 30_000, state: 'visible' }).then(() => true).catch(() => null),
      page.waitForSelector(APP_SHELL, { timeout: 30_000, state: 'visible' }).then(() => false).catch(() => null),
    ])
    if (sawForm === null) throw new Error(`neither a login form nor the app shell appeared at ${page.url()}`)

    if (sawForm) {
      await page.fill('#username, input[name="username"]', CREDS.user)
      await page.fill('#password, input[name="password"]', CREDS.pass)
      await page.click('#kc-login, button[type="submit"]')
      await page.waitForSelector(APP_SHELL, { timeout: 60_000, state: 'visible' }).catch(() => {})
    }

    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(1500)

    const state = await page.evaluate((sel) => ({
      hasShell: !!document.querySelector(sel),
      onForm: !!document.querySelector('#kc-login'),
      // The dashboard renders right-to-left in Arabic; worth recording, because it decides
      // how locators are written and it is a test dimension in its own right.
      dir: document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction,
      lang: document.documentElement.getAttribute('lang') || '',
    }), APP_SHELL)

    if (!state.hasShell || state.onForm) {
      const err = await page.evaluate(() => {
        const e = document.querySelector('#input-error, .alert-error, [class*="kc-feedback"], .pf-c-alert__title')
        return e ? e.textContent.trim() : ''
      })
      throw new Error(
        `login as ${ROLE} did not complete — at ${page.url().slice(0, 120)}` +
        (err ? ` (Keycloak said: "${err}")` : ' (no error message shown)'),
      )
    }
    return state
  }

  let shell = await ensureLoggedIn()
  console.log(
    `logged in as ${ROLE} — landed on ${page.url().replace(BASE, '') || '/'} ` +
    `(dir=${shell.dir}${shell.lang ? ` lang=${shell.lang}` : ''})`)

  /**
   * Switch the UI to English.
   *
   * The dashboard is BILINGUAL and defaults to Arabic (RTL) — the toggle in the header reads
   * "EN" when Arabic is active and "AR" when English is. The 41 features authored in the
   * earlier pass were captured in English, so capturing these in Arabic would make two
   * halves of the same app describe their UI in different languages and make the element
   * tables incomparable.
   *
   * That the UI has two directions is itself a test dimension, recorded in each workflow
   * rather than covered by capturing twice.
   */
  async function switchToEnglish() {
    const toggle = page.locator('button', { hasText: /^\s*EN\s*$/ }).first()
    if (!(await toggle.count())) return false
    await toggle.click()
    await page.waitForFunction(() => document.documentElement.getAttribute('dir') === 'ltr', { timeout: 15_000 })
      .catch(() => {})
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
    await page.waitForTimeout(1200)
    return true
  }

  if (shell.dir === 'rtl' && (await switchToEnglish())) {
    shell = await page.evaluate(() => ({
      hasShell: true,
      onForm: false,
      dir: document.documentElement.getAttribute('dir') || getComputedStyle(document.body).direction,
      lang: document.documentElement.getAttribute('lang') || '',
    }))
    console.log(`  switched UI to English (dir=${shell.dir} lang=${shell.lang})`)
    if (shell.dir !== 'ltr') {
      console.log('  WARNING: the EN toggle did not switch direction — pages will be captured in Arabic')
    }
  }

  const targets = ONLY.length ? PAGES.filter(([slug]) => ONLY.includes(slug)) : PAGES
  const pages = []

  for (const [slug, route, name] of targets) {
    xhr = []
    let data = null
    let reachable = true
    let note = ''
    try {
      await gotoApp(route)
      data = await page.evaluate(EXTRACT)
      if (data.hasError) { reachable = false; note = 'page reports an error/not-authorised state' }
    } catch (err) {
      reachable = false
      note = `navigation failed: ${String(err.message).split('\n')[0].slice(0, 160)}`
    }

    const shot = path.join(shots, `${slug}.jpg`)
    try {
      await page.screenshot({ path: shot, type: 'jpeg', quality: 72, fullPage: true })
    } catch { /* a screenshot failure must not lose the rest of the page's data */ }

    const landedOn = page.url().replace(BASE, '') || '/'
    if (reachable && landedOn !== route && !landedOn.startsWith(route)) {
      note = `redirected to ${landedOn}`
    }

    pages.push({
      portal: 'dashboard',
      name: slug,
      label: name,
      route,
      landedOn,
      reachable,
      note,
      role: ROLE,
      screenshot: fs.existsSync(shot) ? path.relative(OUT, shot).replace(/\\/g, '/') : null,
      headings: data?.headings ?? [],
      buttons: data?.buttons ?? [],
      tabs: data?.tabs ?? [],
      inputs: data?.inputs ?? [],
      tables: data?.tables ?? [],
      kpis: data?.kpis ?? [],
      bodyText: data?.bodyText ?? '',
      xhr: [...new Set(xhr)].slice(0, 20),
    })

    const t = data?.tables?.[0]
    console.log(
      `  ${reachable ? 'ok  ' : 'FAIL'} ${slug.padEnd(28)} ${String(route).padEnd(32)} ` +
      `h:${data?.headings?.length ?? 0} btn:${data?.buttons?.length ?? 0} tab:${data?.tabs?.length ?? 0} ` +
      `in:${data?.inputs?.length ?? 0} tbl:${t ? t.columns.length + 'col' : '-'} xhr:${xhr.length}` +
      (note ? `  [${note}]` : ''),
    )
  }

  await browser.close()

  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify({ base: BASE, role: ROLE, capturedPages: pages.length, pages }, null, 2) + '\n',
  )

  const bad = pages.filter((p) => !p.reachable)
  console.log(`\n${pages.length} page(s) captured, ${bad.length} unreachable`)
  if (bad.length) for (const p of bad) console.log(`   ${p.name} (${p.route}) — ${p.note}`)
  console.log(`manifest: ${path.join(OUT, 'manifest.json')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
