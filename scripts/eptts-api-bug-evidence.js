#!/usr/bin/env node
/**
 * Turn each API bug's recorded exchange into an IMAGE ATTACHMENT, and keep the bug body short.
 *
 * Usage:
 *   node scripts/eptts-api-bug-evidence.js <report.json> [more.json ...]            # dry run
 *   node scripts/eptts-api-bug-evidence.js <report.json> ... --write
 *
 * WHY AN IMAGE AND NOT THE JSON
 *
 * A bug should be readable in a few seconds; a 200-line EPCIS document pasted into the body
 * buries the one sentence that says what is broken. So the exchange belongs in an attachment.
 *
 * It has to be an image because of what this platform accepts. `ATTACHMENT_MIME`
 * (src/lib/bugs.ts, mirrored in database/src/seed/import.ts) allows only images and video, and
 * import.ts skips any other extension outright — a .json would sit on disk and never become an
 * attachment row. The bug page then renders each attachment as `isVideo ? <video> : <img>`, so
 * even if the MIME list were widened, a .json would draw as a broken image. Rendering the
 * exchange to a .jpg is the form that actually appears in the dashboard, where it gets read.
 *
 * `.jpg` rather than `.png` because that app's bug-format.md asks for it.
 *
 * The machine-readable copies are not lost: every run writes `api-log.html` and
 * `api-postman-collection.json` beside the results, and the bug's Notes line points at them
 * for anyone who wants to replay rather than read.
 *
 * WHAT IT PICKS
 *
 * The LAST business call — the one under test — plus the platform's own verdict from the poll
 * that followed it. Earlier calls are fixture setup (commission, then pack, then ship), and
 * quoting the first one shows an ordinary document and none of the defect.
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const APPS = ['eptts-api']
/** Most exchanges to attach per bug. One bug covers 15 cases; 15 images would bury the point. */
const MAX_PER_BUG = 3
const WRITE = process.argv.includes('--write')

/**
 * Only rebuild bugs whose slug contains this substring.
 *
 * Without it a single run rewrites EVERY bug's attachments from whichever report was passed,
 * which silently replaces one environment's evidence with another's: regenerating after a relay
 * run would overwrite the production exchanges on production bugs with relay ones, leaving the
 * report describing a host it was never found on. Evidence has to stay with the environment that
 * produced it, so a targeted rebuild needs a way to say which bug it means.
 */
const ONLY = (() => {
  const i = process.argv.indexOf('--only')
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : null
})()
const REPORTS = process.argv.slice(2).filter(
  (a, i, all) => !a.startsWith('--') && all[i - 1] !== '--only',
)

if (!REPORTS.length || REPORTS.some((r) => !fs.existsSync(r))) {
  console.error('usage: node scripts/eptts-api-bug-evidence.js <report.json> [more.json ...] [--write]')
  process.exit(1)
}

const CASE_ID = /\b((?:TC|TS)_[A-Z]+_\d+)\b/g
const NOTES_MARK = '**Exchange evidence:**'

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
        } catch { /* a truncated artifact is not worth failing the run over */ }
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

function keyExchanges(list) {
  const isPoll = (e) => /MsgStatusQuery/i.test(e.url)
  const isBusiness = (e) => /SendEPCIS|Dispensation|epcis\/json/i.test(e.url)
    || (e.method === 'POST' && !isPoll(e) && !/auth/i.test(e.url))

  let idx = -1
  for (let i = 0; i < list.length; i++) if (isBusiness(list[i])) idx = i
  // The authentication bugs have no business call — /auth IS the subject.
  if (idx === -1) for (let i = 0; i < list.length; i++) if (/auth/i.test(list[i].url)) idx = i
  if (idx === -1) return { submission: null, verdict: null, fixtures: 0 }

  return {
    submission: list[idx],
    verdict: list.slice(idx + 1).filter(isPoll).pop() ?? null,
    fixtures: list.slice(0, idx).filter(isBusiness).length,
  }
}

/**
 * Blank anything that could BE a credential before it is rendered into a committed image.
 *
 * eptts-api-log.ts masks credential HEADERS but not bodies. Harmless for an EPCIS document,
 * not harmless for /auth, whose request carries a password and whose response carries a live
 * bearer token. An image is just as public as text once committed.
 */
const CREDENTIAL_FIELD =
  /("(?:password|passwd|pwd|apikey|api_key|secret|client_secret|access_token|refresh_token|id_token|token)"\s*:\s*)"[^"]*"/gi

function redact(body) {
  if (!body) return body
  return String(body)
    .replace(CREDENTIAL_FIELD, (_m, key) => `${key}"«redacted»"`)
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '«redacted JWT»')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}/gi, 'Bearer «redacted»')
}

const trim = (s, n) => {
  if (!s) return null
  const t = String(s)
  return t.length > n ? `${t.slice(0, n)}\n… (${t.length - n} more characters)` : t
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The HTML that becomes the attachment image. */
function exchangeHtml(caseId, list) {
  const { submission, verdict, fixtures } = keyExchanges(list)
  if (!submission) return null

  // redact() the HEADERS too, not just the bodies. It was applied to requestBody/responseBody
  // only, so every rendered attachment carried a full `Authorization: Bearer eyJ…` while the
  // footer claimed "Credentials masked" — a live token baked into a .jpg under data/, which is
  // committed and goes out with the Jira report. Short-lived is not the same as safe to publish,
  // and a footer that promises masking has to be true.
  const headers = Object.entries(submission.requestHeaders ?? {})
    .map(([k, v]) => `${esc(k)}: ${esc(redact(v))}`).join('\n')
  const ok = submission.status < 400

  return `<div class="wrap">
  <h1>${esc(caseId)}</h1>
  ${fixtures ? `<p class="note">Preceded by ${fixtures} successful setup call(s) that built the
     stock this request acts on. The call below is the one under test.</p>` : ''}

  <h2>Request</h2>
  <pre class="req">${esc(submission.method)} ${esc(submission.url)}
${headers}

${esc(trim(redact(submission.requestBody), 2600) ?? '(no body)')}</pre>

  <h2>Response <span class="${ok ? 'ok' : 'bad'}">${submission.status} ${esc(submission.statusText)}</span>
    <span class="ms">${Math.round(submission.durationMs)} ms</span></h2>
  <pre>${esc(trim(redact(submission.responseBody), 1000) ?? '(no body)')}</pre>

  ${verdict ? `<h2>Platform verdict <span class="ms">POST /MsgStatusQuery</span></h2>
  <pre>${esc(trim(redact(verdict.responseBody), 1400) ?? '(no body)')}</pre>` : ''}

  <p class="foot">Credentials masked. Intermediate "still processing" polls omitted.</p>
</div>`
}

const PAGE_CSS = `
  :root { color-scheme: light }
  body { margin:0; background:#f8fafc; font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#0f172a }
  .wrap { padding:22px 26px; max-width:1100px }
  h1 { font:600 17px/1.3 system-ui,sans-serif; margin:0 0 4px }
  h2 { font:600 12px/1.4 system-ui,sans-serif; text-transform:uppercase; letter-spacing:.06em;
       color:#475569; margin:18px 0 6px }
  pre { margin:0; padding:12px 14px; background:#fff; border:1px solid #e2e8f0; border-radius:6px;
        white-space:pre-wrap; word-break:break-word; overflow-wrap:anywhere }
  pre.req { background:#0f172a; color:#e2e8f0; border-color:#0f172a }
  .ok  { color:#15803d; font-weight:700 }
  .bad { color:#b91c1c; font-weight:700 }
  .ms  { color:#94a3b8; font-weight:400; text-transform:none; letter-spacing:0 }
  .note, .foot { font:12px/1.5 system-ui,sans-serif; color:#64748b; margin:8px 0 0 }
`

// ─── collect the work ────────────────────────────────────────────────────────

const byCase = exchangesByCase(REPORTS)
console.log(`recorded exchanges found for ${byCase.size} case(s)`)

const jobs = []       // { html, out, bug, caseId }
const noEvidence = []
const bodyEdits = []  // { file, next }

for (const app of APPS) {
  const root = path.join(REPO, 'data', app, 'bugs')
  if (!fs.existsSync(root)) continue

  for (const feature of fs.readdirSync(root)) {
    const dir = path.join(root, feature)
    if (!fs.statSync(dir).isDirectory()) continue

    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.md') || entry === '_template.md') continue
      const file = path.join(dir, entry)
      const slug = entry.replace(/\.md$/, '')
      if (ONLY && !slug.includes(ONLY)) continue
      let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')

      const covers = [...(text.match(/\*\*Covers test cases?:\*\*[^\n]*/g) ?? []).join(' ')
        .matchAll(CASE_ID)].map((m) => m[1])
      if (!covers.length) continue

      const withEvidence = covers.filter((id) => byCase.has(id))
      if (!withEvidence.length) { noEvidence.push(`${feature}/${slug.slice(0, 46)}`); continue }

      const shown = withEvidence.slice(0, MAX_PER_BUG)
      const adir = path.join(dir, `${slug}-attachments`)
      const names = []

      shown.forEach((id, i) => {
        const html = exchangeHtml(id, byCase.get(id))
        if (!html) return
        // Numbered in reproduction order, which bug-format.md asks for.
        const name = `${i + 1}-exchange-${id.toLowerCase()}.jpg`
        names.push(name)
        jobs.push({ html, out: path.join(adir, name), bug: `${feature}/${slug}`, caseId: id })
      })
      if (!names.length) { noEvidence.push(`${feature}/${slug.slice(0, 46)}`); continue }

      /**
       * Remove the inline block and leave one short pointer in Notes.
       *
       * The section ran to 10,000 characters on some bugs — the defect was three sentences and
       * the rest was an EPCIS document. The attachment carries that now.
       */
      const inlineAt = text.indexOf('---\n**Request / Response (for debugging):**')
      if (inlineAt !== -1) {
        const after = text.indexOf('\n---\n', inlineAt + 10)
        text = text.slice(0, inlineAt) + (after === -1 ? '' : text.slice(after + 1))
      }

      const omitted = withEvidence.slice(MAX_PER_BUG)
      const pointer = `${NOTES_MARK} ${names.map((n) => `\`${n}\``).join(', ')} — the exact ` +
        'request, the response, and the platform\'s verdict from `MsgStatusQuery`. ' +
        `Replayable copies (\`api-log.html\`, \`api-postman-collection.json\`) are written beside ` +
        `each run under \`automation-hub/projects/<project>/runs/\`.` +
        (omitted.length
          ? ` The same shape repeats for ${omitted.map((id) => `\`${id}\``).join(', ')}.`
          : '')

      /**
       * The pointer goes in the attachments folder, NOT into the body.
       *
       * bug-format.md is explicit that the template ends at Bug Type and there is no Notes
       * section — a reader should reach the defect without scrolling past housekeeping. This
       * script used to append one anyway, which made every bug it touched fail
       * scripts/eptts-validate-bugs.js on two counts ("has a Notes section" and a --- rule with
       * no blank line around it). `<slug>-attachments/analysis.md` is where the existing bugs
       * already keep this, so it goes there and the body is left alone.
       */
      const analysisPath = path.join(adir, 'analysis.md')
      const analysis =
        `# Evidence for ${slug}\n\n`
        + 'Kept beside the bug rather than in its body: bug-format.md ends the template at Bug\n'
        + 'Type. Not an attachment the platform indexes (only images and video are).\n\n'
        + `${pointer}\n`

      // Strip any Notes section a previous version of this script appended, so re-running
      // repairs those bugs instead of leaving the violation in place.
      const staleNotes = text.indexOf('---\n**Notes:**')
      if (staleNotes !== -1) text = text.slice(0, staleNotes)

      text = text.replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '') + '\n'
      bodyEdits.push({
        file, next: text, label: `${feature}/${slug.slice(0, 46)}`, names, analysisPath, analysis,
      })
    }
  }
}

for (const e of bodyEdits) {
  console.log(`  ${WRITE ? 'simplified' : 'would simplify'} ${e.label} -> ${e.names.length} attachment(s)`)
}
console.log(`\n${bodyEdits.length} bug(s) ${WRITE ? 'updated' : 'to update'}, ${jobs.length} image(s) to render`)
if (noEvidence.length) {
  console.log(`\nno recorded exchange for ${noEvidence.length} bug(s):`)
  for (const n of noEvidence) console.log(`   ${n}`)
}
if (!WRITE) { console.log('\n(dry run — nothing written)'); process.exit(0) }

// ─── render the images ───────────────────────────────────────────────────────

const spec = path.join(REPO, 'automation-hub', 'projects', 'zz-render-evidence')
fs.mkdirSync(spec, { recursive: true })
fs.writeFileSync(path.join(spec, 'meta.json'),
  JSON.stringify({ name: 'zz-render-evidence', app: 'eptts-web', engine: 'playwright' }, null, 2))
fs.writeFileSync(path.join(spec, 'jobs.json'), JSON.stringify({ css: PAGE_CSS, jobs }, null, 2))
fs.writeFileSync(path.join(spec, 'test.spec.ts'), `
import { test } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// Renders each recorded exchange to a .jpg attachment. No navigation, no login — setContent
// only, so it needs nothing from the platform and cannot touch it.
test('render exchange evidence', async ({ page }) => {
  test.slow()
  const { css, jobs } = JSON.parse(fs.readFileSync(path.join(__dirname, 'jobs.json'), 'utf8'))
  await page.setViewportSize({ width: 1140, height: 900 })
  for (const job of jobs) {
    await page.setContent('<style>' + css + '</style>' + job.html)
    fs.mkdirSync(path.dirname(job.out), { recursive: true })
    await page.locator('.wrap').screenshot({ path: job.out, type: 'jpeg', quality: 95 })
    console.log('rendered ' + job.out)
  }
})
`)

const res = spawnSync('npx', ['playwright', 'test', 'projects/zz-render-evidence/test.spec.ts',
  '--config=playwright.config.ts', '--project=chromium', '--workers=1', '--retries=0', '--reporter=line'],
{ cwd: path.join(REPO, 'automation-hub'), encoding: 'utf8', shell: true })
console.log(res.stdout?.split('\n').filter((l) => /rendered|passed|failed|Error/.test(l)).join('\n'))
fs.rmSync(spec, { recursive: true, force: true })

const missing = jobs.filter((j) => !fs.existsSync(j.out))
if (missing.length) {
  console.error(`\n${missing.length} image(s) were NOT rendered — bodies left untouched so the ` +
    'bug never points at an attachment that does not exist:')
  for (const m of missing) console.error(`   ${m.out}`)
  process.exit(1)
}

for (const e of bodyEdits) {
  fs.writeFileSync(e.file, e.next)
  // The evidence pointer lives beside the attachments, never in the body — see bug-format.md.
  fs.mkdirSync(path.dirname(e.analysisPath), { recursive: true })
  fs.writeFileSync(e.analysisPath, e.analysis)
}
console.log(`\n${jobs.length} image(s) rendered, ${bodyEdits.length} bug body(ies) simplified`)
