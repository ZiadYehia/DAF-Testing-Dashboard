#!/usr/bin/env node
/**
 * Embed the exact request and response into each API bug, for whoever has to fix it.
 *
 * Usage:
 *   node scripts/eptts-api-bug-evidence.js <report.json> [<report.json> ...]        # dry run
 *   node scripts/eptts-api-bug-evidence.js <report.json> ... --write
 *
 * WHY IN THE BODY RATHER THAN AS AN ATTACHMENT
 *
 * The platform only accepts images and video as attachments (ATTACHMENT_MIME in
 * src/lib/bugs.ts), so a .json of the exchange would sit on disk unrecognised. bug-format.md
 * explicitly welcomes a fenced JSON block in the body "when it makes the defect concrete",
 * which is exactly what a request/response pair does -- and it is readable in the ticket
 * without downloading anything.
 *
 * WHY IT READS THE REPORT AND NOT THE OUTPUT DIRECTORY
 *
 * Playwright truncates long test-output directory names and appends a hash, so
 * "TS_RECV_007 -- an empty sourceList is refused" lands in a folder called
 * "projects-eptts-api-receivi-b6924-empty-sourceList-is-refused-api". The case id is simply
 * not in the path. The JSON report, on the other hand, carries the test title next to the
 * absolute path of every attachment it produced -- so that is the mapping to trust.
 *
 * WHAT IT PICKS
 *
 * A bug names the cases it covers. For each, this finds that case's recorded exchanges and
 * takes the two calls that matter: the SUBMISSION (the request that should have been refused)
 * and the FINAL POLL (the platform's verdict). The intermediate polls are noise -- they all
 * say "still processing" -- and including twelve of them would bury the two that carry the
 * answer.
 *
 * Credentials are already masked at record time (eptts-api-log.ts), and this asserts that
 * before writing: `data/` is committed, so a leaked key here would be published.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
// API bugs only. A dashboard bug's evidence is a screenshot, not an HTTP exchange, and
// including eptts-web here would print a "no evidence found" line for every one of them.
const APPS = ['eptts-api']
/** Most exchanges to embed per bug. One bug covers 15 cases; 15 dumps would bury the point. */
const MAX_PER_BUG = 3
const WRITE = process.argv.includes('--write')
const REPORTS = process.argv.slice(2).filter((a) => !a.startsWith('--'))

if (!REPORTS.length || REPORTS.some((r) => !fs.existsSync(r))) {
  console.error('usage: node scripts/eptts-api-bug-evidence.js <report.json> [more.json ...] [--write]')
  process.exit(1)
}

const CASE_ID = /\b((?:TC|TS)_[A-Z]+_\d+)\b/g
const SECTION = '**Request / Response (for debugging):**'

/** case id -> its recorded exchanges, taken from the reports' attachment paths. */
function exchangesByCase(reportPaths) {
  const byCase = new Map()

  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      const id = (spec.title.match(/(?:TC|TS)_[A-Z]+_[0-9]+/) ?? [])[0]
      if (!id || byCase.has(id)) continue
      for (const t of spec.tests ?? []) {
        const result = t.results?.[t.results.length - 1]
        const att = (result?.attachments ?? []).find((a) => a.name === 'api-exchanges.json')
        if (!att?.path || !fs.existsSync(att.path)) continue
        try {
          const list = JSON.parse(fs.readFileSync(att.path, 'utf8'))
          if (Array.isArray(list) && list.length) byCase.set(id, list)
        } catch { /* a truncated artifact is not worth failing the whole run over */ }
      }
    }
    for (const child of suite.suites ?? []) visit(child)
  }

  for (const p of reportPaths) {
    const report = JSON.parse(fs.readFileSync(p, 'utf8'))
    for (const suite of report.suites ?? []) visit(suite)
  }
  return byCase
}

/**
 * The submission and the final verdict — the two calls a fixer needs.
 *
 * Take the LAST business call, not the first. A case like TC_SHIP_007 ("an empty sourceList
 * is refused") has to commission a pack and aggregate it before it can ship anything, so its
 * recording holds three SendEPCIS calls and the first one is a fixture. Quoting that one
 * shows the developer a perfectly ordinary commissioning document and none of the defect.
 */
function keyExchanges(list) {
  const isPoll = (e) => /MsgStatusQuery/i.test(e.url)
  const isBusiness = (e) => /SendEPCIS|Dispensation|epcis\/json/i.test(e.url)
    || (e.method === 'POST' && !isPoll(e) && !/auth/i.test(e.url))

  let idx = -1
  for (let i = 0; i < list.length; i++) if (isBusiness(list[i])) idx = i
  // The authentication bugs have no business call — /auth IS the subject. Only reached when
  // nothing else qualifies, so it never displaces a real submission.
  if (idx === -1) for (let i = 0; i < list.length; i++) if (/auth/i.test(list[i].url)) idx = i
  if (idx === -1) return { submission: null, verdict: null, fixtures: 0 }

  return {
    submission: list[idx],
    // The verdict must come AFTER the submission, or it is a fixture's status.
    verdict: list.slice(idx + 1).filter(isPoll).pop() ?? null,
    fixtures: list.slice(0, idx).filter(isBusiness).length,
  }
}

/**
 * Blank anything that could BE a credential before it is written into a committed file.
 *
 * eptts-api-log.ts masks credential HEADERS but not bodies. That is harmless for an EPCIS
 * document and emphatically not harmless for /auth, whose request carries a password and
 * whose response carries a live bearer token. `data/` is committed, so an unredacted token
 * here would be published — and unlike the keys in .env, a freshly minted token is not
 * something the secrets guard below could recognise.
 */
const CREDENTIAL_FIELD =
  /("(?:password|passwd|pwd|apikey|api_key|secret|client_secret|access_token|refresh_token|id_token|token)"\s*:\s*)"[^"]*"/gi

function redact(body) {
  if (!body) return body
  return String(body)
    .replace(CREDENTIAL_FIELD, (_m, key) => `${key}"«redacted»"`)
    // A JWT or bearer value not sitting behind a name we recognise.
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '«redacted JWT»')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}/gi, 'Bearer «redacted»')
}

const trim = (s, n) => {
  if (!s) return null
  const t = String(s)
  return t.length > n ? `${t.slice(0, n)}\n… (${t.length - n} more characters)` : t
}

function block(caseId, list) {
  const { submission, verdict, fixtures } = keyExchanges(list)
  if (!submission) return null

  const lines = [`<details><summary><code>${caseId}</code> — the exact exchange</summary>`, '']
  if (fixtures) {
    // Otherwise the request below looks like it arrived out of nowhere.
    lines.push(`Preceded by ${fixtures} successful setup call(s) that built the stock this ` +
      'request acts on. The call below is the one under test.', '')
  }
  lines.push('```http')
  lines.push(`${submission.method} ${submission.url}`)
  for (const [k, v] of Object.entries(submission.requestHeaders ?? {})) lines.push(`${k}: ${v}`)
  lines.push('')
  if (submission.requestBody) lines.push(trim(redact(submission.requestBody), 2200))
  lines.push('```')
  lines.push('')
  lines.push(`Response — **${submission.status} ${submission.statusText}** in ${Math.round(submission.durationMs)} ms:`)
  lines.push('```json')
  lines.push(trim(redact(submission.responseBody), 900) ?? '(no body)')
  lines.push('```')

  if (verdict) {
    lines.push('')
    lines.push('Then the platform\'s own verdict, from `POST /MsgStatusQuery`:')
    lines.push('```json')
    lines.push(trim(redact(verdict.responseBody), 1200) ?? '(no body)')
    lines.push('```')
  }
  lines.push('')
  lines.push('</details>')
  return lines.join('\n')
}

// ─── secrets guard ───────────────────────────────────────────────────────────

function secretValues() {
  const p = path.join(REPO, 'automation-hub', '.env')
  if (!fs.existsSync(p)) return []
  return [...fs.readFileSync(p, 'utf8').matchAll(/^\s*\w*(?:APIKEY|PASSWORD|SECRET|TOKEN)\w*=(.+)$/gm)]
    .map((m) => m[1].trim().replace(/^["']|["']$/g, ''))
    .filter((v) => v.length > 7 && !/^(UNKNOWN|TODO|CHANGEME)/i.test(v))
}
const SECRETS = secretValues()

// ─── apply ───────────────────────────────────────────────────────────────────

const byCase = exchangesByCase(REPORTS)
console.log(`recorded exchanges found for ${byCase.size} case(s)`)

let updated = 0
const noEvidence = []

for (const app of APPS) {
  const root = path.join(REPO, 'data', app, 'bugs')
  if (!fs.existsSync(root)) continue

  for (const feature of fs.readdirSync(root)) {
    const dir = path.join(root, feature)
    if (!fs.statSync(dir).isDirectory()) continue

    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.md')) continue
      const file = path.join(dir, entry)
      const text = fs.readFileSync(file, 'utf8')

      // Only the cases the bug CLAIMS to cover — a prose mention is not coverage.
      const covers = [...(text.match(/\*\*Covers test cases?:\*\*[^\n]*/g) ?? []).join(' ')
        .matchAll(CASE_ID)].map((m) => m[1])
      if (!covers.length) continue

      const withEvidence = covers.filter((id) => byCase.has(id))
      if (!withEvidence.length) { noEvidence.push(`${feature}/${entry.slice(0, 46)} (${covers.join(', ')})`); continue }

      const shown = withEvidence.slice(0, MAX_PER_BUG)
      const omitted = withEvidence.slice(MAX_PER_BUG)
      const blocks = shown.map((id) => block(id, byCase.get(id))).filter(Boolean)
      if (!blocks.length) { noEvidence.push(`${feature}/${entry.slice(0, 46)} (${covers.join(', ')})`); continue }

      // Say what was left out. A truncated list with no note reads as "this is all of it".
      const tail = omitted.length
        ? `\n\nThe same exchange shape repeats for the other case(s) this bug covers ` +
          `(${omitted.map((id) => `\`${id}\``).join(', ')}); they are omitted here for length.\n`
        : '\n'

      const section = `---\n${SECTION}\n\nCaptured from the automated run. Credentials are masked; ` +
        `intermediate "still processing" polls are omitted so the submission and the verdict ` +
        `stand out.\n\n${blocks.join('\n\n')}${tail}`

      let next = text
      if (next.includes(SECTION)) {
        // Replace the existing block so re-running does not stack duplicates.
        const start = next.indexOf(`---\n${SECTION}`)
        const after = next.indexOf('\n---\n', start + 10)
        next = next.slice(0, start) + section + (after === -1 ? '' : next.slice(after + 1))
      } else {
        const anchor = next.indexOf('---\n**Environment:**')
        next = anchor === -1
          ? `${next.replace(/\s*$/, '')}\n\n${section}`
          : next.slice(0, anchor) + section + next.slice(anchor)
      }

      for (const s of SECRETS) {
        if (next.includes(s)) {
          console.error(`REFUSING to write ${entry}: a credential from .env appears in the evidence`)
          process.exitCode = 1
          next = text
        }
      }
      if (next === text) continue

      if (WRITE) fs.writeFileSync(file, next)
      updated++
      console.log(`  ${WRITE ? 'embedded' : 'would embed'} ${blocks.length} exchange(s): ${feature}/${entry.slice(0, 48)}`)
    }
  }
}

console.log(`\n${updated} bug(s) ${WRITE ? 'updated' : 'to update'}`)
if (noEvidence.length) {
  console.log(`\nno recorded exchange for the covered case(s) of ${noEvidence.length} bug(s) — ` +
    'run those cases and re-run this:')
  for (const n of noEvidence) console.log(`   ${n}`)
}
if (!WRITE) console.log('\n(dry run — nothing written)')
