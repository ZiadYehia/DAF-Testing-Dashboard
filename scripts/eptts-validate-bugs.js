#!/usr/bin/env node
/**
 * Validate every EPTTS bug report against that app's bug-format.md.
 *
 * Usage: node scripts/eptts-validate-bugs.js [--verbose]
 * Exit code 1 when any rule is violated, so it can gate a commit.
 *
 * Covers both apps. The test cases already had a validator; the bugs did not, and the
 * difference showed: four bugs filed in one sitting were all missing the required Priority
 * and Bug Type body sections, and nothing said so.
 *
 * Checks, in the order bug-format.md states them:
 *   - frontmatter carries every required field
 *   - `feature` matches the folder the bug lives in
 *   - `status` and `priority` come from their closed sets
 *   - the body has Steps / Expected / Actual / Environment / Priority / Bug Type, in order
 *   - the body's Priority and Bug Type repeat the frontmatter values
 *   - attachments are .jpg not .png, and are numbered in reproduction order
 *   - no credential literals (data/ is committed)
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const APPS = ['eptts-web', 'eptts-api']
const VERBOSE = process.argv.includes('--verbose')

const FRONTMATTER = [
  'title', 'status', 'jira_key', 'reported_at', 'feature', 'priority', 'bug_type',
  'parent_key', 'severity', 'layer', 'jira_status', 'jira_reporter', 'found_by', 'found_at',
]
const STATUS = ['draft', 'reported']
const PRIORITY = ['P1 – Critical', 'P2 – High', 'P3 – Medium', 'P4 – Low']

/** Body sections that must appear, in this order. Notes is optional. */
const SECTIONS = [
  '**Steps to Reproduce:**',
  '**Expected Result:**',
  '**Actual Result:**',
  '**Environment:**',
  '**Priority:**',
  '**Bug Type:**',
]

const problems = []
const add = (file, msg) => problems.push({ file, msg })

/** Secrets that must never appear in a committed file. */
function secretValues() {
  const p = path.join(REPO, 'automation-hub', '.env')
  if (!fs.existsSync(p)) return []
  return [...fs.readFileSync(p, 'utf8').matchAll(/^\s*\w*(?:APIKEY|PASSWORD|SECRET|TOKEN)\w*=(.+)$/gm)]
    .map((m) => m[1].trim().replace(/^["']|["']$/g, ''))
    .filter((v) => v.length > 7 && !/^(UNKNOWN|TODO|CHANGEME)/i.test(v))
}
const SECRETS = secretValues()

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null
  const end = text.indexOf('\n---', 4)
  if (end === -1) return null
  const block = text.slice(4, end)
  const out = {}
  let key = null
  for (const line of block.split('\n')) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (m) { key = m[1]; out[key] = m[2].trim(); continue }
    // folded scalar continuation (title: >-)
    if (key && /^\s+\S/.test(line)) out[key] = `${out[key]} ${line.trim()}`.trim()
  }
  return { fields: out, body: text.slice(end + 4) }
}

let total = 0
const perApp = {}

for (const app of APPS) {
  const root = path.join(REPO, 'data', app, 'bugs')
  if (!fs.existsSync(root)) continue
  perApp[app] = 0

  for (const feature of fs.readdirSync(root)) {
    const dir = path.join(root, feature)
    if (!fs.statSync(dir).isDirectory()) continue

    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith('-attachments')) {
        // Attachment conventions.
        const adir = path.join(dir, entry)
        const files = fs.readdirSync(adir).filter((f) => !f.startsWith('.'))
        const rel = `${app}/${feature}/${entry}`
        for (const f of files) {
          if (f.toLowerCase().endsWith('.png')) {
            add(rel, `"${f}" is a PNG — .gitignore blocks *.png, so it is silently never committed. Use .jpg.`)
          }
        }
        const images = files.filter((f) => /\.(jpg|jpeg|gif|webp)$/i.test(f))
        if (images.length > 1 && !images.every((f) => /^\d+-/.test(f))) {
          add(rel, `${images.length} images but not all numbered in reproduction order (1-…, 2-…)`)
        }
        continue
      }
      if (!entry.endsWith('.md')) continue

      total++
      perApp[app]++
      const file = `${app}/${feature}/${entry}`
      const text = fs.readFileSync(path.join(dir, entry), 'utf8')

      const parsed = parseFrontmatter(text)
      if (!parsed) { add(file, 'no YAML frontmatter'); continue }
      const { fields, body } = parsed

      for (const f of FRONTMATTER) {
        if (!(f in fields)) add(file, `frontmatter is missing "${f}"`)
      }
      if (fields.feature && fields.feature !== feature) {
        add(file, `frontmatter feature "${fields.feature}" does not match its folder "${feature}"`)
      }
      if (fields.status && !STATUS.includes(fields.status)) {
        add(file, `status "${fields.status}" is not one of ${STATUS.join(' / ')}`)
      }
      if (fields.priority && !PRIORITY.includes(fields.priority)) {
        add(file, `priority "${fields.priority}" is not one of ${PRIORITY.join(' / ')}`)
      }

      // Required body sections, in order.
      let cursor = -1
      for (const section of SECTIONS) {
        const at = body.indexOf(section)
        if (at === -1) { add(file, `body is missing the ${section} section`); continue }
        if (at < cursor) add(file, `${section} appears out of order`)
        cursor = at
      }

      // The body's Priority / Bug Type must repeat the frontmatter, or a reader gets two answers.
      const bodyPriority = /\*\*Priority:\*\*\s*(.+)/.exec(body)?.[1].trim()
      if (bodyPriority && fields.priority && bodyPriority !== fields.priority) {
        add(file, `body Priority "${bodyPriority}" disagrees with frontmatter "${fields.priority}"`)
      }
      const bodyType = /\*\*Bug Type:\*\*\s*(.+)/.exec(body)?.[1].trim()
      if (bodyType && fields.bug_type && bodyType !== fields.bug_type) {
        add(file, `body Bug Type "${bodyType}" disagrees with frontmatter "${fields.bug_type}"`)
      }

      for (const secret of SECRETS) {
        if (text.includes(secret)) add(file, 'contains a credential literal from automation-hub/.env')
      }
    }
  }
}

const byFile = {}
for (const p of problems) (byFile[p.file] = byFile[p.file] ?? []).push(p.msg)

console.log(`checked ${total} bug report(s): ${Object.entries(perApp).map(([a, n]) => `${a} ${n}`).join(', ')}`)
if (!problems.length) {
  console.log('\nOK — every bug conforms to bug-format.md')
} else {
  for (const [file, msgs] of Object.entries(byFile)) {
    console.log(`\n${file}`)
    for (const m of VERBOSE ? msgs : [...new Set(msgs)]) console.log(`   x  ${m}`)
  }
  console.log(`\n${problems.length} problem(s) across ${Object.keys(byFile).length} file(s)`)
  process.exitCode = 1
}
