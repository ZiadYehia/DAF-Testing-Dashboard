#!/usr/bin/env node
/**
 * Write Hub run history from a bulk Playwright report.
 *
 * Usage:
 *   node scripts/eptts-record-hub-runs.js <report.json> [more.json ...] --app eptts-api
 *   node scripts/eptts-record-hub-runs.js <report.json> ... --app eptts-api --write
 *
 * WHY THIS IS NEEDED
 *
 * `recordRun()` lives in automation-hub/engine/runner.ts and only fires when a run goes
 * through the Hub's own runner. A bulk `npx playwright test --shard=...` — which is how the
 * 417-case suite has to be run, because one process outlives the command timeout — writes
 * nothing to any project's meta.json.
 *
 * The result is a split brain that looks like data loss: the test CASES showed 297 pass while
 * 184 Hub projects still said `never_run` with an empty run history, and 64 more had a
 * `lastStatus` contradicting the case status recorded from the same run. Nothing in either
 * view hints that the other exists, so the Hub simply looked like it had never seen the suite.
 *
 * This closes that gap, and deliberately mirrors runner.ts rather than inventing its own
 * rules:
 *
 *   - the status uses the SAME known-gap rule: a case marked `expectFail` genuinely fails and
 *     Playwright calls that "expected", so exit code alone would paint it green. A known gap
 *     is recorded as `fail`, because the platform is still wrong.
 *   - artifacts are LIFTED from the report's own attachments into runs/<ts>/, so the Hub's
 *     "api-log" link opens the real request/response viewer for that run.
 *   - hasVideo / hasTrace / hasApiLog are set from files that actually exist, never guessed.
 *
 * It does not fabricate a run for a case the report does not contain: a project the suite
 * never selected keeps whatever history it had.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const HUB = path.join(REPO, 'automation-hub', 'projects')
/** engine/store.ts keeps the newest N runs; match it so the Hub prunes consistently. */
const MAX_RUN_HISTORY = 20

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`))
  return inline ? inline.slice(flag.length + 1) : null
}

const APP = argValue('--app')
const WRITE = process.argv.includes('--write')
const REPORTS = process.argv.slice(2)
  .filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--app')

if (!APP || !REPORTS.length || REPORTS.some((r) => !fs.existsSync(r))) {
  console.error('usage: node scripts/eptts-record-hub-runs.js <report.json> [...] --app <slug> [--write]')
  process.exit(1)
}

/** case id -> project name, from each project's linkedTestcase. */
function projectsByCase(app) {
  const map = new Map()
  for (const dir of fs.readdirSync(HUB)) {
    const mp = path.join(HUB, dir, 'meta.json')
    if (!fs.existsSync(mp)) continue
    let meta
    try { meta = JSON.parse(fs.readFileSync(mp, 'utf8')) } catch { continue }
    if (meta.app !== app) continue
    const id = meta.linkedTestcase?.testcaseId ?? meta.linkedTestcaseId
    if (id && !map.has(id)) map.set(id, dir)
  }
  return map
}

/** Playwright's ISO timestamp -> the filesystem-safe form store.ts uses for run folders. */
const safeTs = (iso) => iso.replace(/[:.]/g, '-')

const byCase = projectsByCase(APP)
const results = new Map()   // caseId -> { status, durationMs, error, startTime, attachments }

for (const reportPath of REPORTS) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      // TC_COMM_001, TS_PACK_001, WEB_SHP_001 — matching only TC/TS silently found nothing at
      // all for eptts-web, whose ids are WEB_-prefixed, and reported "0 case result(s)" as if
      // the reports were empty.
      const id = (spec.title.match(/\b[A-Z]{2,5}_[A-Z]{2,6}_\d{1,4}\b/) ?? [])[0]
      if (!id) continue
      for (const t of spec.tests ?? []) {
        const res = t.results?.[t.results.length - 1]
        if (!res) continue

        // Same rule as engine/runner.ts: a declared known gap is a FAIL, not a pass.
        const knownGap = res.status === 'failed' && t.expectedStatus === 'failed'
        const status = res.status === 'skipped'
          ? 'skipped'
          : (res.status === 'passed' && !knownGap ? 'pass' : 'fail')

        results.set(id, {
          status,
          durationMs: res.duration ?? 0,
          error: (res.errors?.[0]?.message ?? res.error?.message ?? '')
            .replace(/\[[0-9;]*m/g, '').split('\n')[0] || undefined,
          startTime: res.startTime ?? report.stats?.startTime ?? new Date(0).toISOString(),
          attachments: res.attachments ?? [],
        })
      }
    }
    for (const child of suite.suites ?? []) visit(child)
  }
  for (const suite of report.suites ?? []) visit(suite)
}

console.log(`${results.size} case result(s) across ${REPORTS.length} report(s); ` +
  `${byCase.size} ${APP} project(s) carry a linked case`)

let recorded = 0
let skippedRuns = 0
let unlinked = 0
const tally = {}

for (const [caseId, r] of results) {
  const project = byCase.get(caseId)
  if (!project) { unlinked++; continue }

  // A skipped test never ran; recording a run for it would claim otherwise.
  if (r.status === 'skipped') { skippedRuns++; continue }

  const ts = safeTs(r.startTime)
  const dir = path.join(HUB, project, 'runs', ts)

  /**
   * Lift the artifacts this run actually produced.
   *
   * Browser projects attach a video and a trace; API projects attach the request/response
   * viewer. Both are handled so this works for eptts-web as well as eptts-api — the dashboard
   * specs are run the same bulk way and had all 350 of their projects sitting at never_run.
   */
  const lifted = []
  for (const att of r.attachments) {
    if (!att.path || !fs.existsSync(att.path)) continue
    const name = att.name === 'video' ? 'video.webm'
      : att.name === 'trace' ? 'trace.zip'
        : att.name
    if (!/^(api-log\.html|api-exchanges\.json|api-postman-collection\.json|video\.webm|trace\.zip)$/.test(name)) continue
    lifted.push({ name, from: att.path })
  }

  // Set from files that exist, never guessed: a flag claiming a video the Hub then cannot
  // open is worse than no flag.
  const record = {
    ts,
    status: r.status,
    durationMs: r.durationMs,
    hasVideo: lifted.some((l) => l.name === 'video.webm'),
    hasTrace: lifted.some((l) => l.name === 'trace.zip'),
    hasApiLog: lifted.some((l) => l.name === 'api-log.html'),
    ...(r.error ? { error: r.error } : {}),
  }

  if (WRITE) {
    fs.mkdirSync(dir, { recursive: true })
    for (const l of lifted) fs.copyFileSync(l.from, path.join(dir, l.name))

    const mp = path.join(HUB, project, 'meta.json')
    const meta = JSON.parse(fs.readFileSync(mp, 'utf8'))
    // Newest first, de-duplicated on ts so a re-run of this tool is idempotent.
    const runs = [record, ...(meta.runs ?? []).filter((x) => x.ts !== ts)].slice(0, MAX_RUN_HISTORY)
    fs.writeFileSync(mp, `${JSON.stringify({ ...meta, lastStatus: record.status, runs }, null, 2)}\n`)

    // Drop run folders meta no longer references, exactly as store.ts's recordRun does.
    const keep = new Set(runs.map((x) => x.ts))
    const runsRoot = path.join(HUB, project, 'runs')
    for (const e of fs.readdirSync(runsRoot, { withFileTypes: true })) {
      if (e.isDirectory() && !keep.has(e.name)) {
        fs.rmSync(path.join(runsRoot, e.name), { recursive: true, force: true })
      }
    }
  }

  recorded++
  tally[record.status] = (tally[record.status] ?? 0) + 1
}

console.log(`\n${WRITE ? 'recorded' : 'would record'} ${recorded} run(s): ${JSON.stringify(tally)}`)
if (unlinked) console.log(`${unlinked} result(s) with no matching project (journeys/smoke specs)`)

/**
 * A blocked case must not sit in the Hub showing green.
 *
 * `RunStatus` is 'pass' | 'fail' | 'never_run' — the Hub cannot express "blocked", so a
 * skipped test cannot be recorded as a run at all. That left 33 projects whose case is now
 * blocked still displaying a `pass` from before the skip marker existed: the single most
 * misleading state possible, since someone checking whether a case runs sees a green tick.
 *
 * `never_run` is the truthful value available — the spec did not execute. The historical runs
 * are KEPT, because they really did happen; only the headline status is corrected.
 *
 * If the Hub should show these as blocked rather than never-run, that needs 'blocked' added to
 * RunStatus plus a badge for it in the UI. That is a product change, so it is not done here.
 */
let deGreened = 0
for (const [caseId, r] of results) {
  if (r.status !== 'skipped') continue
  const project = byCase.get(caseId)
  if (!project) continue
  const mp = path.join(HUB, project, 'meta.json')
  if (!fs.existsSync(mp)) continue
  const meta = JSON.parse(fs.readFileSync(mp, 'utf8'))
  if (meta.lastStatus === 'never_run') continue
  deGreened++
  if (WRITE) {
    fs.writeFileSync(mp, `${JSON.stringify({ ...meta, lastStatus: 'never_run' }, null, 2)}\n`)
  }
}
if (skippedRuns) {
  console.log(`${skippedRuns} blocked case(s): no run recorded (a skip is not a run), and ` +
    `${deGreened} ${WRITE ? 'had' : 'would have'} a stale pass/fail cleared to never_run`)
}
if (!WRITE) console.log('\n(dry run — nothing written)')
