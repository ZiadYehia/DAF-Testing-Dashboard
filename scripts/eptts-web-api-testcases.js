#!/usr/bin/env node
/**
 * Extract the EPTTS API test cases from the source spreadsheet into zTestGround's
 * on-disk feature format under data/eptts-web/features/.
 *
 * Usage:
 *   node scripts/eptts-web-api-testcases.js            # dry run (prints the summary only)
 *   node scripts/eptts-web-api-testcases.js --write     # write the files
 *
 * Source: EPTTS - API TEST CASES.xlsx — 11 sheets / 348 rows. Override path is
 * scripts/eptts-web-api-overrides.json (see its _readme for why 24 rows need one).
 *
 * Per sheet it writes data/eptts-web/features/<slug>/:
 *   <slug>-testcases.md        canonical 13-column table + Notes & Known Defects
 *   <slug>-testcases-v1.md     identical; the versioned file is what execution reads
 *                              (src/lib/execution.ts, features.ts getTestcaseVersions)
 *   execution-status-v1.json   TestCase ID -> ExecutionStatus, seeded from Status
 *   metadata.json              { module: "eptts-apis" }
 *   screenshots/               empty dir
 *
 * TestCase IDs are preserved VERBATIM, including the inconsistent TC_/TS_ prefixes,
 * so every result still maps 1:1 back to the spreadsheet. Do not renumber them.
 *
 * Idempotent: re-running regenerates the same files from the same inputs.
 */
const ExcelJS = require('exceljs')
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const SRC = process.env.EPTTS_API_XLSX || 'C:/Users/ziadm/Downloads/EPTTS - API TEST CASES.xlsx'
const OVERRIDES_PATH = path.join(__dirname, 'eptts-web-api-overrides.json')
const FEATURES = path.join(REPO, 'data', 'eptts-web', 'features')
const WRITE = process.argv.includes('--write')

const ENVIRONMENT = 'Masar Platform · https://192.168.225.195:8444 · tenant devsim'
const VPN_PRECONDITION = 'Citrix VPN connected'

/** sheet name -> feature identity. Order here is the module's display order. */
const SHEETS = {
  'Authentication':     { slug: 'api-authentication',     featureId: 'EPTTS_API_01', title: 'API — Authentication' },
  'Commission':         { slug: 'api-commission',         featureId: 'EPTTS_API_02', title: 'API — Commissioning' },
  'Packing':            { slug: 'api-packing',            featureId: 'EPTTS_API_03', title: 'API — Packing (Aggregation)' },
  'Unpacking':          { slug: 'api-unpacking',          featureId: 'EPTTS_API_04', title: 'API — Unpacking (Disaggregation)' },
  'Destruction':        { slug: 'api-destruction',        featureId: 'EPTTS_API_05', title: 'API — Destruction' },
  'Shipping':           { slug: 'api-shipping',           featureId: 'EPTTS_API_06', title: 'API — Shipping' },
  'Receiving':          { slug: 'api-receiving',          featureId: 'EPTTS_API_07', title: 'API — Receiving' },
  'Return':             { slug: 'api-return',             featureId: 'EPTTS_API_08', title: 'API — Return Shipping' },
  'Return Receiving':   { slug: 'api-return-receiving',   featureId: 'EPTTS_API_09', title: 'API — Return Receiving' },
  'Dispensing':         { slug: 'api-dispensing',         featureId: 'EPTTS_API_10', title: 'API — Dispensing' },
  'Partial Dispensing': { slug: 'api-partial-dispensing', featureId: 'EPTTS_API_11', title: 'API — Partial Dispensing' },
}

/**
 * Credentials that appear as literals in the source spreadsheet. data/ is committed
 * to git, so they are replaced with the env key that actually holds the value
 * (see testcase-writing-rules.md: "Secrets are never literals").
 */
const SECRET_SCRUB = [
  [/khedrjanssen@gmail\.com/gi, 'EPTTS_WEB_MFG_USERNAME'],
  [/Hello@123456789/g, 'EPTTS_WEB_MFG_PASSWORD'],
]

// ─── cell readers ────────────────────────────────────────────────────────────

/** Flatten any exceljs cell value (rich text, hyperlink, formula, date) to a string. */
function cellText(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('')
    if (v.text !== undefined) return String(v.text)
    if (v.hyperlink !== undefined) return String(v.hyperlink)
    if (v.result !== undefined) return String(v.result)
  }
  return String(v)
}

/**
 * Split a multi-line cell into logical items.
 *
 * The spreadsheet's cells contain a mix of real line-per-item lists and soft wraps
 * from manual line breaks mid-sentence ("...active on Masar B2B \nplatform API key
 * is issued"). A line beginning with a lowercase letter, a closing bracket, or a
 * list-continuation character is a wrap, not a new item, so it is joined back onto
 * the previous line. Without this, "1." numbering lands mid-sentence.
 */
function items(s) {
  const raw = String(s).split(/\r?\n/).map((l) => l.trim())
  const out = []
  for (const line of raw) {
    if (!line) continue
    const stripped = line.replace(/^\s*\d+[.)]\s*/, '')
    const wasNumbered = stripped !== line
    const isContinuation = !wasNumbered && out.length > 0 && /^[a-z\])},;:"']/.test(stripped)
    if (isContinuation) out[out.length - 1] += ' ' + stripped
    else out.push(stripped)
  }
  return out.filter(Boolean)
}

/** Collapse into a single-line numbered list: "1. a 2. b". */
function numbered(list) {
  if (list.length === 0) return ''
  return list.map((l, i) => `${i + 1}. ${l}`).join(' ')
}

/** Test Data style: "FieldName: value" pairs, semicolon-separated. */
function testData(list) {
  if (list.length === 0) return 'Not Applicable'
  return list.map((l) => l.replace(/^([^:=]{1,40}?)\s*=\s*/, '$1: ')).join('; ')
}

/** Markdown-table-safe: escape pipes, collapse whitespace, strip newlines. */
function cellSafe(s) {
  return String(s).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

/** Replace spreadsheet credential literals with the env key holding the real value. */
function scrub(s) {
  let out = String(s)
  for (const [re, key] of SECRET_SCRUB) out = out.replace(re, key)
  return out
}

// ─── status mapping ──────────────────────────────────────────────────────────

/** Sheet Status -> the table's Status vocabulary (testcase-writing-rules.md). */
function tableStatus(raw) {
  const s = cellText(raw).trim().toLowerCase()
  if (s.startsWith('pass')) return 'Pass'
  if (s.startsWith('fail')) return 'Fail'
  if (s.startsWith('blocked') || s.startsWith('skip')) return 'Blocked/Skipped'
  return 'Under Testing' // includes "New Added" and blank
}

/** Sheet Status -> EXECUTION_STATUSES in src/lib/execution-types.ts. */
function execStatus(raw) {
  switch (tableStatus(raw)) {
    case 'Pass': return 'pass'
    case 'Fail': return 'fail'
    case 'Blocked/Skipped': return 'blocked'
    default: return 'new_added'
  }
}

/** Pull a DW-### Jira key out of a note cell (often a full Atlassian URL). */
function jiraKey(raw) {
  const m = /\b(DW-\d+)\b/i.exec(cellText(raw))
  return m ? m[1].toUpperCase() : ''
}

// ─── main ────────────────────────────────────────────────────────────────────

const COLUMNS = [
  'Feature ID', 'TestCase ID', 'Tester', 'Validity', 'Test Cases Title / Objective',
  'Environment', 'Pre-condition', 'Test Data', 'Steps', 'Expected Results',
  'Status', 'Attachment', 'Type',
]
const HEADER = `| ${COLUMNS.join(' | ')} |`
const DIVIDER = '|' + '---|'.repeat(COLUMNS.length)

async function main() {
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'))
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(SRC)

  const summary = []
  const overridesApplied = []
  const scrubbed = []

  for (const ws of wb.worksheets) {
    const cfg = SHEETS[ws.name]
    if (!cfg) { console.warn(`!! unmapped sheet "${ws.name}" — SKIPPED`); continue }

    // Authentication carries an extra leading "Feature ID" column; every other sheet
    // starts at TestCase ID. One offset covers the entire difference.
    const off = ws.name === 'Authentication' ? 1 : 0
    const C = {
      id: 1 + off, tester: 2 + off, validity: 3 + off, title: 4 + off, env: 5 + off,
      pre: 6 + off, data: 7 + off, steps: 8 + off, expected: 9 + off,
      status: 10 + off, attachment: 11 + off, type: 12 + off, note: 13 + off,
    }

    const rows = []
    const notes = []

    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i)
      const id = cellText(row.getCell(C.id).value).trim()
      if (!id) continue // spacer / trailing blank row

      const ov = overrides[id] && typeof overrides[id] === 'object' ? overrides[id] : null
      if (ov) overridesApplied.push(id)

      const rawStatus = row.getCell(C.status).value
      const status = tableStatus(rawStatus)
      const noteRaw = cellText(row.getCell(C.note).value).trim()
      const bug = jiraKey(noteRaw)

      // Attachment holds the DW-### key only when the case is currently failing.
      // Otherwise the note survives verbatim in Notes & Known Defects below.
      let attachment = cellText(row.getCell(C.attachment).value).trim()
      if (!attachment && status === 'Fail' && bug) attachment = bug

      // Every field: override wins, else the sheet. Overrides supply arrays of
      // items (already one-per-item), the sheet supplies text needing items().
      const pick = (key, sheetCol, fmt) =>
        ov && ov[key] !== undefined
          ? fmt(Array.isArray(ov[key]) ? ov[key] : items(ov[key]))
          : fmt(items(cellText(row.getCell(sheetCol).value)))

      // The VPN is a genuine precondition for every request against this host and
      // is absent from the (staging-era) source sheet, so it is prepended unless an
      // override already states it.
      const preItems = ov && ov.pre !== undefined
        ? (Array.isArray(ov.pre) ? ov.pre : items(ov.pre))
        : [VPN_PRECONDITION, ...items(cellText(row.getCell(C.pre).value))]

      const title = ov && ov.title !== undefined
        ? ov.title
        : cellText(row.getCell(C.title).value)

      const validity = (ov && ov.validity) || cellText(row.getCell(C.validity).value) || 'Positive'
      const type = (ov && ov.type) || cellText(row.getCell(C.type).value).trim() || 'Functional'

      const cells = [
        cfg.featureId,
        id,
        cellText(row.getCell(C.tester).value).trim() || 'Mohamed Khedr',
        validity,
        title,
        ENVIRONMENT,
        numbered(preItems),
        pick('data', C.data, testData),
        pick('steps', C.steps, numbered),
        pick('expected', C.expected, numbered),
        status,
        attachment,
        type,
      ].map((c) => {
        const before = String(c)
        const after = scrub(before)
        if (after !== before) scrubbed.push(id)
        return cellSafe(after)
      })

      rows.push({ id, cells, execStatus: execStatus(rawStatus) })

      if (noteRaw) notes.push({ id, text: noteRaw.replace(/\r?\n/g, ' ').trim(), bug })
      if (ov && ov._authored) notes.push({ id, text: `_Authored, not from the source sheet:_ ${ov._authored}`, bug: '' })
    }

    // ─── assemble the markdown ───
    const body = [`# ${cfg.title} Test Cases`, '', HEADER, DIVIDER]
    for (const r of rows) body.push(`| ${r.cells.join(' | ')} |`)

    // Notes deliberately NOT written here: a test-case file is one H1 and one table.
    // Provenance goes to the feature's knowledge.md instead — see
    // scripts/eptts-web-feature-knowledge.js and testcase-writing-rules.md.
    if (notes.length > 0) {
      fs.mkdirSync(path.join(FEATURES, cfg.slug), { recursive: true })
      if (WRITE) {
        fs.writeFileSync(
          path.join(FEATURES, cfg.slug, 'case-provenance.json'),
          JSON.stringify(notes, null, 2) + '\n',
          'utf8',
        )
      }
    }

    body.push('')
    const md = body.join('\n')

    if (WRITE) {
      const dir = path.join(FEATURES, cfg.slug)
      fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true })
      fs.writeFileSync(path.join(dir, `${cfg.slug}-testcases.md`), md, 'utf8')
      fs.writeFileSync(path.join(dir, `${cfg.slug}-testcases-v1.md`), md, 'utf8')
      fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify({ module: 'eptts-apis' }, null, 2) + '\n', 'utf8')
      const exec = {}
      for (const r of rows) exec[r.id] = r.execStatus
      fs.writeFileSync(path.join(dir, 'execution-status-v1.json'), JSON.stringify(exec, null, 2) + '\n', 'utf8')
    }

    const tally = rows.reduce((a, r) => ((a[r.execStatus] = (a[r.execStatus] || 0) + 1), a), {})
    summary.push({ sheet: ws.name, slug: cfg.slug, count: rows.length, notes: notes.length, tally })
  }

  console.log(WRITE ? '=== WROTE FILES ===' : '=== DRY RUN (pass --write to apply) ===')
  console.log('sheet                 slug                       TCs  notes  execution tally')
  let total = 0
  for (const s of summary) {
    total += s.count
    console.log(
      ' ', s.sheet.padEnd(20), s.slug.padEnd(25), String(s.count).padStart(4),
      String(s.notes).padStart(6), ' ', JSON.stringify(s.tally)
    )
  }
  console.log(`\nfeatures: ${summary.length}   TOTAL TEST CASES: ${total}`)
  console.log(`overrides applied (${overridesApplied.length}): ${overridesApplied.join(', ')}`)
  console.log(`rows with scrubbed credential literals (${new Set(scrubbed).size}): ${[...new Set(scrubbed)].join(', ')}`)

  const expectedOverrides = Object.keys(overrides).filter((k) => !k.startsWith('_'))
  const missed = expectedOverrides.filter((k) => !overridesApplied.includes(k))
  if (missed.length) {
    console.error(`\n!! overrides that matched no spreadsheet row: ${missed.join(', ')}`)
    process.exitCode = 1
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
