#!/usr/bin/env node
/**
 * Build the EPTTS Web dashboard modules + features from a Phase 4 discovery manifest.
 *
 * Usage:
 *   node scripts/eptts-web-dashboard-features.js <manifest.json> <shotsDir>            # dry run
 *   node scripts/eptts-web-dashboard-features.js <manifest.json> <shotsDir> --write
 *
 * Creates, per discovered page, data/eptts-web/features/<slug>/:
 *   metadata.json            { module: "<module slug>" }
 *   workflow.md              Feature Details, Business Purpose, UI Elements, Happy Path,
 *                            Edge Cases, API calls observed, Notes
 *   screenshots/<slug>.jpg   copied from the discovery run (JPG, since .gitignore blocks *.png)
 *   <slug>-testcases.md      + -v1.md, canonical 13-column table
 *   execution-status-v1.json all new_added — nothing has been executed yet
 *
 * And data/eptts-web/modules/<slug>/module.json + knowledge/module-overview.md.
 *
 * Everything here is derived from what was actually observed in the browser; nothing
 * about page behaviour is invented. Where the discovery could not establish something,
 * the workflow says so rather than guessing.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const APP_DIR = path.join(REPO, 'data', 'eptts-web')
const [manifestPath, shotsDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const WRITE = process.argv.includes('--write')

if (!manifestPath || !shotsDir) {
  console.error('usage: node scripts/eptts-web-dashboard-features.js <manifest.json> <shotsDir> [--write]')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

// ─── modules ─────────────────────────────────────────────────────────────────

const MODULES = {
  platform: {
    name: 'Platform Dashboard',
    icon: 'LayoutDashboard',
    order: 2,
    description: 'Main EPTTS dashboard (:8444) — information centre, reporting, analytics, audit, and admin settings.',
    portal: 'dashboard',
    baseUrl: 'https://192.168.225.195:8444',
  },
  registry: {
    name: 'Master Data Registry',
    icon: 'BookMarked',
    order: 3,
    description: 'Registry portal (:8445) — trade parties, GS1 prefixes, products, pharmacy onboarding, and B2B API keys.',
    portal: 'registry',
    baseUrl: 'https://192.168.225.195:8445',
  },
  billing: {
    name: 'Billing Portal',
    icon: 'Receipt',
    order: 4,
    description: 'Billing portal (:8446) — unbilled operations, invoices, revenue reports, and fee configuration.',
    portal: 'billing',
    baseUrl: 'https://192.168.225.195:8446',
  },
}

/**
 * Per-page authored context - only what discovery could not infer on its own.
 *
 * Keyed "<portal>:<pageName>" because page names repeat across portals: both the main
 * dashboard and the Registry have a "products" page, and Registry and Billing both
 * have a "dashboard".
 */
const PAGE_META = {
  "dashboard:information-center": {
    module: "platform", priority: "P3", feature: "Information Center",
    purpose:
      "The post-login landing page. Publishes platform announcements, upcoming compliance dates, guides and support contacts to trade partners. Read-only for every role, and the only page every role can reach - which makes it the de-facto fallback route when navigation fails.",
  },
  "dashboard:command-center": {
    module: "platform", priority: "P1", feature: "Command Center",
    purpose:
      "The national operations overview: pack counts by lifecycle status, stock value, partner activity and expiry exposure. This is the page a regulator looks at first, so wrong numbers here are worse than a broken page - they are believed.",
  },
  "dashboard:reporting": {
    module: "platform", priority: "P2", feature: "Reports",
    purpose:
      "Stock and shipment reporting with a date-range filter, search, pagination and CSV export. The export is what partners reconcile against, so column fidelity matters as much as the on-screen totals.",
  },
  "dashboard:analytics": {
    module: "platform", priority: "P2", feature: "Analytics",
    purpose:
      "Four analytical views over the same traceability data - Activity, Inventory, Shipments and Expiry risk. Expiry risk is the commercially significant one: it drives write-off decisions.",
  },
  "dashboard:violations": {
    module: "platform", priority: "P2", feature: "Violations",
    purpose:
      "Compliance violations raised against trade partners, bucketed by severity. Drives regulatory follow-up, so a missed violation is a compliance failure rather than a display bug.",
  },
  "dashboard:audit-console": {
    module: "platform", priority: "P1", feature: "Audit Console",
    purpose:
      "The regulatory audit trail across four tabs - Regulatory events, EDA submissions, Master-data changes and Integrity. This is the evidence record: it must be complete, immutable and attributable. It also carries a 'What is not recorded?' disclosure, which is itself worth verifying against reality.",
  },
  "dashboard:master-data": {
    module: "platform", priority: "P2", feature: "Master Data Snapshots",
    purpose:
      "Generates and distributes full master-data snapshots and incremental deltas that integrators pull via the manifest endpoint. Each file is SHA-256 stamped and the manifest is HMAC-signed, so integrity verification is part of the contract rather than optional.",
  },
  "dashboard:settings-admin": {
    module: "platform", priority: "P1", feature: "Settings (Administration)",
    purpose:
      "The full platform administration surface: 15 tabs covering partner types (Government, Manufacturer, Distributor, Dispenser), Pharmacies and Pharmacy Admins, POS Partners, B2B Partners, Platform Staff, User Locks, Geography and System Configuration. The highest-privilege page in the product - and currently unreachable from the navigation menu.",
  },
  "dashboard:products": {
    module: "platform", priority: "P2", feature: "Product Display",
    purpose:
      "Browses the registered product catalogue as the platform sees it. Also unreachable from the navigation menu.",
  },
  "registry:dashboard": {
    module: "registry", priority: "P2", feature: "Registry Dashboard",
    purpose:
      "Registry portal landing view - opens directly onto the Parties register.",
  },
  "registry:parties": {
    module: "registry", priority: "P1", feature: "Parties",
    purpose:
      "The authoritative trade-party register - every manufacturer, distributor, branch and pharmacy with its GLN, GS1 prefix, GCP length, licence status and parent. This is also where B2B API keys are issued, via the per-row 'B2B Key' action; the platform cannot display an existing key, only replace it, so every rotation is irreversible.",
  },
  "registry:prefixes": {
    module: "registry", priority: "P2", feature: "GS1 Prefixes",
    purpose:
      "GS1 Company Prefixes and their owning GLN. The GCP length here determines how every SGTIN and SSCC for that partner is parsed, so a wrong prefix silently corrupts EPC interpretation across the whole platform.",
  },
  "registry:products": {
    module: "registry", priority: "P1", feature: "Registry Products",
    purpose:
      "The authoritative product catalogue: GTIN, name, manufacturer, MAH GLN, unit price, dispense type and the Dawana-integration flag. Two fields here drive API behaviour directly - dispenseType decides whether partial dispensing is possible at all, and the Dawana flag blocks dispensing through the B2B API entirely. The GTIN/name field-swap defect is visible on this page.",
  },
  "registry:register-pharmacy": {
    module: "registry", priority: "P2", feature: "Register Pharmacy",
    purpose:
      "Pharmacy onboarding form - the widest input surface in the product (25 fields), which makes it the highest-value target for mandatory-field and format validation testing.",
  },
  "billing:dashboard": {
    module: "billing", priority: "P2", feature: "Billing Dashboard",
    purpose:
      "Billing portal landing view - loads a MAH's outstanding dues by GLN.",
  },
  "billing:unbilled-operations": {
    module: "billing", priority: "P2", feature: "Unbilled Operations",
    purpose:
      "Lists a MAH's packing operations that have not yet been invoiced, loaded by MAH GLN. This is the input to invoice generation, so an omission here becomes lost revenue.",
  },
  "billing:invoices": {
    module: "billing", priority: "P1", feature: "Invoices",
    purpose:
      "Issued invoices with piece counts, billing charge, e-service fee, total and payment state. These are financial records - arithmetic correctness and immutability after payment are the whole point.",
  },
  "billing:reports": {
    module: "billing", priority: "P2", feature: "Billing Reports",
    purpose:
      "Revenue and billing reporting across MAHs and periods.",
  },
  "billing:configuration": {
    module: "billing", priority: "P2", feature: "Fee Configuration",
    purpose:
      "Price-band table driving per-unit fees (from-price, to-price, fee per unit). Changing a band changes what every partner is charged, so boundary behaviour at band edges is the critical case.",
  },
}

/** PAGE_META lookup for a discovered page, keyed by portal so names cannot collide. */
function metaFor(page) {
  return PAGE_META[`${page.portal}:${page.name}`]
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Feature slug for a discovered page: portal-prefixed so the three portals never collide. */
function featureSlug(page) {
  const prefix = page.portal === 'dashboard' ? 'web' : page.portal
  return `${prefix}-${slugify(page.name)}`
}

function moduleFor(page) {
  const meta = metaFor(page)
  if (meta?.module) return meta.module
  return page.portal === 'dashboard' ? 'platform' : page.portal
}

// ─── test-case generation ────────────────────────────────────────────────────

const ENVIRONMENT = 'Masar Platform · https://192.168.225.195:8444 · tenant devsim'
const COLUMNS = [
  'Feature ID', 'TestCase ID', 'Tester', 'Validity', 'Test Cases Title / Objective',
  'Environment', 'Pre-condition', 'Test Data', 'Steps', 'Expected Results',
  'Status', 'Attachment', 'Type',
]

/**
 * Derive test cases from what was actually observed on the page. Deliberately
 * conservative: render/navigation/permission cases are generated for every page, and
 * table/filter/tab/export cases only when the page really has those controls.
 */
function casesFor(page, featureId, prefix, baseUrl) {
  const cases = []
  let n = 0
  const id = () => `${prefix}_${String(++n).padStart(3, '0')}`
  const pre = (extra = '') =>
    `1. Citrix VPN connected 2. Browser open at ${baseUrl} 3. Logged in as Platform Admin` +
    (page.portal === 'dashboard' ? ` 4. User is on the ${page.headings[0] || page.name} page` : ` 4. ${page.portal} portal open`) +
    (extra ? ` 5. ${extra}` : '')

  const add = (validity, title, steps, expected, type = 'Functional', data = 'Not Applicable', extraPre = '') =>
    cases.push({ id: id(), validity, title, pre: pre(extraPre), data, steps, expected, type })

  add('Positive', `Validate that the ${page.headings[0] || page.name} page renders with its heading and primary controls`,
    `1. Navigate to ${page.route} 2. Observe the page heading 3. Observe the primary controls`,
    `1. The page loads without error 2. The heading "${page.headings[0] || page.name}" is displayed` +
    (page.buttons.length ? ` 3. The controls ${page.buttons.slice(0, 4).map((b) => `"${b}"`).join(', ')} are visible` : ''))

  if (page.portal === 'dashboard') {
    add('Positive', `Validate that ${page.route} is reachable by direct URL and survives a refresh`,
      `1. Enter ${baseUrl}${page.route} in the address bar 2. Observe the page 3. Refresh the browser`,
      `1. The page loads directly without redirecting to /information-center 2. The same page is shown after refresh`)
  }

  if (page.tables?.length) {
    const cols = page.tables[0].columns || []
    if (cols.length) {
      add('Positive', 'Validate that the table displays all expected columns',
        '1. Observe the table header row',
        `1. The columns ${cols.slice(0, 10).map((c) => `"${c}"`).join(', ')} are displayed in order`)
    }
    add('Positive', 'Validate that the table renders an empty state when no records match',
      '1. Apply a filter or search value that matches no records 2. Observe the table body',
      '1. An empty-state message is displayed 2. No stale rows from the previous result remain 3. No console error occurs')
  }

  if (page.tabs?.length > 1) {
    add('Positive', 'Validate that every tab opens and loads its own data',
      `1. Click each tab in turn: ${page.tabs.slice(0, 8).join(', ')} 2. Observe the content area after each`,
      '1. Each tab becomes active when clicked 2. Each tab loads its own content without error 3. The previous tab\'s data is not shown under the new tab')
  }

  const hasSearch = page.inputs?.some((i) => /search|query|filter/i.test(`${i.name} ${i.placeholder} ${i.label}`))
  if (hasSearch) {
    add('Positive', 'Validate that search filters the result set',
      '1. Enter a value known to match at least one record in the search field 2. Observe the results',
      '1. Only records matching the search value are displayed 2. The result count reflects the filtered set')
    add('Negative', 'Validate that search handles a no-match value without error',
      '1. Enter a value that matches no record 2. Observe the results',
      '1. An empty state is displayed 2. No error is shown and the page remains usable')
  }

  if (page.buttons?.some((b) => /export|csv/i.test(b))) {
    add('Positive', 'Validate that the CSV export downloads and matches the on-screen data',
      '1. Apply a filter 2. Click Export CSV 3. Open the downloaded file',
      '1. A CSV file downloads 2. Its rows match the filtered on-screen rows 3. Its columns match the table columns')
  }

  if (page.inputs?.length >= 8) {
    add('Negative', 'Validate that submitting the form with all mandatory fields empty is rejected',
      '1. Leave every field empty 2. Submit the form',
      '1. The form is not submitted 2. A validation message is displayed for each mandatory field')
    add('Negative', 'Validate that an invalid GLN check digit is rejected',
      '1. Enter a 13-digit GLN whose GS1 check digit is invalid 2. Submit the form',
      '1. The form is rejected 2. A message indicates the GLN failed check-digit validation',
      'Functional', 'GLN: 8435308300003 (invalid check digit)')
  }

  add('Negative', 'Validate that a non-privileged role cannot reach this page',
    `1. Log in as a role without access to this page 2. Attempt to open ${page.route} directly by URL`,
    '1. Access is refused or the user is redirected 2. No data from this page is exposed 3. Hiding the menu entry alone is not sufficient')

  add('Negative', 'Validate that the page handles an expired session',
    '1. Leave the page open until the session expires 2. Trigger an action that calls the API',
    '1. The user is redirected to the Keycloak login page 2. No stale data is displayed 3. No unhandled console error occurs')

  if (page.xhr?.length) {
    add('Positive', 'Validate that the page surfaces a backend failure instead of failing silently',
      `1. Cause ${page.xhr[0].split(' ')[1] || 'the page API call'} to fail (e.g. disconnect the VPN) 2. Reload the page`,
      '1. An error state or message is displayed 2. The page does not show empty data as though it were a valid result',
      'Functional')
  }

  return cases
}

function testcaseTable(title, featureId, cases) {
  const rows = cases.map((c) => `| ${[
    featureId, c.id, 'Ziad Yehia', c.validity, c.title, ENVIRONMENT,
    c.pre, c.data, c.steps, c.expected, 'new_added', '', c.type,
  ].map((x) => String(x).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()).join(' | ')} |`)
  return [
    `# ${title} Test Cases`, '',
    `| ${COLUMNS.join(' | ')} |`,
    '|' + '---|'.repeat(COLUMNS.length),
    ...rows, '',
  ].join('\n')
}

// ─── workflow doc ────────────────────────────────────────────────────────────

function workflowFor(page, slug, featureId, mod, meta) {
  const L = []
  const heading = meta?.feature || page.headings[0] || page.name
  L.push(`# ${heading} — Dashboard Workflow`, '')
  L.push('## Feature Details', '', '| Field | Value |', '|-------|-------|')
  L.push(`| **Feature Name** | ${heading} |`)
  L.push(`| **Slug** | \`${slug}\` |`)
  L.push(`| **Feature ID** | \`${featureId}\` |`)
  L.push(`| **Module** | ${MODULES[mod].name} |`)
  L.push(`| **Portal** | ${MODULES[mod].baseUrl} |`)
  L.push(`| **Route** | \`${page.route}\` |`)
  L.push(`| **Text direction** | ${page.dir === 'rtl' ? 'RTL (Arabic default)' : page.dir} |`)
  L.push(`| **Priority** | ${meta?.priority || 'P3'} |`)
  L.push('')

  L.push('## Business Purpose', '', meta?.purpose || `Discovered page "${heading}". Purpose not yet documented with the product owner.`, '')

  L.push('## UI Elements', '', '| Element | Type | Detail |', '|---------|------|--------|')
  for (const h of page.headings.slice(0, 6)) L.push(`| ${h} | Heading | — |`)
  for (const t of (page.tabs || []).slice(0, 10)) L.push(`| ${t} | Tab | — |`)
  for (const b of (page.buttons || []).slice(0, 14)) L.push(`| ${b} | Button / action | — |`)
  for (const i of (page.inputs || []).slice(0, 14)) {
    const label = i.name || i.placeholder || i.label || '(unlabelled)'
    const detail = i.options?.length ? `options: ${i.options.slice(0, 8).join(', ')}` : (i.placeholder || '—')
    L.push(`| ${label} | ${i.tag}${i.type ? `[${i.type}]` : ''} | ${detail} |`)
  }
  for (const [n, t] of (page.tables || []).entries()) {
    L.push(`| Table ${n + 1} | Table | columns: ${(t.columns || []).join(', ') || 'unlabelled'} |`)
  }
  L.push('')

  if (page.kpis?.length) {
    L.push('## Displayed metrics', '')
    for (const k of page.kpis.slice(0, 10)) L.push(`- ${k}`)
    L.push('')
  }

  L.push('## Happy Path', '')
  L.push(`1. Connect the Citrix VPN and open ${MODULES[mod].baseUrl}.`)
  L.push('2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).')
  if (page.portal === 'dashboard') {
    L.push(`3. Navigate to \`${page.route}\`.`)
  } else {
    L.push(`3. Click **${page.route}** in the portal navigation.`)
  }
  L.push(`4. The page loads with the heading "${heading}".`)
  if (page.tables?.length) L.push('5. The table populates with records (or shows an empty state).')
  L.push('')

  L.push('## Edge Cases & Validation Rules', '')
  L.push('- **Role isolation** — a role without access must be refused on direct URL entry, not merely have the menu entry hidden.')
  L.push('- **Session expiry** — an expired Keycloak session must redirect to login, never display stale data.')
  L.push('- **Backend failure** — a failing API call must surface an error state, not render empty data as a valid result.')
  if (page.tables?.length) L.push('- **Empty state** — filtering to zero results must clear previous rows and show an empty state.')
  if (page.tabs?.length > 1) L.push('- **Tab isolation** — switching tabs must not show the previous tab\'s data.')
  if (page.dir === 'rtl' || page.portal === 'dashboard') {
    L.push('- **Bilingual UI** — the dashboard defaults to Arabic (RTL) with an EN toggle; layout and data must be correct in both directions.')
  }
  L.push('')

  if (page.xhr?.length) {
    L.push('## API calls observed', '')
    L.push('Captured from the browser during discovery — these are the endpoints this page depends on:', '')
    L.push('```')
    for (const c of page.xhr.slice(0, 14)) L.push(c)
    L.push('```', '')
  }

  L.push('## Notes', '')
  L.push('- Documented from live discovery against production on 2026-08-31; UI elements above are what the page actually rendered, not a specification.')
  L.push('- Test cases are all `new_added` — none has been executed yet.')
  if (page.portal === 'dashboard' && !page.reachable) {
    L.push('- **This route did not resolve during discovery** — it fell back to `/information-center`.')
  }
  if (page.portal === 'dashboard' && ['settings-admin', 'products', 'master-data'].includes(page.name)) {
    L.push('- **Reachability defect:** this page exists and works by direct URL but has no working navigation entry. See the filed bug.')
  }
  L.push('')
  return L.join('\n')
}

// ─── main ────────────────────────────────────────────────────────────────────

const PREFIX = { platform: 'WEB', registry: 'REG', billing: 'BIL' }

/** Registered test-case ID prefix per feature slug. Must match the rules doc. */
const CASE_PREFIX = {
  'web-information-center': 'WEB_INF',
  'web-command-center': 'WEB_CMD',
  'web-reporting': 'WEB_RPT',
  'web-analytics': 'WEB_ANL',
  'web-violations': 'WEB_VIO',
  'web-audit-console': 'WEB_AUD',
  'web-master-data': 'WEB_MDT',
  'web-settings-admin': 'WEB_SET',
  'web-products': 'WEB_PRD',
  'registry-dashboard': 'REG_DSH',
  'registry-parties': 'REG_PRT',
  'registry-prefixes': 'REG_PFX',
  'registry-products': 'REG_PRD',
  'registry-register-pharmacy': 'REG_RPH',
  'billing-dashboard': 'BIL_DSH',
  'billing-unbilled-operations': 'BIL_UNB',
  'billing-invoices': 'BIL_INV',
  'billing-reports': 'BIL_RPT',
  'billing-configuration': 'BIL_CFG',
}
let featureN = { platform: 0, registry: 0, billing: 0 }
const summary = []

for (const page of manifest.pages) {
  const mod = moduleFor(page)
  const meta = metaFor(page)
  const slug = featureSlug(page)
  const featureId = `EPTTS_${PREFIX[mod]}_${String(++featureN[mod]).padStart(2, '0')}`
  // Fixed, readable per-feature codes — see testcase-writing-rules.md's ID table.
  // Derived truncation (BIL_DASHBO, WEB_AUDITC) was unreadable and uneven.
  const casePrefix = CASE_PREFIX[slug]
  if (!casePrefix) throw new Error(`no registered ID prefix for feature "${slug}" — add one to CASE_PREFIX`)
  const cases = casesFor(page, featureId, casePrefix, MODULES[mod].baseUrl)
  const title = meta?.feature || page.headings[0] || page.name
  const md = testcaseTable(title, featureId, cases)
  const wf = workflowFor(page, slug, featureId, mod, meta)

  if (WRITE) {
    const dir = path.join(APP_DIR, 'features', slug)
    fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({ module: mod }, null, 2) + '\n')
    fs.writeFileSync(path.join(dir, 'workflow.md'), wf)
    fs.writeFileSync(path.join(dir, `${slug}-testcases.md`), md)
    fs.writeFileSync(path.join(dir, `${slug}-testcases-v1.md`), md)
    const exec = {}
    for (const c of cases) exec[c.id] = 'new_added'
    fs.writeFileSync(path.join(dir, 'execution-status-v1.json'), JSON.stringify(exec, null, 2) + '\n')

    const src = path.join(shotsDir, page.screenshot)
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, 'screenshots', `${slug}.jpg`))
  }

  summary.push({ slug, module: mod, featureId, cases: cases.length, shot: page.screenshot })
}

if (WRITE) {
  for (const [slug, m] of Object.entries(MODULES)) {
    const dir = path.join(APP_DIR, 'modules', slug)
    fs.mkdirSync(path.join(dir, 'knowledge'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'module.json'), JSON.stringify({
      slug, name: m.name, icon: m.icon, order: m.order, pathPrefix: slug, description: m.description,
    }, null, 2) + '\n')
    const feats = summary.filter((s) => s.module === slug)
    fs.writeFileSync(path.join(dir, 'knowledge', 'module-overview.md'), [
      `# ${m.name} — Module Overview`, '',
      m.description, '',
      `**Base URL:** ${m.baseUrl}`, '',
      'Requires the Citrix VPN. TLS uses a self-signed certificate, so every client must ignore',
      'certificate errors. Authentication is **Keycloak OIDC** (realm `masar`, client',
      '`masar-dashboard`, Authorization Code + PKCE) — the direct password grant is disabled, so',
      'automation must drive the real browser login.', '',
      '## Features', '',
      '| Feature ID | Slug | Test cases |', '|---|---|---|',
      ...feats.map((f) => `| \`${f.featureId}\` | \`${f.slug}\` | ${f.cases} |`),
      '',
      '## Notes', '',
      '- Discovered live against production on 2026-08-31.',
      '- All test cases are `new_added`; none has been executed.',
      '',
    ].join('\n'))
  }
}

console.log(WRITE ? '=== WROTE ===' : '=== DRY RUN (pass --write) ===')
for (const mod of Object.keys(MODULES)) {
  const feats = summary.filter((s) => s.module === mod)
  if (!feats.length) continue
  console.log(`\n[${MODULES[mod].name}]`)
  for (const f of feats) console.log(`  ${f.featureId}  ${f.slug.padEnd(30)} ${String(f.cases).padStart(2)} cases  shot=${f.shot ? 'yes' : 'NO'}`)
}
console.log(`\nmodules: ${Object.keys(MODULES).length}  features: ${summary.length}  test cases: ${summary.reduce((a, s) => a + s.cases, 0)}`)
