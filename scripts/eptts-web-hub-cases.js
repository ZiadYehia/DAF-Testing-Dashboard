#!/usr/bin/env node
/**
 * Generate one Automation Hub project per AUTOMATABLE, READ-ONLY dashboard test case.
 *
 * Usage:
 *   node scripts/eptts-web-hub-cases.js <manifest.json> <role-matrix.json>            # dry run
 *   node scripts/eptts-web-hub-cases.js <manifest.json> <role-matrix.json> --write
 *
 * Supersedes eptts-web-hub-specs.js, which emitted only the `_001` render case per feature.
 *
 * WHAT IS AUTOMATED
 *
 * Cases are classified by their title, which the generators wrote to a fixed set of patterns.
 * A case is emitted only when it is read-only AND the page supplies what it needs (a search
 * box, an export button, a table, an observed XHR). Anything else is reported as skipped with
 * the reason, so the gap is visible instead of implied.
 *
 * WHAT IS NOT, AND WHY
 *
 *  - **Form submission** ("mandatory fields empty is rejected", "invalid GLN check digit").
 *    These fill and submit a form on a production host. A validation failure writes nothing
 *    BY DEFINITION — but that is exactly the assumption you cannot make before the test runs,
 *    and being wrong means a real record. They need the run-scoped-identifier discipline the
 *    API suite has.
 *
 *  - **Role isolation on a page the role may legitimately use.** The generated case says "a
 *    non-privileged role cannot reach this page", which is simply untrue of Shipping or Trace
 *    for a manufacturer. Rather than guess, scripts/eptts-web-role-matrix.js MEASURES which
 *    routes block, and only those get the check. /admin is the interesting one: it does not
 *    block, but a manufacturer sees two tabs and one row — their own entity — with no
 *    administrative controls. That is scoped access working, not a hole, so the right
 *    assertion there is about scoping, not reachability, and it is left to be authored by hand.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const FEATURES = path.join(REPO, 'data', 'eptts-web', 'features')
const PROJECTS = path.join(REPO, 'automation-hub', 'projects')
const WRITE = process.argv.includes('--write')
const [manifestPath, matrixPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'))

if (!manifestPath || !matrixPath) {
  console.error('usage: node scripts/eptts-web-hub-cases.js <manifest.json> <role-matrix.json> [--write]')
  process.exit(1)
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'))
const pageByName = new Map(manifest.pages.map((p) => [p.name, p]))
const blocksRole = new Map(matrix.results.map((r) => [r.route, r.blocked]))

// ─── reading the authored data ───────────────────────────────────────────────

const field = (md, name) => {
  const m = new RegExp(`\\| \\*\\*${name}\\*\\* \\| ([^|]+) \\|`).exec(md)
  return m ? m[1].trim().replace(/^`|`$/g, '') : null
}

const tabRoute = (md) => {
  const m = /\| \*\*Route\*\* \| `([^`]+)` → tab \*\*([^*]+)\*\* \|/.exec(md)
  return m ? { route: m[1], tab: m[2].trim() } : null
}

function elementsFromWorkflow(md) {
  const section = md.split('## UI Elements')[1]?.split('\n## ')[0] ?? ''
  const columns = /columns: ([^|]+)/.exec(section)?.[1].split(',').map((c) => c.trim()).filter(Boolean) ?? []
  const buttons = []
  const inputs = []
  for (const line of section.split('\n')) {
    const b = /^\| ([^|]+?) \| Button \/ action \|/.exec(line)
    if (b) buttons.push(b[1].trim())
    const i = /^\| ([^|]+?) \| input \|/.exec(line)
    if (i) inputs.push(i[1].trim())
  }
  return { columns, buttons, inputs }
}

/** Every test case in a feature: id + title. */
function casesOf(feature) {
  const p = path.join(FEATURES, feature, `${feature}-testcases.md`)
  if (!fs.existsSync(p)) return []
  const out = []
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line.startsWith('| EPTTS_')) continue
    const c = line.split('|')
    out.push({ id: c[2].trim(), title: c[5].trim() })
  }
  return out
}

// ─── classify a case by its title ────────────────────────────────────────────

const RAW_KEY = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/
const isLabel = (b) => b && b !== 'AR' && b !== 'EN' && b.length >= 3 && b.length < 32 &&
  /[A-Za-z]{3}/.test(b) && !RAW_KEY.test(b)

/** Placeholder text of the page's search box, if it has one. */
function searchPlaceholder(t) {
  const cands = [
    ...(t.inputs ?? []).map((i) => (typeof i === 'string' ? i : i.placeholder || i.name || '')),
  ].filter(Boolean)
  const hit = cands.find((p) => /search|filter|find/i.test(p))
  if (!hit) return null
  // The assertion matches on a substring, so trim the placeholder's trailing ellipsis and
  // take a distinctive fragment rather than the whole sentence.
  return hit.replace(/\.\.\.$/, '').split(/\s+/).slice(0, 2).join(' ')
}

function classify(title, t) {
  const s = title.toLowerCase()

  if (/renders with its heading and primary controls|renders with its content/.test(s)) return { kind: 'render' }
  if (/reachable by direct url and survives a refresh/.test(s)) return { kind: 'directUrl' }
  if (/handles an expired session/.test(s)) return { kind: 'session' }
  if (/non-privileged role cannot reach this page/.test(s)) {
    return blocksRole.get(t.route)
      ? { kind: 'roleBlocked' }
      : { skip: `the role matrix shows ${t.route} does NOT block a manufacturer; the case as worded is not the requirement (see the generator header)` }
  }
  if (/surfaces a backend failure/.test(s)) {
    return t.xhr ? { kind: 'backendFailure' } : { skip: 'no XHR was observed on this page to fail' }
  }
  if (/displays all expected columns/.test(s)) {
    return t.columns.length ? { kind: 'columns' } : { skip: 'no table was observed on this page' }
  }
  if (/empty state when no records match|no-match value without error/.test(s)) {
    if (!t.columns.length) return { skip: 'no table was observed on this page' }
    return t.search ? { kind: 'emptyState' } : { skip: 'no search box was observed on this page' }
  }
  if (/search filters the result set/.test(s)) {
    return t.search ? { kind: 'searchFilters' } : { skip: 'no search box was observed on this page' }
  }
  if (/csv export downloads/.test(s)) {
    return t.exportButton ? { kind: 'csv' } : { skip: 'no export control was observed on this page' }
  }
  if (/every tab opens and loads its own data|tab opens and loads its own content|not carried over from another tab/.test(s)) {
    return t.tab ? { kind: 'render' } : { skip: 'tab-isolation needs the parent page, authored by hand' }
  }
  // "...reloads its data after a page refresh" / "the <X> page refresh" — same behaviour as
  // the direct-URL case: this is a fragment-mode SPA, so a reload re-runs the auth round trip.
  if (/page refresh|reloads its data/.test(s)) return { kind: 'directUrl' }

  // Tab-specific search wording, e.g. "search filters the manufacturer list".
  if (/search filters the .* list/.test(s)) {
    return t.search ? { kind: 'searchFilters' } : { skip: 'no search box was observed on this page' }
  }

  // A security check, and read-only: the screen must never render a key in full.
  if (/never displays a full api key/.test(s)) return { kind: 'apiKeyMasked' }

  // Rotating a key is IRREVERSIBLE and invalidates whatever is using it. Never automated
  // against production, however well-guarded the confirmation dialog looks.
  if (/rotating .*(key|credential)/.test(s)) {
    return { skip: 'rotates a live credential — irreversible, must never run against production' }
  }

  if (/mandatory fields|check digit|rejected/.test(s)) {
    return { skip: 'submits a form against production — needs write-safety review first' }
  }
  return { skip: 'no automation pattern matches this case title' }
}

// ─── build the targets ───────────────────────────────────────────────────────

const targets = []
for (const feature of fs.readdirSync(FEATURES)) {
  if (!feature.startsWith('web-')) continue
  const wf = path.join(FEATURES, feature, 'workflow.md')
  if (!fs.existsSync(wf)) continue
  const md = fs.readFileSync(wf, 'utf8')

  const asTab = tabRoute(md)
  const name = feature.replace(/^web-/, '')
  const page = pageByName.get(name)
  const el = elementsFromWorkflow(md)

  const t = asTab
    ? { feature, name, route: asTab.route, tab: asTab.tab, heading: null,
        buttons: el.buttons, columns: el.columns, inputs: el.inputs, xhr: null }
    : page
      ? { feature, name, route: field(md, 'Route'), tab: null, heading: page.headings?.[0],
          buttons: page.buttons ?? [], columns: page.tables?.[0]?.columns ?? [],
          inputs: page.inputs ?? [],
          xhr: (page.xhr ?? []).map((x) => x.split(' ').pop())
            .find((u) => u && !/users\/me/.test(u))?.split('?')[0]?.split('/').slice(-2).join('/') ?? null }
      : null
  if (!t || !t.route) continue

  t.search = searchPlaceholder(t)
  t.exportButton = (t.buttons ?? []).find((b) => /export/i.test(b) && isLabel(b)) ?? null
  t.priority = field(md, 'Priority') ?? 'P3'
  targets.push(t)
}

module.exports = { targets, classify, casesOf, isLabel }

// The emitter lives in a sibling module so this file stays about WHAT to automate.
require('./lib/eptts-web-emit-cases')({
  targets, classify, casesOf, isLabel, PROJECTS, WRITE,
})
