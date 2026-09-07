#!/usr/bin/env node
/**
 * Create one Automation Hub project per registered EPTTS test case.
 *
 * Usage:
 *   node scripts/eptts-api-hub-projects.js            # dry run
 *   node scripts/eptts-api-hub-projects.js --write
 *   node scripts/eptts-api-hub-projects.js --write --prune   # also remove stale projects
 *
 * WHY ONE PROJECT PER CASE
 *
 * The Hub links a project to exactly one test case (`ProjectMeta.linkedTestcase`) and a
 * replay syncs that case's pass/fail to the feature's Execution tab. A project holding 47
 * tests can only report a status for one of them, and there is no way to replay a single
 * case. So each case gets its own project, whose `test.spec.ts` is a two-line shim onto
 * the shared registry in `automation-hub/lib/eptts-cases/`.
 *
 * The spec filename comes from `specFileName(meta.engine)` in automation-hub/store.ts, which
 * maps the `api` engine to `test.spec.ts` — same as browser Playwright. An API project is
 * distinguished by the config project it runs under (`--project=api`), not by its filename.
 *
 * Deliberately NOT converted: `eptts-api-smoke`, `eptts-api-e2e-returns` and
 * `eptts-api-e2e-lifecycle`. Those verify that steps compose (a property no single case
 * describes) and the journeys' steps share state in order, so they keep their multi-test
 * specs and stay unlinked.
 *
 * KEEP_MULTI IS LOAD-BEARING, NOT DOCUMENTATION. A journey project absent from it is
 * "stale" to the prune pass below and gets deleted by `--write --prune`. It listed
 * `eptts-api-supply-chain`, which no longer exists, and not `eptts-api-e2e-returns`, which
 * does — so a prune would have removed a journey while protecting a directory that was not
 * there. Add every journey project here when it is created.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const PROJECTS = path.join(REPO, 'automation-hub', 'projects')
const WRITE = process.argv.includes('--write')
const PRUNE = process.argv.includes('--prune')

/** Projects that are journeys, not single cases — never generated, never pruned. */
const KEEP_MULTI = new Set([
  'eptts-api-smoke',
  'eptts-api-e2e-returns',
  'eptts-api-e2e-lifecycle',
])

// ─── read the registry without importing TypeScript ──────────────────────────
//
// The registry is TS and this is a plain node script, so ask ts-node to print the
// case metadata as JSON rather than duplicating the list here (which would drift).

function loadCases() {
  const snippet = `
    require('ts-node').register({ compilerOptions: { module: 'commonjs' }, transpileOnly: true })
    const { CASES } = require('./automation-hub/lib/eptts-cases/index.ts')
    const out = Object.values(CASES).map((c) => ({
      id: c.id, feature: c.feature, title: c.title,
      expectFail: c.expectFail || null, skip: c.skip || null,
    }))
    process.stdout.write(JSON.stringify(out))
  `
  const raw = execFileSync(process.execPath, ['-e', snippet], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  })
  return JSON.parse(raw.slice(raw.indexOf('[')))
}

const cases = loadCases()

// ─── tags ────────────────────────────────────────────────────────────────────

/**
 * Write impact per feature, so a regression run can be sliced. `readonly` cases send no
 * EPCIS events; `write` cases create packs; `destructive` cases consume them irreversibly.
 */
const FEATURE_TAGS = {
  'api-authentication': ['readonly'],
  'api-commission': ['write'],
  'api-packing': ['write'],
  'api-unpacking': ['write'],
  'api-shipping': ['write'],
  'api-receiving': ['write'],
  'api-return': ['write'],
  'api-return-receiving': ['write'],
  'api-destruction': ['destructive'],
  'api-dispensing': ['destructive'],
  'api-partial-dispensing': ['destructive'],
}

function tagsFor(c) {
  const tags = ['api', ...(FEATURE_TAGS[c.feature] || ['write'])]
  if (c.expectFail) tags.push('known-gap')
  if (c.skip) tags.push('blocked')
  if (/_SEC_/.test(c.id)) tags.push('security')
  return tags
}

/** Project folder name: slugified, stable, and unique per case. */
function projectName(c) {
  return `eptts-${c.feature.replace(/^api-/, 'api-')}-${c.id.toLowerCase()}`
}

const SPEC = (c) => `/**
 * ${c.id} — ${c.title}
 *
 * Feature: ${c.feature}
 *
 * One project per test case, so this case can be replayed on its own and its pass/fail
 * syncs to exactly this test case in the feature's Execution tab. The body lives in
 * automation-hub/lib/eptts-cases/ so 400 projects share one implementation.
 */
import { defineCase } from '../../lib/eptts-cases'

defineCase('${c.id}')
`

const APP = 'eptts-api'

const META = (c) => JSON.stringify({
  name: projectName(c),
  title: `${c.id} — ${c.title}`,
  app: APP,
  createdVia: 'testcase',
  linkedTestcaseId: c.id,
  // Both app fields matter, and different things read them: `app` filters the project list
  // per app, while `linkedTestcase.app` is what syncs a replay's result back onto the
  // dashboard test case. A mismatch shows the project under one app and writes its results
  // to another.
  linkedTestcase: { app: APP, feature: c.feature, testcaseId: c.id },
  createdAt: '2026-08-31T10:30:00.000Z',
  lastStatus: 'never_run',
  runs: [],
  tags: tagsFor(c),
  folder: `EPTTS APIs / ${c.feature}`,
  // The browserless engine: still @playwright/test, but run in the config's `api` project —
  // no browser launched, login bootstrap skipped, no video or trace recorded. See
  // playwrightProjectFor in automation-hub/types.ts.
  engine: 'api',
}, null, 2) + '\n'

// ─── write ───────────────────────────────────────────────────────────────────

const wanted = new Set()
const byFeature = {}

for (const c of cases) {
  const name = projectName(c)
  wanted.add(name)
  ;(byFeature[c.feature] = byFeature[c.feature] || []).push(c)

  if (!WRITE) continue
  const dir = path.join(PROJECTS, name)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'test.spec.ts'), SPEC(c), 'utf8')

  // Preserve run history if the project already exists — only refresh the definition.
  const metaPath = path.join(dir, 'meta.json')
  if (fs.existsSync(metaPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      const next = JSON.parse(META(c))
      next.runs = existing.runs || []
      next.lastStatus = existing.lastStatus || 'never_run'
      next.createdAt = existing.createdAt || next.createdAt
      fs.writeFileSync(metaPath, JSON.stringify(next, null, 2) + '\n', 'utf8')
      continue
    } catch { /* malformed — rewrite below */ }
  }
  fs.writeFileSync(metaPath, META(c), 'utf8')
}

// ─── journeys: keep their specs, but keep app/engine in step ─────────────────

// The journeys are excluded from the generation loop above (their specs are hand-written),
// which means nothing else would ever update their `app` or `engine`. Left behind, they
// would keep pointing at the old app and would run under the browser project.
//
// They must also stay UNLINKED. A journey spec runs many tests, so a `linkedTestcase` would
// stamp one case's status from a whole-journey verdict AND overwrite the per-case project
// that legitimately owns it. Caught exactly that on eptts-api-supply-chain, so it is
// asserted here rather than remembered.
const wronglyLinked = []
const journeysUpdated = []
for (const name of KEEP_MULTI) {
  const metaPath = path.join(PROJECTS, name, 'meta.json')
  if (!fs.existsSync(metaPath)) continue
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))

  const drift = []
  if (meta.app !== APP) drift.push(`app ${meta.app} -> ${APP}`)
  if (meta.engine !== 'api') drift.push(`engine ${meta.engine ?? '(absent)'} -> api`)
  if (meta.linkedTestcase) {
    wronglyLinked.push(`${name} -> ${meta.linkedTestcase.testcaseId}`)
    drift.push('unlink')
  }
  if (drift.length === 0) continue
  journeysUpdated.push(`${name} (${drift.join(', ')})`)

  if (WRITE) {
    meta.app = APP
    meta.engine = 'api'
    meta.linkedTestcase = null
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
  }
}


// ─── prune projects that no longer correspond to a case ─────────────────────

const stale = []
if (fs.existsSync(PROJECTS)) {
  for (const name of fs.readdirSync(PROJECTS)) {
    if (!name.startsWith('eptts-api-')) continue      // leave other apps alone
    if (KEEP_MULTI.has(name)) continue
    if (wanted.has(name)) continue
    stale.push(name)
  }
}

if (stale.length && WRITE && PRUNE) {
  for (const name of stale) {
    fs.rmSync(path.join(PROJECTS, name), { recursive: true, force: true })
  }
}

// ─── report ──────────────────────────────────────────────────────────────────

console.log(WRITE ? '=== WROTE ===' : '=== DRY RUN (pass --write) ===')
for (const [feature, list] of Object.entries(byFeature)) {
  const gaps = list.filter((c) => c.expectFail).length
  const skips = list.filter((c) => c.skip).length
  console.log(`  ${feature.padEnd(26)} ${String(list.length).padStart(3)} project(s)` +
    (gaps ? `  ${gaps} known-gap` : '') + (skips ? `  ${skips} blocked` : ''))
}
console.log(`\ntotal: ${cases.length} per-case projects`)
console.log(`kept as multi-test journeys: ${[...KEEP_MULTI].join(', ')}`)
if (journeysUpdated.length) {
  console.log(`${WRITE ? 'updated' : 'WOULD update'} journey project(s): ${journeysUpdated.join(', ')}`)
}
if (wronglyLinked.length) {
  console.log(`${WRITE ? 'unlinked' : 'WOULD unlink'} journey project(s) wrongly bound to a ` +
    `single test case: ${wronglyLinked.join(', ')}`)
}

if (stale.length) {
  console.log(`\nstale projects (no matching case): ${stale.length}`)
  for (const s of stale) console.log(`   ${s}`)
  if (!PRUNE) console.log('   (pass --prune with --write to remove them)')
  else if (WRITE) console.log('   removed')
}
if (!WRITE) console.log('\n(dry run — nothing written)')
