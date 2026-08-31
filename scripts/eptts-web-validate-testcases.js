#!/usr/bin/env node
/**
 * Validate every eptts-web test-case file against
 * data/eptts-web/knowledge/testcase-writing-rules.md.
 *
 * Usage: node scripts/eptts-web-validate-testcases.js [--verbose]
 * Exit code 1 when any rule is violated, so this can gate a commit.
 *
 * Checks, in the order the rules doc states them:
 *   - exactly 13 columns, in the canonical order
 *   - TestCase ID matches the feature's registered prefix, is sequential, no gaps
 *   - Validity, Status, Type drawn from their closed sets
 *   - Environment is the canonical production string
 *   - Pre-condition and Steps are single-line numbered lists starting "1. "
 *   - Pre-condition starts with the VPN precondition
 *   - Expected Results contain no modal verbs (should / will / would / shall)
 *   - Test Data says "Not Applicable", never "N/A"
 *   - Attachment is empty unless Status is Fail, in which case it holds DW-###
 *   - no credential literals anywhere (data/ is committed)
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const FEATURES = path.join(REPO, 'data', 'eptts-web', 'features')
const VERBOSE = process.argv.includes('--verbose')

const COLUMNS = [
  'Feature ID', 'TestCase ID', 'Tester', 'Validity', 'Test Cases Title / Objective',
  'Environment', 'Pre-condition', 'Test Data', 'Steps', 'Expected Results',
  'Status', 'Attachment', 'Type',
]
const ENVIRONMENT = 'Masar Platform · https://192.168.225.195:8444 · tenant devsim'
const VALIDITY = ['Positive', 'Negative']
const STATUS = ['Pass', 'Fail', 'Blocked/Skipped', 'Under Testing']
const TYPE = ['Functional', 'Security', 'Integration']
const MODALS = /\b(should|shall|would|will|must be able to)\b/i
const VPN_PRE = 'Citrix VPN connected'

/** Registered ID prefix per feature — the rules doc's ID scheme. */
const PREFIX = {
  'api-authentication': 'TC_AUTH', 'api-commission': 'TC_COMM', 'api-packing': 'TS_PACK',
  'api-unpacking': 'TS_UNPK', 'api-destruction': 'TC_DEST', 'api-shipping': 'TC_SHIP',
  'api-receiving': 'TS_RECV', 'api-return': 'TS_RTN', 'api-return-receiving': 'TS_RTRV',
  'api-dispensing': 'TC_DISP', 'api-partial-dispensing': 'TC_PDISP',
  // dashboard TAB features — each tab is its own page
  'web-settings-government': 'WEB_SGV',
  'web-settings-manufacturer': 'WEB_SMF',
  'web-settings-distributor': 'WEB_SDS',
  'web-settings-dispenser': 'WEB_SDP',
  'web-settings-system': 'WEB_SSY',
  'web-settings-platform': 'WEB_SPL',
  'web-settings-system-configuration': 'WEB_SSC',
  'web-settings-pharmacies': 'WEB_SPH',
  'web-settings-pharmacy-admins': 'WEB_SPA',
  'web-settings-pos-partners': 'WEB_SPP',
  'web-settings-b2b-partners': 'WEB_SBP',
  'web-settings-platform-staff': 'WEB_SPS',
  'web-settings-user-locks': 'WEB_SUL',
  'web-settings-geography': 'WEB_SGE',
  'web-audit-regulatory-events': 'WEB_ARE',
  'web-audit-eda-submissions': 'WEB_AES',
  'web-audit-master-data-changes': 'WEB_AMD',
  'web-audit-integrity': 'WEB_AIN',
  'web-analytics-activity': 'WEB_NAC',
  'web-analytics-inventory': 'WEB_NIV',
  'web-analytics-shipments': 'WEB_NSH',
  'web-analytics-expiry-risk': 'WEB_NER',
  // dashboard features — ours to assign, see the rules doc's ID table
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

/** Gaps inherited from the source spreadsheet that must NOT be closed. */
const ALLOWED_GAPS = new Set(['api-commission:21-23'])

/** Bug slugs filed under data/eptts-web/bugs/, so a draft: reference can be verified. */
const BUGS_DIR = path.join(REPO, 'data', 'eptts-web', 'bugs')
const DRAFT_BUGS = new Set()
if (fs.existsSync(BUGS_DIR)) {
  for (const feat of fs.readdirSync(BUGS_DIR)) {
    const d = path.join(BUGS_DIR, feat)
    if (!fs.statSync(d).isDirectory()) continue
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith('.md')) DRAFT_BUGS.add(f.slice(0, -3))
    }
  }
}

const problems = []
const add = (file, tc, msg) => problems.push({ file, tc, msg })

function parseTable(md) {
  const lines = md.split('\n')
  const rows = []
  let header = null
  for (const l of lines) {
    if (!l.startsWith('|')) continue
    if (/^\|[\s-|]+\|$/.test(l)) continue
    const cells = l.split('|').slice(1, -1).map((c) => c.trim())
    if (!header) { header = cells; continue }
    rows.push(cells)
  }
  return { header, rows }
}

const featureDirs = fs.readdirSync(FEATURES).filter((f) =>
  fs.existsSync(path.join(FEATURES, f, `${f}-testcases.md`)))

let totalRows = 0
const perFeature = []

for (const feature of featureDirs) {
  const file = `${feature}-testcases.md`
  const md = fs.readFileSync(path.join(FEATURES, feature, file), 'utf8')
  const { header, rows } = parseTable(md)

  if (!header) { add(file, '-', 'no table found'); continue }
  if (header.length !== 13) add(file, '-', `header has ${header.length} columns, expected 13`)
  for (let i = 0; i < COLUMNS.length; i++) {
    if (header[i] !== COLUMNS[i]) add(file, '-', `column ${i + 1} is "${header[i]}", expected "${COLUMNS[i]}"`)
  }

  const expectedPrefix = PREFIX[feature]
  const seenIds = []

  for (const r of rows) {
    totalRows++
    if (r.length !== 13) { add(file, r[1] || '?', `row has ${r.length} cells, expected 13`); continue }
    const [featureId, tc, tester, validity, title, env, pre, data, steps, expected, status, attachment, type] = r

    if (!featureId) add(file, tc, 'Feature ID is empty')
    if (!tc) { add(file, '?', 'TestCase ID is empty'); continue }
    seenIds.push(tc)
    if (expectedPrefix && !tc.startsWith(expectedPrefix)) {
      add(file, tc, `ID does not use the registered prefix "${expectedPrefix}"`)
    }
    if (!tester) add(file, tc, 'Tester is empty')
    if (!VALIDITY.includes(validity)) add(file, tc, `Validity "${validity}" is not one of ${VALIDITY.join(' / ')}`)
    if (!title) add(file, tc, 'Title is empty')
    if (env !== ENVIRONMENT) add(file, tc, `Environment is not the canonical string (got "${env.slice(0, 40)}…")`)

    if (!pre) add(file, tc, 'Pre-condition is empty')
    else {
      if (!pre.startsWith('1. ')) add(file, tc, 'Pre-condition is not a numbered list starting "1. "')
      if (!pre.includes(VPN_PRE)) add(file, tc, `Pre-condition does not state "${VPN_PRE}"`)
    }

    if (!data) add(file, tc, 'Test Data is empty (use "Not Applicable")')
    if (/\bN\/A\b/.test(data)) add(file, tc, 'Test Data uses "N/A" — the rules require "Not Applicable"')

    if (!steps) add(file, tc, 'Steps are empty')
    else if (!steps.startsWith('1. ')) add(file, tc, 'Steps are not a numbered list starting "1. "')

    if (!expected) add(file, tc, 'Expected Results are empty')
    else {
      if (!expected.startsWith('1. ')) add(file, tc, 'Expected Results are not a numbered list starting "1. "')
      const m = MODALS.exec(expected)
      if (m) add(file, tc, `Expected Results contain the modal verb "${m[1]}"`)
    }

    if (!STATUS.includes(status)) add(file, tc, `Status "${status}" is not one of ${STATUS.join(' / ')}`)
    // A failing case must name its cause: a Jira key, or a draft bug filed in-repo.
    const isDraftRef = /^draft:[a-z0-9-]+$/.test(attachment)
    if (status === 'Fail' && !/DW-\d+/.test(attachment) && !isDraftRef) {
      add(file, tc, 'Status is Fail but Attachment carries no DW-### key and no draft:<bug-slug> reference')
    }
    if (isDraftRef) {
      const slug = attachment.slice('draft:'.length)
      if (!DRAFT_BUGS.has(slug)) {
        add(file, tc, `Attachment references draft bug "${slug}" but no such bug is filed`)
      }
    }
    if (status !== 'Fail' && attachment) {
      add(file, tc, `Attachment is populated ("${attachment}") but Status is not Fail`)
    }
    if (!TYPE.includes(type)) add(file, tc, `Type "${type}" is not one of ${TYPE.join(' / ')}`)

    const blob = `${pre} ${data} ${steps}`
    if (/Devsim-[A-Za-z0-9!@#$%^&*-]{4,}|Hello@1234|khedrjanssen/.test(blob)) {
      add(file, tc, 'a credential literal appears in the row — reference the env key name instead')
    }
  }

  // Sequential, gapless numbering per feature.
  const nums = seenIds
    .map((id) => /(\d+)$/.exec(id))
    .filter(Boolean)
    .map((m) => Number(m[1]))
  const sorted = [...new Set(nums)].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) continue
    // One inherited gap is expected: the source spreadsheet has no TC_COMM_022, and
    // closing it would break the 1:1 mapping back to that sheet.
    if (ALLOWED_GAPS.has(`${feature}:${sorted[i - 1]}-${sorted[i]}`)) continue
    add(file, `${sorted[i - 1]}→${sorted[i]}`, `numbering gap between ${sorted[i - 1]} and ${sorted[i]}`)
  }
  if (new Set(seenIds).size !== seenIds.length) add(file, '-', 'duplicate TestCase IDs in this file')

  perFeature.push({ feature, rows: rows.length })

  // A test-case file holds ONE H1 and ONE table. Prose belongs in knowledge.md.
  for (const line of md.split('\n')) {
    if (/^##\s+/.test(line)) {
      add(file, '-', `prose section "${line.trim()}" — move it to the feature's knowledge.md`)
    }
  }
  const h1s = md.split('\n').filter((l) => /^#\s+/.test(l))
  if (h1s.length !== 1) add(file, '-', `expected exactly 1 H1 heading, found ${h1s.length}`)

  // The versioned file must be byte-identical — execution reads that one.
  const vFile = path.join(FEATURES, feature, `${feature}-testcases-v1.md`)
  if (!fs.existsSync(vFile)) add(file, '-', 'missing -testcases-v1.md (execution reads the versioned file)')
  else if (fs.readFileSync(vFile, 'utf8') !== md) add(file, '-', '-testcases-v1.md differs from the base file')
}

// ─── report ──────────────────────────────────────────────────────────────────

const byFile = {}
for (const p of problems) (byFile[p.file] = byFile[p.file] || []).push(p)

console.log(`checked ${featureDirs.length} feature files, ${totalRows} test cases\n`)

if (!problems.length) {
  console.log('OK — every test case conforms to testcase-writing-rules.md')
} else {
  // Group identical messages so 140 copies of one mistake read as one line.
  for (const [file, ps] of Object.entries(byFile)) {
    console.log(`${file}  (${ps.length} problem${ps.length === 1 ? '' : 's'})`)
    const counts = {}
    for (const p of ps) {
      const key = p.msg.replace(/"[^"]*"/g, '"…"')
      counts[key] = counts[key] || { n: 0, examples: [] }
      counts[key].n++
      if (counts[key].examples.length < 3) counts[key].examples.push(p.tc)
    }
    for (const [msg, c] of Object.entries(counts)) {
      console.log(`   x${String(c.n).padStart(3)}  ${msg}`)
      if (VERBOSE) console.log(`          e.g. ${c.examples.join(', ')}`)
    }
  }
  console.log(`\n${problems.length} problem(s) across ${Object.keys(byFile).length} file(s)`)
  process.exitCode = 1
}
