#!/usr/bin/env node
/**
 * Generate one Automation Hub project per P1 dashboard page AND per P1 tab.
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
 * A TAB feature shares its parent's route and is reached by clicking a tab, so its spec uses
 * DashboardPage.openTab() and its assertions are scoped to that tab's own panel.
 *
 * Deliberately NOT automated: anything that WRITES. Every one of these pages can submit an
 * EPCIS event against production. A read-only render check is safe to replay on any schedule;
 * a shipping submission is not, and needs the same run-scoped-identifier discipline the API
 * suite has.
 *
 * ASSERTIONS COME FROM WHAT WAS OBSERVED, NOT FROM IMAGINATION
 *
 * A page's elements come from the discovery manifest. A TAB's come from its own workflow,
 * which the tab-discovery pass authored — the manifest only knows the parent page, so using it
 * for tabs would attribute the first tab's table to every tab on the screen. That is a mistake
 * this project has already made once, with Pharmacies' columns recorded under Geography.
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

/**
 * A tab feature's route and tab label, e.g. "| **Route** | `/admin` → tab **Government** |".
 * Returns null for a plain page.
 */
function tabRoute(md) {
  const m = /\| \*\*Route\*\* \| `([^`]+)` → tab \*\*([^*]+)\*\* \|/.exec(md)
  return m ? { route: m[1], tab: m[2].trim() } : null
}

/**
 * Elements from the workflow's UI Elements table — the tab's OWN content, captured by the
 * earlier tab-discovery pass. Used instead of the page manifest, which only knows the parent
 * page and would attribute the first tab's table to every tab on it.
 */
function elementsFromWorkflow(md) {
  const section = md.split('## UI Elements')[1]?.split('\n## ')[0] ?? ''
  const columns = /columns: ([^|]+)/.exec(section)?.[1].split(',').map((c) => c.trim()).filter(Boolean) ?? []
  const buttons = []
  for (const line of section.split('\n')) {
    const m = /^\| ([^|]+?) \| Button \/ action \|/.exec(line)
    if (m) buttons.push(m[1].trim())
  }
  return { columns, buttons }
}

// ─── pick the targets ────────────────────────────────────────────────────────

const targets = []
for (const feature of fs.readdirSync(FEATURES)) {
  if (!feature.startsWith('web-')) continue
  const wf = path.join(FEATURES, feature, 'workflow.md')
  if (!fs.existsSync(wf)) continue
  const md = fs.readFileSync(wf, 'utf8')
  if (field(md, 'Priority') !== 'P1') continue

  const caseId = firstCaseId(feature)
  if (!caseId) continue
  const name = feature.replace(/^web-/, '')

  // A TAB feature: same route as its parent page, reached by clicking a tab. Its own content
  // comes from its workflow, not from the page manifest.
  const asTab = tabRoute(md)
  if (asTab) {
    const el = elementsFromWorkflow(md)
    targets.push({
      kind: 'tab', feature, name, caseId,
      route: asTab.route, tab: asTab.tab,
      heading: null, buttons: el.buttons, columns: el.columns,
    })
    continue
  }

  const route = field(md, 'Route')
  const page = pageByName.get(name)
  if (!route || !page) continue
  targets.push({
    kind: 'page', feature, name, caseId, route,
    heading: page.headings?.[0],
    buttons: page.buttons ?? [],
    columns: page.tables?.[0]?.columns ?? [],
  })
}

const pages = targets.filter((t) => t.kind === 'page')
const tabs = targets.filter((t) => t.kind === 'tab')

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
  const controls = (t.buttons ?? [])
    .filter((b) => b && b !== 'AR' && b !== 'EN' && b.length < 32 && !RAW_KEY.test(b))
    .filter((b) => b.length >= 3 && /[A-Za-z]{3}/.test(b))
    .slice(0, 3)
  const columns = (t.columns ?? []).slice(0, 5)

  const lines = [
    `/**`,
    ` * ${t.caseId} — ${t.heading ?? t.tab ?? t.name} renders with its content and primary controls.`,
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
    `test('${t.caseId} — ${(t.heading ?? t.tab ?? t.name).replace(/'/g, "\\'")} renders', async ({ page }) => {`,
    `  test.slow()`,
    `  await DashboardPage.${t.tab ? `openTab(page, '${t.route}', '${t.tab.replace(/'/g, "\\'")}')` : `open(page, '${t.route}')`}`,
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
  title: `${t.caseId} — ${t.heading ?? t.tab ?? t.name} renders`,
  app: 'eptts-web',
  createdVia: 'testcase',
  linkedTestcaseId: t.caseId,
  linkedTestcase: { app: 'eptts-web', feature: t.feature, testcaseId: t.caseId },
  createdAt: '2026-09-01T02:00:00.000Z',
  lastStatus: 'never_run',
  runs: [],
  tags: t.tab ? ['dashboard', 'smoke', 'readonly', 'tab'] : ['dashboard', 'smoke', 'readonly'],
  folder: `EPTTS Web / ${t.feature}`,
  // Browser Playwright: this drives a real page, unlike the eptts-api projects.
  engine: 'playwright',
}, null, 2) + '\n'

for (const t of [...pages, ...tabs]) {
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
for (const t of [...pages, ...tabs]) {
  const where = t.tab ? `${t.route} → ${t.tab}` : t.route
  const c = (t.buttons ?? []).filter((b) => b && b !== 'AR' && b !== 'EN').length
  console.log(
    `  ${t.kind.padEnd(4)} ${t.caseId.padEnd(12)} ${projectName(t).padEnd(34)} ` +
    `${where.padEnd(40)} controls:${c} cols:${(t.columns ?? []).length}`)
}
console.log(
  `\nP1 projects: ${pages.length} page(s) + ${tabs.length} tab(s) = ${pages.length + tabs.length}`)
if (!WRITE) console.log('\n(dry run — nothing written)')
