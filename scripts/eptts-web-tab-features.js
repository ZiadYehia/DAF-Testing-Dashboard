#!/usr/bin/env node
/**
 * Build a feature per dashboard TAB from the Phase 4b tab manifest.
 *
 * Usage:
 *   node scripts/eptts-web-tab-features.js <manifest-tabs.json> <shotsDir> [--write]
 *
 * The first discovery pass treated a route as one feature, collapsing 22 tab pages into
 * 3. Each tab has its own table, controls and endpoints, so each becomes its own feature
 * with its own workflow, knowledge, screenshot and test cases.
 *
 * The three parent routes stay as "shell" features covering page load, the tab bars and
 * tab switching; the substance lives in the per-tab features.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const FEATURES = path.join(REPO, 'data', 'eptts-web', 'features')
const [manifestPath, shotsDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const WRITE = process.argv.includes('--write')

if (!manifestPath || !shotsDir) {
  console.error('usage: node scripts/eptts-web-tab-features.js <manifest-tabs.json> <shotsDir> [--write]')
  process.exit(1)
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const ENVIRONMENT = 'Masar Platform · https://192.168.225.195:8444 · tenant devsim'
const COLUMNS = [
  'Feature ID', 'TestCase ID', 'Tester', 'Validity', 'Test Cases Title / Objective',
  'Environment', 'Pre-condition', 'Test Data', 'Steps', 'Expected Results',
  'Status', 'Attachment', 'Type',
]

/** Registered ID prefix + Feature ID per tab feature. Must match the rules doc. */
const REG = {
  'web-settings-government':          ['WEB_SGV', 'EPTTS_WEB_10'],
  'web-settings-manufacturer':        ['WEB_SMF', 'EPTTS_WEB_11'],
  'web-settings-distributor':         ['WEB_SDS', 'EPTTS_WEB_12'],
  'web-settings-dispenser':           ['WEB_SDP', 'EPTTS_WEB_13'],
  'web-settings-system':              ['WEB_SSY', 'EPTTS_WEB_14'],
  'web-settings-platform':            ['WEB_SPL', 'EPTTS_WEB_15'],
  'web-settings-system-configuration':['WEB_SSC', 'EPTTS_WEB_16'],
  'web-settings-pharmacies':          ['WEB_SPH', 'EPTTS_WEB_17'],
  'web-settings-pharmacy-admins':     ['WEB_SPA', 'EPTTS_WEB_18'],
  'web-settings-pos-partners':        ['WEB_SPP', 'EPTTS_WEB_19'],
  'web-settings-b2b-partners':        ['WEB_SBP', 'EPTTS_WEB_20'],
  'web-settings-platform-staff':      ['WEB_SPS', 'EPTTS_WEB_21'],
  'web-settings-user-locks':          ['WEB_SUL', 'EPTTS_WEB_22'],
  'web-settings-geography':           ['WEB_SGE', 'EPTTS_WEB_23'],
  'web-audit-regulatory-events':      ['WEB_ARE', 'EPTTS_WEB_24'],
  'web-audit-eda-submissions':        ['WEB_AES', 'EPTTS_WEB_25'],
  'web-audit-master-data-changes':    ['WEB_AMD', 'EPTTS_WEB_26'],
  'web-audit-integrity':              ['WEB_AIN', 'EPTTS_WEB_27'],
  'web-analytics-activity':           ['WEB_NAC', 'EPTTS_WEB_28'],
  'web-analytics-inventory':          ['WEB_NIV', 'EPTTS_WEB_29'],
  'web-analytics-shipments':          ['WEB_NSH', 'EPTTS_WEB_30'],
  'web-analytics-expiry-risk':        ['WEB_NER', 'EPTTS_WEB_31'],
}

/** Why each tab matters, and what a tester must know. Authored, not inferred. */
const CONTEXT = {
  'web-settings-government': {
    priority: 'P2',
    why: 'Government/regulator user accounts. Small list, high privilege — an account here can see across every tenant, so account lifecycle (create, deactivate, last-login visibility) is the whole risk.',
  },
  'web-settings-manufacturer': {
    priority: 'P1',
    why: 'Manufacturer trade parties with their GLN, SGLN and GS1 prefix. The SGLN and prefix shown here determine how every EPC that partner submits is parsed, so a wrong value silently breaks their entire API integration rather than failing visibly.',
  },
  'web-settings-distributor': {
    priority: 'P1',
    why: 'Distributor and branch parties. The platform has no branch-role users — branch behaviour is carried by the distributor role — so this tab is where that conflation is visible and worth verifying.',
  },
  'web-settings-dispenser': {
    priority: 'P1',
    why: 'Pharmacy (dispenser) parties, including the linked admin and login state. A pharmacy with no linked admin cannot be administered, which makes the LINKED ADMIN column a real integrity check rather than decoration.',
  },
  'web-settings-system': {
    priority: 'P1',
    why: 'Integrator accounts and **their API keys**. This tab surfaces credentials, so its access control matters more than its display: anyone who can read this page can act as an integrator.',
  },
  'web-settings-platform': {
    priority: 'P1',
    why: 'Platform staff accounts by role (admin, support, finance, pricing_team). Role assignment here is what grants privilege everywhere else in the product.',
  },
  'web-settings-system-configuration': {
    priority: 'P1',
    why: 'Platform-wide configuration. A change here affects every tenant at once, which makes it the highest-blast-radius surface in the dashboard and the one where a mis-saved value is hardest to notice.',
  },
  'web-settings-pharmacies': {
    priority: 'P2',
    why: 'Main-branch pharmacy entities, distinct from the Dispenser tab which lists non-main branches. The main/branch split is easy to get wrong and determines who can administer whom.',
  },
  'web-settings-pharmacy-admins': {
    priority: 'P2',
    why: 'Pharmacy administrator accounts and the pharmacy each is bound to. An admin bound to the wrong pharmacy is a cross-tenant access problem, not a data-entry slip.',
  },
  'web-settings-pos-partners': {
    priority: 'P2',
    why: 'POS partner integrators, which act on behalf of a pharmacy GLN via actingOnBehalfOfGln. The delegation configured here is a distinct authorization surface from the pharmacy itself.',
  },
  'web-settings-b2b-partners': {
    priority: 'P1',
    why: 'B2B partners and **their API keys** — the credentials every API test depends on. Backed by GET /registry-service/api/v1/admin/b2b-partners, this is a more direct key-management surface than the Registry Parties page. Keys cannot be displayed once issued, only rotated, so any action here is irreversible.',
  },
  'web-settings-platform-staff': {
    priority: 'P2',
    why: 'Staff account list. Overlaps the Platform tab, so worth confirming which is authoritative and whether they can disagree.',
  },
  'web-settings-user-locks': {
    priority: 'P1',
    why: 'Account lockout state across all users. This is the brute-force defence: a lock that cannot be applied, or that silently expires, is a security control that only appears to work.',
  },
  'web-settings-geography': {
    priority: 'P3',
    why: 'Governorates and areas with bilingual names. Feeds address validation on pharmacy registration, so a missing area blocks onboarding somewhere far from this page.',
  },
  'web-audit-regulatory-events': {
    priority: 'P1',
    why: 'The primary regulatory audit trail — event time, type, category, severity, actor and entity GLN. This is the evidence record: it must be complete and attributable, and the highest-value test is that an action taken through the API actually appears here.',
  },
  'web-audit-eda-submissions': {
    priority: 'P1',
    why: 'Submissions to EDA (the regulator), with pending and overdue lists and accepted/rejected counts. An overdue submission is a compliance exposure with a deadline, so the overdue calculation matters as much as the list itself.',
  },
  'web-audit-master-data-changes': {
    priority: 'P2',
    why: 'Change log for parties, prefixes and products, including which fields changed. This is how a bad master-data edit is traced back — and master data is exactly where a wrong value silently corrupts EPC parsing.',
  },
  'web-audit-integrity': {
    priority: 'P1',
    why: 'Hash-chain verification per GLN, with a verdict and last-verified time. This is the tamper-evidence mechanism for the whole audit trail: if the chain cannot be verified, nothing else in the audit console can be relied on.',
  },
  'web-analytics-activity': {
    priority: 'P2',
    why: 'Event volumes by business step, separating net units from gross events. The gap between those two numbers is where double-counted or reversed events show up.',
  },
  'web-analytics-inventory': {
    priority: 'P1',
    why: 'On-hand stock by location, product, batch and expiry, with stock value. Reconciles against the pack lifecycle, so a discrepancy here means either the analytics aggregation or the traceability record is wrong — both worth chasing.',
  },
  'web-analytics-shipments': {
    priority: 'P2',
    why: 'Shipped versus received units per source/destination pair. The difference between the two columns is in-transit or lost stock, which makes this the clearest view of custody-transfer failures.',
  },
  'web-analytics-expiry-risk': {
    priority: 'P1',
    why: 'Stock approaching expiry, bucketed by days remaining. Directly drives write-off decisions, so a wrong bucket boundary has financial consequence — and boundary days are the cases that matter.',
  },
}

const slug2mod = () => 'platform'

// ─── test cases ──────────────────────────────────────────────────────────────

function casesFor(tab, featureId, prefix) {
  const cases = []
  let n = 0
  const id = () => `${prefix}_${String(++n).padStart(3, '0')}`
  const pre = `1. Citrix VPN connected 2. Browser open at https://192.168.225.195:8444 ` +
    `3. Logged in as Platform Admin 4. User is on the ${tab.parentLabel} page`
  const add = (validity, title, steps, expected, type = 'Functional', data = 'Not Applicable') =>
    cases.push({ id: id(), validity, title, pre, data, steps, expected, type })

  const cols = tab.tables[0]?.columns || []
  const T = tab.tab

  add('Positive', `Validate that the ${T} tab opens and loads its own content`,
    `1. Navigate to ${tab.route} 2. Click the "${T}" tab 3. Observe the content area`,
    `1. The "${T}" tab becomes the selected tab 2. Its content loads without error` +
    (cols.length ? ` 3. Its table is displayed` : ''))

  if (cols.length) {
    add('Positive', `Validate that the ${T} table displays all expected columns`,
      `1. Click the "${T}" tab 2. Observe the table header row`,
      `1. The columns ${cols.slice(0, 10).map((c) => `"${c}"`).join(', ')} are displayed in order`)

    add('Positive', `Validate that ${T} data is not carried over from another tab`,
      `1. Click a different tab and observe its rows 2. Click the "${T}" tab 3. Compare the columns and rows`,
      `1. The "${T}" tab displays its own columns 2. No rows from the previously selected tab remain visible`)
  }

  add('Positive', `Validate that the ${T} tab reloads its data after a page refresh`,
    `1. Click the "${T}" tab 2. Refresh the browser 3. Observe the page`,
    `1. The page reloads without error 2. The tab content is displayed again (the default tab is acceptable if the tab is not deep-linked)`)

  const hasSearch = (tab.inputs || []).some((i) =>
    /search|query|filter/i.test(`${i.name} ${i.placeholder} ${i.label}`))
  if (hasSearch) {
    add('Positive', `Validate that search filters the ${T} list`,
      `1. Click the "${T}" tab 2. Enter a value matching at least one record in the search field 3. Observe the results`,
      '1. Only matching records are displayed 2. The displayed count reflects the filtered set')
    add('Negative', `Validate that a no-match search on ${T} shows an empty state`,
      `1. Click the "${T}" tab 2. Enter a value that matches no record 3. Observe the results`,
      '1. An empty state is displayed 2. No stale rows remain 3. No console error occurs')
  }

  if (/API Key/i.test(cols.join(' '))) {
    add('Positive', `Validate that ${T} never displays a full API key`,
      `1. Click the "${T}" tab 2. Observe the API Key column for each row 3. Inspect the API response behind the page`,
      '1. The key is masked or shown only as a reference 2. No complete usable key is rendered in the page or returned in the response',
      'Security')
    add('Negative', `Validate that rotating a ${T} key requires explicit confirmation`,
      `1. Click the "${T}" tab 2. Click the key rotation action for a row 3. Observe the dialog 4. Cancel the dialog`,
      '1. A confirmation dialog is displayed stating the existing key stops working 2. Cancelling leaves the existing key unchanged',
      'Functional')
  }

  if ((tab.inputs || []).length >= 6) {
    add('Negative', `Validate that submitting the ${T} form with mandatory fields empty is rejected`,
      `1. Click the "${T}" tab 2. Open the create or edit form 3. Leave every field empty 4. Submit`,
      '1. The form is not submitted 2. A validation message is displayed for each mandatory field')
  }

  if (/GLN/i.test(cols.join(' '))) {
    add('Negative', `Validate that ${T} rejects a GLN with an invalid check digit`,
      `1. Click the "${T}" tab 2. Open the create or edit form 3. Enter a 13-digit GLN with an invalid GS1 check digit 4. Submit`,
      '1. The form is rejected 2. A message indicates the GLN failed check-digit validation',
      'Functional', 'GLN: 8435308300003 (invalid check digit)')
  }

  add('Negative', `Validate that a non-privileged role cannot reach the ${T} tab`,
    `1. Log in as a role without administration access 2. Open ${tab.route} directly by URL 3. Attempt to open the "${T}" tab`,
    '1. Access is refused or the user is redirected 2. No data from this tab is exposed 3. Hiding the tab alone is not sufficient')

  if ((tab.xhr || []).length) {
    const ep = (tab.xhr[0] || '').split(' ')[1] || 'the tab API call'
    add('Negative', `Validate that the ${T} tab surfaces a backend failure instead of an empty list`,
      `1. Cause ${ep} to fail 2. Click the "${T}" tab 3. Observe the content area`,
      '1. An error state or message is displayed 2. An empty table is not shown as though it were a valid result')
  }

  return cases
}

function table(title, featureId, cases) {
  const rows = cases.map((c) => `| ${[
    featureId, c.id, 'Ziad Yehia', c.validity, c.title, ENVIRONMENT,
    c.pre, c.data, c.steps, c.expected, 'Under Testing', '', c.type,
  ].map((x) => String(x).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()).join(' | ')} |`)
  return [`# ${title} Test Cases`, '', `| ${COLUMNS.join(' | ')} |`,
    '|' + '---|'.repeat(COLUMNS.length), ...rows, ''].join('\n')
}

function workflow(tab, slug, featureId, ctx) {
  const L = []
  const title = `${tab.parentLabel} — ${tab.tab}`
  L.push(`# ${title} — Dashboard Workflow`, '')
  L.push('## Feature Details', '', '| Field | Value |', '|-------|-------|')
  L.push(`| **Feature Name** | ${title} |`)
  L.push(`| **Slug** | \`${slug}\` |`)
  L.push(`| **Feature ID** | \`${featureId}\` |`)
  L.push('| **Module** | Platform Dashboard |')
  L.push(`| **Route** | \`${tab.route}\` → tab **${tab.tab}** |`)
  L.push(`| **Tab bar** | ${tab.bar} of the ${tab.parentLabel} page |`)
  L.push(`| **Priority** | ${ctx.priority} |`)
  L.push('')
  L.push('## Business Purpose', '', ctx.why, '')

  L.push('## UI Elements', '', '| Element | Type | Detail |', '|---------|------|--------|')
  for (const t of (tab.tables || [])) {
    if (t.columns?.length) L.push(`| Table | Table | columns: ${t.columns.join(', ')} |`)
  }
  for (const b of (tab.buttons || []).slice(0, 14)) L.push(`| ${b} | Button / action | — |`)
  for (const i of (tab.inputs || []).slice(0, 12)) {
    const label = i.name || i.placeholder || i.label || '(unlabelled)'
    const detail = i.options?.length ? `options: ${i.options.slice(0, 8).join(', ')}` : (i.placeholder || '—')
    L.push(`| ${label} | ${i.tag}${i.type ? `[${i.type}]` : ''} | ${detail} |`)
  }
  L.push('')

  L.push('## Happy Path', '')
  L.push('1. Connect the Citrix VPN and open https://192.168.225.195:8444.')
  L.push('2. Authenticate through Keycloak (`#username` / `#password` / `#kc-login`).')
  L.push(`3. Navigate to \`${tab.route}\`.`)
  L.push(`4. Click the **${tab.tab}** tab.`)
  L.push(`5. The tab becomes selected and loads its own content${tab.tables[0]?.columns?.length ? ' and table' : ''}.`)
  L.push('')

  L.push('## Edge Cases & Validation Rules', '')
  L.push('- **Tab isolation** — switching to this tab must not leave the previous tab\'s rows on screen.')
  L.push('- **Role isolation** — a non-admin must be refused on direct URL entry, not merely have the tab hidden.')
  L.push('- **Backend failure** — a failing call must show an error state, never an empty table presented as valid.')
  if (/API Key/i.test((tab.tables[0]?.columns || []).join(' '))) {
    L.push('- **Credential exposure** — the API Key column must not render a complete usable key, and rotation must confirm first because it is irreversible.')
  }
  if (/GLN/i.test((tab.tables[0]?.columns || []).join(' '))) {
    L.push('- **GLN validity** — check-digit validation matters here: a bad GLN corrupts every event addressed to that party.')
  }
  L.push('')

  if ((tab.xhr || []).length) {
    L.push('## API calls observed', '')
    L.push('Captured while opening this tab, so this is what it actually depends on:', '')
    L.push('```')
    for (const c of tab.xhr.slice(0, 12)) L.push(c)
    L.push('```', '')
  }

  L.push('## Notes', '')
  L.push(`- Discovered live on 2026-08-31 by opening the **${tab.tab}** tab on \`${tab.route}\`.`)
  L.push(`- Panel scoped via the tab's \`aria-controls\` (\`${tab.scopedTo}\`), so the elements above belong to this tab and not a sibling.`)
  if (!(tab.tables || []).some((t) => t.columns?.length)) {
    L.push('- No table was captured for this tab: it renders cards or a form rather than a grid, or its data had not loaded. Re-check before writing table-specific cases.')
  }
  L.push('- Test cases are all `Under Testing` — none has been executed.')
  L.push('')
  return L.join('\n')
}

function knowledge(tab, slug, ctx) {
  const L = []
  L.push(`# ${slug} — Feature Knowledge`, '')
  L.push('## Why this feature matters', '', ctx.why, '')
  L.push('## What will bite you', '')
  L.push(`- This is a **tab**, not a route: it lives at \`${tab.route}\` and is only reachable by clicking **${tab.tab}**. There is no deep link, so a test must navigate then click.`)
  L.push(`- The ${tab.parentLabel} page mounts several tab bars at once, so several tab panels are in the DOM simultaneously. Scope assertions to this tab's own panel (via the tab's \`aria-controls\`) or you will assert against a sibling tab's table.`)
  L.push('- PrimeNG renders an icon inside the tab, so the tab\'s `innerText` has a leading space. Match on trimmed `textContent`, or an anchored selector will never hit.')
  if (/API Key/i.test((tab.tables[0]?.columns || []).join(' '))) {
    L.push('- **Credentials are on screen here.** Key rotation is irreversible and the platform cannot re-display an existing key, so never trigger a rotation casually.')
  }
  L.push('')
  if ((tab.xhr || []).length) {
    L.push('## Endpoints this tab depends on', '', '```')
    for (const c of tab.xhr.slice(0, 12)) L.push(c)
    L.push('```', '')
    L.push('Check the endpoint directly before concluding the tab itself is at fault.', '')
  }
  L.push('## What every case here has to account for', '')
  L.push('- **The Citrix VPN is a hard precondition.** Without it every request fails after a uniform ~10 s connect timeout, which looks exactly like a hung server.')
  L.push('- **TLS is self-signed** — Playwright needs `ignoreHTTPSErrors: true`, curl needs `-k`.')
  L.push('- **Keycloak\'s direct password grant is disabled**, so automation must drive the real browser login.')
  L.push('- **Secrets never go in `data/`** — it is committed. Reference the env key name.')
  L.push('')
  return L.join('\n')
}

// ─── main ────────────────────────────────────────────────────────────────────

const written = []
const missing = []

for (const tab of manifest.tabs) {
  const slug = tab.slug
  const reg = REG[slug]
  const ctx = CONTEXT[slug]
  if (!reg || !ctx) { missing.push(slug); continue }
  const [prefix, featureId] = reg

  const cases = casesFor(tab, featureId, prefix)
  const md = table(`${tab.parentLabel} — ${tab.tab}`, featureId, cases)

  if (WRITE) {
    const dir = path.join(FEATURES, slug)
    fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({ module: slug2mod() }, null, 2) + '\n')
    fs.writeFileSync(path.join(dir, 'workflow.md'), workflow(tab, slug, featureId, ctx))
    fs.writeFileSync(path.join(dir, 'knowledge.md'), knowledge(tab, slug, ctx))
    fs.writeFileSync(path.join(dir, `${slug}-testcases.md`), md)
    fs.writeFileSync(path.join(dir, `${slug}-testcases-v1.md`), md)
    const exec = {}
    for (const c of cases) exec[c.id] = 'new_added'
    fs.writeFileSync(path.join(dir, 'execution-status-v1.json'), JSON.stringify(exec, null, 2) + '\n')
    const src = path.join(shotsDir, tab.screenshot)
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, 'screenshots', `${slug}.jpg`))
  }
  written.push({ slug, featureId, prefix, cases: cases.length, cols: (tab.tables[0]?.columns || []).length })
}

console.log(WRITE ? '=== WROTE ===' : '=== DRY RUN (pass --write) ===')
for (const w of written) {
  console.log(`  ${w.featureId}  ${w.slug.padEnd(36)} ${w.prefix}  ${String(w.cases).padStart(2)} cases  ${w.cols} cols`)
}
console.log(`\ntab features: ${written.length}   test cases: ${written.reduce((a, w) => a + w.cases, 0)}`)
if (missing.length) {
  console.error(`\n!! no registered prefix/context for: ${missing.join(', ')}`)
  process.exitCode = 1
}
