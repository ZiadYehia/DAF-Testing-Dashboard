#!/usr/bin/env node
/**
 * Bring each test-case table's Status and Attachment columns into line with the recorded
 * execution results.
 *
 * Usage:
 *   node scripts/eptts-sync-testcase-status.js            # dry run (prints the plan)
 *   node scripts/eptts-sync-testcase-status.js --write
 *
 * WHY THIS IS NEEDED
 *
 * A test case's Status column and its `execution-status-v1.json` entry are two records of the
 * same fact, written by different tools: the table is authored by the generators, the JSON is
 * written by the run recorder. Nothing kept them in step, so after a suite run the tables
 * still read `Under Testing` for hundreds of cases that had a real verdict — the file a human
 * actually opens was the one telling them nothing had been tested.
 *
 * `execution-status-v1.json` is the source of truth here: it is written from the run report,
 * whereas the table's value is only ever a default until someone runs something.
 *
 * ATTACHMENTS
 *
 * testcase-writing-rules.md: a `Fail` must carry a bug reference, because "a failing case with
 * no filed cause is either an unrecorded defect or an unmaintained test". The mapping is
 * derived from the bug reports themselves — each one lists the case ids it covers, so the
 * bugs stay the single place that knowledge lives and this cannot drift out of date the way a
 * hand-maintained map would.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const APPS = ['eptts-web', 'eptts-api']
const WRITE = process.argv.includes('--write')

/** execution vocabulary -> the Status column's test-case vocabulary. */
const STATUS = {
  pass: 'Pass',
  fail: 'Fail',
  blocked: 'Blocked/Skipped',
  new_added: 'Under Testing',
}

const CASE_ID = /\b((?:TC|TS|WEB|REG|BIL)_[A-Z]+_\d+)\b/g

/** case id -> [bug slug], read out of the bug reports' own text. */
function bugsByCase(app) {
  const map = new Map()
  const root = path.join(REPO, 'data', app, 'bugs')
  if (!fs.existsSync(root)) return map
  for (const feature of fs.readdirSync(root)) {
    const dir = path.join(root, feature)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      const slug = file.slice(0, -3)
      const body = fs.readFileSync(path.join(dir, file), 'utf8')
      /**
       * The reference a failing row should carry.
       *
       * bug-format.md: "A test case whose Status is Fail must carry the matching DW-### key(s)
       * in its Attachment column". Only once the bug has been filed does that key exist, so a
       * still-draft bug falls back to its slug. Emitting `draft:<slug>` unconditionally — which
       * this did — left DW-958's two failing rows pointing at a slug when the key was known.
       */
      const jiraKey = /^jira_key:\s*(DW-\d+)\s*$/m.exec(body)?.[1] ?? null
      const ref = jiraKey ?? `draft:${slug}`
      // Only a table row or an explicit "Covers test case" line counts as coverage.
      // A bug that MENTIONS a case in prose — "related, already filed for TC_COMM_003" — is
      // not claiming to cover it, and treating it as such attaches the wrong bug to a
      // failing row, which is worse than attaching none.
      for (const line of body.split('\n')) {
        const isTableRow = line.trimStart().startsWith('|')
        const isCoverage = /covers test case/i.test(line)
        if (!isTableRow && !isCoverage) continue
        for (const m of line.matchAll(CASE_ID)) {
          const list = map.get(m[1]) ?? []
          if (!list.includes(ref)) list.push(ref)
          map.set(m[1], list)
        }
      }
    }
  }
  return map
}

let changed = 0
let unchanged = 0
const failsWithoutBug = []
const perFeature = []

for (const app of APPS) {
  const featuresRoot = path.join(REPO, 'data', app, 'features')
  if (!fs.existsSync(featuresRoot)) continue
  const bugMap = bugsByCase(app)

  for (const feature of fs.readdirSync(featuresRoot)) {
    const dir = path.join(featuresRoot, feature)
    const statusPath = path.join(dir, 'execution-status-v1.json')
    if (!fs.existsSync(statusPath)) continue
    const exec = JSON.parse(fs.readFileSync(statusPath, 'utf8'))

    const bugLinks = {}
    let touched = 0

    // Both the flat and the -v1 copy are the same content and must stay identical.
    for (const name of [`${feature}-testcases.md`, `${feature}-testcases-v1.md`]) {
      const file = path.join(dir, name)
      if (!fs.existsSync(file)) continue

      const lines = fs.readFileSync(file, 'utf8').split('\n')
      let fileTouched = 0

      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('| EPTTS_')) continue
        const cells = lines[i].split('|')
        // ['', Feature ID, TestCase ID, ..., Status(12), Attachment(13), Type(14), '']
        if (cells.length < 15) continue

        const caseId = cells[2].trim()
        const recorded = exec[caseId]
        if (!recorded) continue

        const wantStatus = STATUS[recorded]
        if (!wantStatus) continue

        const wantAttachment = wantStatus === 'Fail'
          ? (bugMap.get(caseId) ?? []).join(' ')
          : ''

        if (wantStatus === 'Fail' && !wantAttachment && !failsWithoutBug.includes(caseId)) {
          failsWithoutBug.push(caseId)
        }

        const isStatus = cells[11].trim() !== wantStatus
        const isAttach = cells[12].trim() !== wantAttachment
        if (!isStatus && !isAttach) continue

        cells[11] = ` ${wantStatus} `
        cells[12] = wantAttachment ? ` ${wantAttachment} ` : ' '
        lines[i] = cells.join('|')
        fileTouched++
        if (wantAttachment) bugLinks[caseId] = (bugMap.get(caseId) ?? [])[0]
      }

      if (fileTouched && WRITE) fs.writeFileSync(file, lines.join('\n'))
      touched = Math.max(touched, fileTouched)
    }

    // execution-bugs-v1.json is how the DB links a failing execution to its bug, so write it
    // from the same derived mapping rather than leaving the link table empty.
    if (Object.keys(bugLinks).length) {
      const p = path.join(dir, 'execution-bugs-v1.json')
      const existing = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}
      const next = { ...existing, ...bugLinks }
      if (WRITE) {
        fs.writeFileSync(p, JSON.stringify(
          Object.fromEntries(Object.keys(next).sort().map((k) => [k, next[k]])), null, 2) + '\n')
      }
    }

    if (touched) { changed += touched; perFeature.push(`${app}/${feature}: ${touched} row(s)`) }
    else unchanged++
  }
}

console.log(WRITE ? '=== WROTE ===' : '=== DRY RUN (pass --write) ===')
for (const line of perFeature) console.log(`  ${line}`)
console.log(`\nrows re-stated: ${changed}   features already current: ${unchanged}`)
if (failsWithoutBug.length) {
  console.log(
    `\nRULE VIOLATION — ${failsWithoutBug.length} failing case(s) with no bug filed. ` +
    'Per testcase-writing-rules.md a Fail must carry a bug reference, because a failure with ' +
    'no filed cause is either an unrecorded defect or an unmaintained test:')
  console.log(`   ${failsWithoutBug.join(' ')}`)
}
if (!WRITE) console.log('\n(dry run — nothing written)')
