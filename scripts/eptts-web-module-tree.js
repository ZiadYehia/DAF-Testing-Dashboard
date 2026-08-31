#!/usr/bin/env node
/**
 * Rebuild the eptts-web module tree so it mirrors the dashboard sidebar.
 *
 * Usage:
 *   node scripts/eptts-web-module-tree.js            # dry run (prints the plan)
 *   node scripts/eptts-web-module-tree.js --write
 *
 * WHAT WAS WRONG
 *
 * Every dashboard feature lived in one catch-all `platform` module — 31 features under a
 * name that appears nowhere in the product. The sidebar has ten parent groups, and nobody
 * could find a page by the name they actually know it by.
 *
 * WHAT THIS DOES
 *
 *   1. Creates the 11 sidebar modules (module.json + knowledge/module-overview.md).
 *   2. Re-points the 41 existing features at them via metadata.json.
 *   3. Deletes the now-empty `platform` module.
 *
 * It does NOT create the 32 pages that have never been opened. Those are authored by the
 * discovery pass, from what is actually on the page — an empty feature folder would just be
 * something to rewrite, and a placeholder test-case table fails the validator anyway.
 *
 * FILES ARE ONLY TWO THIRDS OF A REASSIGNMENT
 *
 * `db:import` fills a NULL module but never overwrites one that is already set
 * (import.ts: `if (feature.module == null && moduleVal)`), and every feature here already
 * has one. So after this script run:
 *
 *   npx ts-node database/src/seed/sync-feature-modules.ts --app eptts-web
 *
 * which pushes metadata.json into `features.module` and `bugs.module`. Both matter and for
 * different reasons: the UI groups on the DB column, while src/lib/knowledge.ts's
 * getFeatureModule() reads metadata.json off DISK and never the DB — so a DB-only change
 * leaves every AI prompt loading the wrong module's knowledge tier.
 *
 * Nested sidebar groups (Integrations, Desktop Agent) become top-level modules: the modules
 * table is flat, with no parentId, and adding hierarchy is a separate piece of work.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const APP = 'eptts-web'
const APP_ROOT = path.join(REPO, 'data', APP)
const MODULES_DIR = path.join(APP_ROOT, 'modules')
const FEATURES_DIR = path.join(APP_ROOT, 'features')
const WRITE = process.argv.includes('--write')

const BASE_URL = 'https://192.168.225.195:8444'

// ─── the modules, in sidebar order ───────────────────────────────────────────
//
// `nav` is the sidebar label this module came from; `purpose` says what the group is FOR,
// which is the part a reader cannot infer from a list of routes.

const MODULES = [
  {
    slug: 'information-center', name: 'Information Center', icon: 'Info', order: 1,
    nav: 'INFORMATION CENTER',
    purpose:
      'Platform announcements, guidance and reference material pushed to trade partners. ' +
      'Read-only for everyone except platform staff, which makes it the cleanest place to ' +
      'test that a role sees only what it should.',
  },
  {
    slug: 'product-movement', name: 'Product Movement', icon: 'Truck', order: 2,
    nav: 'PRODUCT MOVEMENT',
    purpose:
      'Custody transfer — the core of a track-and-trace system. Every page here writes an ' +
      'EPCIS event that moves packs between parties: shipping, receiving, dispensing, the ' +
      'two return legs, and cancellation. The rule that governs all of it: custody moves on ' +
      'RECEIPT, not despatch, so a pack stays with the sender through `in_transit`.',
  },
  {
    slug: 'product-structure', name: 'Product Structure', icon: 'Boxes', order: 3,
    nav: 'PRODUCT STRUCTURE',
    purpose:
      'How packs are nested inside containers — aggregation and its reverse. A completed ' +
      'packing event SEALS the container, so appending to one is refused; that is deliberate, ' +
      'and it stops stock being added to something that may already have shipped.',
  },
  {
    slug: 'product-actions', name: 'Product Actions', icon: 'ScanLine', order: 4,
    nav: 'PRODUCT ACTIONS',
    purpose:
      'Operations performed on a pack in place rather than moving it: scanning to look one ' +
      'up, verifying authenticity, destroying it, and recall. Destruction and recall are ' +
      'terminal and irreversible, which makes their confirmation steps and role restrictions ' +
      'the highest-value things to test here.',
  },
  {
    slug: 'file-upload', name: 'File Upload', icon: 'Upload', order: 5,
    nav: 'FILE UPLOAD',
    purpose:
      'Bulk ingestion for partners who cannot integrate against the API: EPCIS XML documents ' +
      'and commissioning/packing CSVs. Bulk paths need their own coverage because they fail ' +
      'differently from single calls — partial acceptance, per-row errors, and files large ' +
      'enough to time out.',
  },
  {
    slug: 'master-data', name: 'Master Data', icon: 'Database', order: 6,
    nav: 'MASTER DATA',
    purpose:
      'The reference data every event is validated against — the product catalogue, ' +
      'inventory positions, pharmacy stock, and the MDM registry. If master data is wrong, ' +
      'correct events get rejected, so accuracy here is a precondition for everything else.',
  },
  {
    slug: 'monitoring', name: 'Monitoring', icon: 'Activity', order: 7,
    nav: 'MONITORING',
    purpose:
      'The operator\'s window into what the platform actually received and did: pack trace, ' +
      'B2B EPCIS messages, the message log, and webhook delivery history. This is where an ' +
      'async failure is diagnosed, which makes it the most useful module for confirming that ' +
      'a defect found elsewhere is visible to whoever has to support it.',
  },
  {
    slug: 'reports', name: 'Reports', icon: 'BarChart3', order: 8,
    nav: 'REPORTS',
    purpose:
      'Aggregate views over the traceability graph: the command centre, reporting, analytics, ' +
      'violations and the audit console. Numbers here are derived, so the thing to test is ' +
      'whether they agree with the underlying events — a total that disagrees with the trace ' +
      'is a worse defect than a page that fails to load.',
  },
  {
    slug: 'administration', name: 'Administration', icon: 'Settings', order: 9,
    nav: 'ADMINISTRATION',
    purpose:
      'Platform configuration and party management, almost all of it behind /admin\'s tab ' +
      'bars: manufacturers, distributors, pharmacies, government bodies, geography, staff, ' +
      'user locks and system configuration. Highest blast radius on the platform — a wrong ' +
      'GLN or a wrongly granted role here breaks trading for a real partner.',
  },
  {
    slug: 'integrations', name: 'Integrations', icon: 'Plug', order: 10,
    nav: 'ADMINISTRATION › Integrations',
    purpose:
      'What partners connect WITH: downloadable integration clients, master-data snapshots ' +
      'they sync from, and registered POS partners. A nested sidebar group promoted to a ' +
      'top-level module because this table has no hierarchy.',
  },
  {
    slug: 'desktop-agent', name: 'Desktop Agent', icon: 'MonitorSmartphone', order: 11,
    nav: 'ADMINISTRATION › Desktop Agent',
    purpose:
      'Fleet management for the Windows Masar Agent (the separate `eptts` app): monitoring, ' +
      'device registry, activation keys and updates. Tested from the dashboard side here — ' +
      'what an administrator can see and control, not the agent\'s own behaviour.',
  },
]

/**
 * Modules that already exist and keep their features — but NOT their sort order.
 *
 * These two are separate portals (:8445 and :8446), so they belong after the eleven
 * dashboard groups. Their old orders (3 and 4) now collide with product-structure and
 * product-actions, which would interleave portal modules into the middle of the dashboard
 * sidebar for no reason.
 */
const KEEP = [
  { slug: 'registry', order: 12 },
  { slug: 'billing', order: 13 },
]

// ─── where each existing feature belongs ─────────────────────────────────────
//
// Slugs are NOT renamed: automation projects reference features by slug through
// `linkedTestcase.feature`, and a rename would silently break that link.

const ASSIGN = {
  'information-center': ['web-information-center'],

  // "Product Display" in the sidebar.
  'master-data': ['web-products'],

  // The five report pages plus the tabs discovered inside /analytics and /audit.
  reports: [
    'web-command-center', 'web-reporting', 'web-analytics', 'web-violations', 'web-audit-console',
    'web-analytics-activity', 'web-analytics-expiry-risk', 'web-analytics-inventory', 'web-analytics-shipments',
    'web-audit-eda-submissions', 'web-audit-integrity', 'web-audit-master-data-changes', 'web-audit-regulatory-events',
  ],

  // /admin plus its 14 tabs. Note web-settings-pos-partners is the /admin TAB; the
  // standalone /pos-partners page is a separate feature under `integrations`.
  administration: [
    'web-settings-admin',
    'web-settings-b2b-partners', 'web-settings-dispenser', 'web-settings-distributor',
    'web-settings-geography', 'web-settings-government', 'web-settings-manufacturer',
    'web-settings-pharmacies', 'web-settings-pharmacy-admins', 'web-settings-platform',
    'web-settings-platform-staff', 'web-settings-pos-partners', 'web-settings-system',
    'web-settings-system-configuration', 'web-settings-user-locks',
  ],

  // "Master Data Snapshots" (/master-data) — distinct from the `master-data` MODULE, which
  // is the sidebar's MASTER DATA group. Kept under its original slug on purpose.
  integrations: ['web-master-data'],
}

// ─── plan ────────────────────────────────────────────────────────────────────

const onDisk = fs.existsSync(FEATURES_DIR)
  ? fs.readdirSync(FEATURES_DIR).filter((f) => fs.statSync(path.join(FEATURES_DIR, f)).isDirectory())
  : []

const currentModuleOf = (slug) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(FEATURES_DIR, slug, 'metadata.json'), 'utf8')).module ?? null
  } catch {
    return null
  }
}

const assigned = new Map()
for (const [mod, slugs] of Object.entries(ASSIGN)) {
  for (const s of slugs) {
    if (assigned.has(s)) throw new Error(`"${s}" is assigned to both ${assigned.get(s)} and ${mod}`)
    assigned.set(s, mod)
  }
}

const missing = [...assigned.keys()].filter((s) => !onDisk.includes(s))
if (missing.length) {
  console.error(`ERROR: assigned features that do not exist on disk: ${missing.join(', ')}`)
  process.exit(1)
}

// Anything still on `platform` that this script does not place would be orphaned by the
// module's deletion — refuse rather than leave it dangling.
const stranded = onDisk.filter((s) => currentModuleOf(s) === 'platform' && !assigned.has(s))
if (stranded.length) {
  console.error(`ERROR: still on "platform" with nowhere to go: ${stranded.join(', ')}`)
  process.exit(1)
}

// ─── write ───────────────────────────────────────────────────────────────────

const moduleOverview = (m, features) => `# ${m.name} — Module Overview

| | |
|---|---|
| Sidebar group | ${m.nav} |
| Portal | Masar Platform dashboard · ${BASE_URL} |
| Features | ${features.length} |

## Why this module exists

${m.purpose}

## Access

Dashboard authentication is **Keycloak OIDC** (realm \`masar\`, client \`masar-dashboard\`,
Authorization Code + PKCE). The direct password grant is disabled, so automation must drive
the real login form. The host is reachable **only over the Citrix VPN** and serves a
self-signed certificate, so every client needs \`ignoreHTTPSErrors\`.

Coverage is exercised as **admin** (\`admin@devsim.local\`) and **manufacturer**
(\`manufacturer@devsim.local\`). The distributor and pharmacy dashboard passwords are not
known — an admin reset returned 503 — so role isolation is currently tested across those two
roles only. That is a real limitation of the coverage, not of the platform.

## Relationship to the API

Every page here talks to the same endpoints the **\`eptts-api\`** app covers directly, so a
defect found on one side is worth checking on the other. Each feature's workflow lists the
XHR calls observed on that page, which is what makes the cross-check possible.
`

const summary = []

for (const m of MODULES) {
  const dir = path.join(MODULES_DIR, m.slug)
  const features = Object.entries(ASSIGN).find(([k]) => k === m.slug)?.[1] ?? []
  summary.push({ slug: m.slug, name: m.name, existing: features.length })

  if (!WRITE) continue
  fs.mkdirSync(path.join(dir, 'knowledge'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'module.json'),
    JSON.stringify({
      slug: m.slug,
      name: m.name,
      icon: m.icon,
      order: m.order,
      // pathPrefix is the URL segment. Never '' here: exactly one module per app may be the
      // root, and eptts-web has none.
      pathPrefix: m.slug,
      description: m.purpose.split('. ')[0] + '.',
    }, null, 2) + '\n',
  )
  fs.writeFileSync(path.join(dir, 'knowledge', 'module-overview.md'), moduleOverview(m, features))
}

// Renumber the kept portal modules so they sit after the dashboard groups. Only `order`
// changes — name, icon, description and features are left exactly as they are.
let reordered = 0
for (const k of KEEP) {
  const mp = path.join(MODULES_DIR, k.slug, 'module.json')
  if (!fs.existsSync(mp)) continue
  const manifest = JSON.parse(fs.readFileSync(mp, 'utf8'))
  if (manifest.order === k.order) continue
  reordered++
  if (WRITE) {
    manifest.order = k.order
    fs.writeFileSync(mp, JSON.stringify(manifest, null, 2) + '\n')
  }
}

let reassigned = 0
for (const [slug, mod] of assigned) {
  const before = currentModuleOf(slug)
  if (before === mod) continue
  reassigned++
  if (!WRITE) continue
  fs.writeFileSync(
    path.join(FEATURES_DIR, slug, 'metadata.json'),
    JSON.stringify({ module: mod }, null, 2) + '\n',
  )
}

// The platform module only goes once nothing points at it any more.
const platformDir = path.join(MODULES_DIR, 'platform')
const platformStillUsed = onDisk.some((s) => currentModuleOf(s) === 'platform' && !assigned.has(s))
let platformDeleted = false
if (fs.existsSync(platformDir) && !platformStillUsed) {
  platformDeleted = true
  if (WRITE) fs.rmSync(platformDir, { recursive: true, force: true })
}

// ─── report ──────────────────────────────────────────────────────────────────

console.log(WRITE ? '=== WROTE ===' : '=== DRY RUN (pass --write) ===')
for (const s of summary) {
  console.log(`  ${s.slug.padEnd(20)} ${s.name.padEnd(22)} ${String(s.existing).padStart(2)} existing feature(s)`)
}
for (const k of KEEP) console.log(`  ${k.slug.padEnd(20)} kept, order -> ${k.order}`)
console.log(`\nmodules created/refreshed: ${MODULES.length}`)
console.log(`portal modules renumbered: ${reordered}`)
console.log(`features re-pointed:       ${reassigned}`)
console.log(`platform module:           ${platformDeleted ? (WRITE ? 'deleted' : 'would be deleted') : 'left in place'}`)
console.log(
  '\nNEXT — files alone are not enough:\n' +
  '  npm run db:import                                                    (new module rows)\n' +
  '  npx ts-node database/src/seed/sync-feature-modules.ts --app eptts-web  (db:import never\n' +
  '      overwrites a module that is already set, so the reassignment needs this)\n' +
  '  npx ts-node database/src/seed/sync-modules.ts --app eptts-web         (drops rows whose\n' +
  '      module.json is gone — deleting the directory does not delete the row)',
)
if (!WRITE) console.log('\n(dry run — nothing written)')
