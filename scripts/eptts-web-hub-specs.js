#!/usr/bin/env node
/**
 * Generate one Automation Hub project per P1 dashboard page, driven by the discovery manifest.
 *
 * Usage:
 *   node scripts/eptts-web-hub-specs.js <manifest.json>            # dry run
 *   node scripts/eptts-web-hub-specs.js <manifest.json> --write
 *
 * WHAT IT AUTOMATES, AND WHY ONLY THAT
 *
 * The `_001` case of each P1 page: "the page renders with its heading and primary controls".
 * That is the case worth automating first — it is the precondition for every other case on
 * the page, it is cheap, and it is the one that catches a deploy breaking a screen outright.
 *
 * Deliberately NOT automated yet:
 *   - tab features (/admin has 9, /audit 4, /analytics 2). They share a route and need the
 *     tab clicked first; PrimeNG's tab bars needed three attempts to drive reliably during
 *     discovery, so they deserve their own pass rather than being rushed in here.
 *   - anything that WRITES. Every one of these pages can submit an EPCIS event against
 *     production. A read-only render check is safe to run on any schedule; a shipping
 *     submission is not, and needs the same run-scoped-identifier discipline the API suite has.
 *
 * ASSERTIONS COME FROM THE MANIFEST, NOT FROM IMAGINATION
 *
 * Headings, controls and table columns are whatever discovery actually saw on the page. A
 * generated spec asserting a control nobody has seen would be a test of the generator, not of
 * the product.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const FEATURES = path.join(REPO, 'data', 'eptts-web', 'features')
const PROJECTS = path.join(REPO, 'automation-hub', 'projects')
const WRITE = process.argv.includes('--write')
const manifestPath = process.argv.slice(2).find((a) => !a.startsWith('--'))

if (!manifestPath || !fs.existsSync(manifestPath)) {
  console.error('usage: node scripts/eptts-web-hub-specs.js <manifest.json> [--write]')
  process.exit(1)
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const pageByName = new Map(manifest.pages.map((p) => [p.name, p]))

/** Read a `| **Field** | value |` row out of a workflow. */
function field(md, name) {
  const m = new RegExp(`\\| \\*\\*${name}\\*\\* \\| ([^|]+) \\|`).exec(md)
  return m ? m[1].trim().replace(/^`|`$/g, '') : null
}

/** The first TestCase ID in a feature's table — the `_001` render case. */
function firstCaseId(feature) {
  const p = path.join(FEATURES, feature, `${feature}-testcases.md`)
  if (!fs.existsSync(p)) return null
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (line.startsWith('| EPTTS_')) return line.split('|')[2].trim()
  }
  return null
}

// ─── pick the targets ────────────────────────────────────────────────────────

const targets = []
for (const feature of fs.readdirSync(FEATURES)) {
  if (!feature.startsWith('web-')) continue
  const wf = path.join(FEATURES, feature, 'workflow.md')
  if (!fs.existsSync(wf)) continue
  const md = fs.readFileSync(wf, 'utf8')
  if (field(md, 'Priority') !== 'P1') continue

  const route = field(md, 'Route')
  const caseId = firstCaseId(feature)
  const name = feature.replace(/^web-/, '')
  const page = pageByName.get(name)
  if (!route || !caseId || !page) continue

  // A tab feature shares its parent's route, so more than one feature maps to it. Those need
  // the tab clicked first and are out of scope here — see the header.
  targets.push({ feature, name, route, caseId, page, heading: page.headings?.[0] })
}

const byRoute = new Map()
for (const t of targets) byRoute.set(t.route, (byRoute.get(t.route) ?? 0) + 1)
const pages = targets.filter((t) => byRoute.get(t.route) === 1)
const tabs = targets.filter((t) => byRoute.get(t.route) > 1)

// ─── emit ────────────────────────────────────────────────────────────────────

/** A raw i18n key that leaked into the UI, e.g. "shipments.bulkUpload". */
const RAW_KEY = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/

const projectName = (t) => `eptts-web-${t.name}`

const SPEC = (t) => {
  // Only controls discovery actually saw, minus two exclusions:
  //
  //  - the language toggle, which reads "AR" in English and "EN" in Arabic, so asserting it
  //    would assert the locale a second time;
  //  - any RAW TRANSLATION KEY. /shipments renders a button labelled `shipments.bulkUpload`,
  //    and asserting that as an expected control would bake a defect in as correct behaviour:
  //    the spec would pass while the bug exists and fail the day it is fixed. The defect is
  //    covered properly by expectNoRawTranslationKeys(), which fails NOW and goes green when
  //    the label is added.
  //  - anything that is not a real LABEL. Discovery records every button, including icon-only
  //    controls ("+", "−" on the command centre) and pagination digits. Asserting those
  //    produces a brittle test of chrome rather than of the page, and `getByRole(name: '+')`
  //    matches unpredictably.
  const controls = (t.page.buttons ?? [])
    .filter((b) => b && b !== 'AR' && b !== 'EN' && b.length < 32 && !RAW_KEY.test(b))
    .filter((b) => b.length >= 3 && /[A-Za-z]{3}/.test(b))
    .slice(0, 3)
  const columns = (t.page.tables?.[0]?.columns ?? []).slice(0, 5)

  const lines = [
    `/**`,
    ` * ${t.caseId} — ${t.heading ?? t.name} renders with its heading and primary controls.`,
    ` *`,
    ` * Feature: ${t.feature}   Route: ${t.route}`,
    ` *`,
    ` * Read-only: this navigates and asserts, and submits nothing. Every P1 page here can write`,
    ` * an EPCIS event against production, so a render check is the part that is safe to replay`,
    ` * on any schedule.`,
    ` *`,
    ` * Elements asserted below are what discovery observed on the page, not a specification.`,
    ` */`,
    `import { test } from '@playwright/test'`,
    `import { DashboardPage } from '../../pages/eptts-web/dashboard.page'`,
    `import { stateFor } from '../../lib/apps'`,
    ``,
    `// The cached login state carries localStorage.lang=en, so the UI opens in English.`,
    `test.use({ storageState: stateFor('eptts-web'), ignoreHTTPSErrors: true })`,
    ``,
    `test('${t.caseId} — ${(t.heading ?? t.name).replace(/'/g, "\\'")} renders', async ({ page }) => {`,
    `  test.slow()`,
    `  await DashboardPage.open(page, '${t.route}')`,
    `    .expectEnglish()`,
  ]
  if (t.heading) lines.push(`    .expectHeading('${t.heading.replace(/'/g, "\\'")}')`)
  if (controls.length) {
    lines.push(`    .expectControls([${controls.map((c) => `'${c.replace(/'/g, "\\'")}'`).join(', ')}])`)
  }
  if (columns.length) {
    lines.push(`    .expectTableColumns([${columns.map((c) => `'${c.replace(/'/g, "\\'")}'`).join(', ')}])`)
  }
  lines.push(
    `    .expectNoRawTranslationKeys()`,
    `    .expectNoErrorBanner()`,
    `})`,
    ``,
  )
  return lines.join('\n')
}

const META = (t) => JSON.stringify({
  name: projectName(t),
  title: `${t.caseId} — ${t.heading ?? t.name} renders`,
  app: 'eptts-web',
  createdVia: 'testcase',
  linkedTestcaseId: t.caseId,
  linkedTestcase: { app: 'eptts-web', feature: t.feature, testcaseId: t.caseId },
  createdAt: '2026-09-01T02:00:00.000Z',
  lastStatus: 'never_run',
  runs: [],
  tags: ['dashboard', 'smoke', 'readonly'],
  folder: `EPTTS Web / ${t.feature}`,
  // Browser Playwright: this drives a real page, unlike the eptts-api projects.
  engine: 'playwright',
}, null, 2) + '\n'

for (const t of pages) {
  if (!WRITE) continue
  const dir = path.join(PROJECTS, projectName(t))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'test.spec.ts'), SPEC(t), 'utf8')

  const metaPath = path.join(dir, 'meta.json')
  if (fs.existsSync(metaPath)) {
    // Preserve run history; refresh only the definition.
    const existing = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    const next = JSON.parse(META(t))
    next.runs = existing.runs ?? []
    next.lastStatus = existing.lastStatus ?? 'never_run'
    next.createdAt = existing.createdAt ?? next.createdAt
    fs.writeFileSync(metaPath, JSON.stringify(next, null, 2) + '\n', 'utf8')
  } else {
    fs.writeFileSync(metaPath, META(t), 'utf8')
  }
}

console.log(WRITE ? '=== WROTE ===' : '=== DRY RUN (pass --write) ===')
for (const t of pages) {
  const c = (t.page.buttons ?? []).filter((b) => b && b !== 'AR' && b !== 'EN').length
  const cols = t.page.tables?.[0]?.columns?.length ?? 0
  console.log(`  ${t.caseId.padEnd(12)} ${projectName(t).padEnd(32)} ${t.route.padEnd(22)} controls:${c} cols:${cols}`)
}
console.log(`\nP1 page projects: ${pages.length}`)
if (tabs.length) {
  console.log(
    `\nskipped ${tabs.length} P1 TAB feature(s) — they share a route with siblings and need the ` +
    'tab clicked first, which is its own pass:')
  console.log(`   ${tabs.map((t) => t.feature).join(', ')}`)
}
if (!WRITE) console.log('\n(dry run — nothing written)')
