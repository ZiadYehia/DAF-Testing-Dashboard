#!/usr/bin/env node
/**
 * Turn a Playwright JSON report from the API suite into execution status + notes.
 *
 * Usage:
 *   node scripts/eptts-record-run.js <report.json> --app eptts-api            # dry run
 *   node scripts/eptts-record-run.js <report.json> --app eptts-web --write
 *   node scripts/eptts-record-run.js <report.json> --app eptts-api --environment "ngrok relay" --write
 *
 * Works for either app: the API suite and the dashboard specs produce the same Playwright
 * report shape, and both link a test title back to a case id the same way. `--app` is
 * required rather than inferred — recording one app's results against another's features
 * would silently write nothing and report success.
 *
 * WHY THIS IS NOT A ONE-LINER
 *
 * Playwright's notion of pass/fail is not the same as ours, in two places:
 *
 *   1. A case marked `test.fail()` — a KNOWN PLATFORM GAP — is reported `expected` when it
 *      fails. Playwright is saying "the harness behaved as declared". Our status must still
 *      be `fail`, because the platform is genuinely wrong. Reporting those green would hide
 *      every defect we already know about.
 *   2. The inverse matters more: a `test.fail()` case that PASSES is Playwright-`unexpected`,
 *      and it means the gap got fixed. That is good news, and it must be surfaced as
 *      "remove the marker", not filed as a failure.
 *
 * `test.fixme()` (blocked on data or a missing tenant) maps to `blocked` — never `pass`,
 * never `fail`. It was not executed and pretending otherwise is the failure mode this whole
 * exercise exists to avoid.
 *
 * Notes carry ONLY the issue found. No execution ids, no run timestamps, no artifact paths —
 * the reader wants to know what is broken.
 */
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
function argValue(flag) {
  const i = process.argv.indexOf(flag)
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1]
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`))
  return inline ? inline.slice(flag.length + 1) : null
}

const APP = argValue('--app')
/**
 * Which environment these results were observed on, e.g. "ngrok relay". Must match the
 * environment's name in the app exactly.
 *
 * Execution status is scoped per environment (see src/lib/execution.ts), so without this a
 * suite run against a relay tunnel would overwrite the production status of every case it
 * touched — different servers, different tenants, genuinely different outcomes. Omitted means
 * the no-environment bucket, which is where every result recorded before environments lives.
 */
const ENVIRONMENT = argValue('--environment')

/** Filename-safe environment name, matching src/lib/execution.ts's environmentSlug. */
const envSuffix = ENVIRONMENT
  ? `--${ENVIRONMENT.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'env'}`
  : ''
if (!APP) {
  console.error('required: --app <eptts-api|eptts-web>')
  process.exit(1)
}
const FEATURES = path.join(REPO, 'data', APP, 'features')
const WRITE = process.argv.includes('--write')
// slice(3) skips the node/script argv and the --app value, which is also non-flag-shaped.
const positional = process.argv.slice(2).filter(
  (a, i, all) => !a.startsWith('--') && all[i - 1] !== '--app' && all[i - 1] !== '--environment',
)
const reportPath = positional[0]

if (!reportPath || !fs.existsSync(reportPath)) {
  console.error('usage: node scripts/eptts-record-run.js <report.json> --app <slug> [--write]')
  process.exit(1)
}

// ─── collect every test result out of the nested suite tree ──────────────────

function flatten(report) {
  const out = []
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        // Take the LAST result — with retries enabled that is the outcome that stands.
        const r = t.results?.[t.results.length - 1] ?? {}
        out.push({
          title: spec.title,
          // `t.status` is Playwright's verdict (expected/unexpected/flaky/skipped);
          // `r.status` is what actually happened (passed/failed/timedOut/skipped).
          verdict: t.status,
          ran: r.status,
          annotations: t.annotations ?? [],
          error: r.error?.message ?? r.errors?.[0]?.message ?? null,
        })
      }
    }
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const s of report.suites ?? []) walk(s)
  return out
}

/**
 * Did this test fail because the PLATFORM was unreachable, rather than because the
 * behaviour under test was wrong?
 *
 * This matters more than it looks. During the first full run the host returned 5xx for
 * roughly two minutes and took out 94 tests in one burst. Recording those as `fail` would
 * have invented ~80 defects that do not exist and buried the ~29 real ones. So an
 * infrastructure failure is never recorded as a result — it is reported as "not executed"
 * and the case must be re-run.
 *
 * Deliberately conservative: a 5xx, a connection error, or a failure to authenticate at all
 * says nothing about the endpoint under test. Note that 502/503/504 are matched, but NOT
 * 500 — a genuine unhandled server error on a specific request IS a defect worth reporting,
 * whereas a gateway refusing every request is not.
 */
function isInfrastructureFailure(error) {
  if (!error) return false
  return (
    /\b(50[234])\b|Bad Gateway|Service Unavailable|Gateway Time-?out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|connect Timeout|auth failed for role/i
      .test(error)
    // A request that never came back is the platform being unreachable or wedged, not a
    // defect in the thing under test. Missing this meant a storage outage on SendEPCIS —
    // which the platform reports as 503 E003 "durable object storage not confirmed" — was
    // recorded as a genuine failure for every case that touched the write path, because our
    // own timeout fired first and all we kept was "Timeout 45000ms exceeded".
    || /apiRequestContext\.\w+: Timeout \d+ms exceeded|durable object storage not confirmed|temporarily unavailable/i
      .test(error)
  )
}

/**
 * A failure caused by the TENANT not having suitable test data, rather than by the platform
 * misbehaving. `blocked`, not `fail` — the case was never really exercised.
 *
 * Two shapes, both seen on the ngrok relay:
 *   - our own guard saying the environment has no GTIN of the required kind;
 *   - the platform correctly refusing to dispense a Dawana-integrated product through this
 *     channel. That refusal is right; it just means the tenant has no product that can
 *     exercise dispensing here. Every one of its seven products is Dawana-integrated, so
 *     recording 50-odd cases as defects would invent failures the platform did not have.
 */
function isUnsupportedOnThisTenant(error) {
  if (!error) return false
  return /no (?:commissionable|dispensable|partial-dispense) GTIN is configured for this environment/i.test(error)
    || /Dispensing is not allowed for Dawana-integrated products|must be dispensed through the Dawana integration/i.test(error)
}

/** Reduce a Playwright error blob to the sentence that says what is wrong. */
function issueOf(error) {
  if (!error) return 'Failed without an error message — see the run artifacts.'
  const clean = error
    .replace(/\[[0-9;]*m/g, '')   // strip the reporter's ANSI colour codes
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // Our assertions carry the diagnosis in their message, which Playwright prints first.
  // Everything after it is expect()'s own received/expected boilerplate and a stack.
  const stop = clean.findIndex((l) =>
    /^(expect\(|Expected:|Received:|at |Call log|- Expect|Error: expect)/.test(l))
  const head = (stop === -1 ? clean : clean.slice(0, stop)).join(' ')
  return head.replace(/^Error:\s*/, '').slice(0, 900) || clean[0].slice(0, 900)
}

const results = flatten(JSON.parse(fs.readFileSync(reportPath, 'utf8')))

// ─── map case id -> feature, from the authored tables ────────────────────────

const featureOf = new Map()
for (const dir of fs.readdirSync(FEATURES)) {
  // Every feature dir, not just api-*: this recorder serves both apps now, and an app
  // filter here would silently map nothing and still report success.
  const p = path.join(FEATURES, dir, `${dir}-testcases.md`)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line.startsWith('| EPTTS_')) continue
    const id = line.split('|')[2].trim()
    if (id) featureOf.set(id, dir)
  }
}

// ─── classify ────────────────────────────────────────────────────────────────

const byFeature = new Map()   // feature -> { status: {}, notes: {} }
const tally = { pass: 0, fail: 0, blocked: 0 }
const fixed = []
const unknown = []
const infra = []      // cases whose result we refuse to record — must be re-run
const unsupported = [] // cases this tenant has no data for — recorded blocked, with the reason

for (const r of results) {
  const id = r.title.split('—')[0].trim()
  const feature = featureOf.get(id)
  if (!feature) { unknown.push(r.title); continue }
  if (!byFeature.has(feature)) byFeature.set(feature, { status: {}, notes: {} })
  const f = byFeature.get(feature)

  const fixme = r.annotations.find((a) => a.type === 'fixme')
  const expectFail = r.annotations.find((a) => a.type === 'fail')

  // Checked before anything else: an unreachable platform is not a verdict on the endpoint.
  // Leave whatever status the case already had and list it for a re-run.
  if (r.ran === 'failed' && isInfrastructureFailure(r.error)) {
    infra.push(id)
    continue
  }

  // Missing test data is not a defect either, but unlike an outage it will not fix itself on
  // a re-run, so it is recorded as blocked with the reason rather than held back silently.
  if (r.ran === 'failed' && isUnsupportedOnThisTenant(r.error)) {
    f.status[id] = 'blocked'
    f.notes[id] = issueOf(r.error)
    tally.blocked++
    unsupported.push(id)
    continue
  }

  if (fixme || r.ran === 'skipped') {
    f.status[id] = 'blocked'
    f.notes[id] = fixme?.description ?? 'Skipped — not executed in this run.'
    tally.blocked++
  } else if (expectFail) {
    if (r.ran === 'passed') {
      // The known gap is gone. Say so loudly — a stale expected-failure marker is how a
      // regression gets to hide later.
      f.status[id] = 'pass'
      f.notes[id] =
        'Previously a known platform gap; the platform now behaves correctly. ' +
        'Remove the expected-failure marker for this case in automation-hub/lib/eptts-cases/.'
      tally.pass++
      fixed.push(id)
    } else {
      f.status[id] = 'fail'
      f.notes[id] = expectFail.description ?? issueOf(r.error)
      tally.fail++
    }
  } else if (r.ran === 'passed') {
    f.status[id] = 'pass'
    delete f.notes[id]
    tally.pass++
  } else {
    f.status[id] = 'fail'
    f.notes[id] = issueOf(r.error)
    tally.fail++
  }
}

// ─── merge into the existing files ───────────────────────────────────────────

const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))
let touched = 0

for (const [feature, { status, notes }] of [...byFeature].sort()) {
  const dir = path.join(FEATURES, feature)
  const sPath = path.join(dir, `execution-status-v1${envSuffix}.json`)
  const nPath = path.join(dir, `execution-notes-v1${envSuffix}.json`)

  const existingStatus = fs.existsSync(sPath) ? JSON.parse(fs.readFileSync(sPath, 'utf8')) : {}
  const existingNotes = fs.existsSync(nPath) ? JSON.parse(fs.readFileSync(nPath, 'utf8')) : {}

  const nextStatus = { ...existingStatus, ...status }
  const nextNotes = { ...existingNotes }
  for (const [id, note] of Object.entries(notes)) nextNotes[id] = note
  // A case that now passes must not keep a stale failure note.
  for (const [id, st] of Object.entries(status)) {
    if (st === 'pass' && !notes[id]) delete nextNotes[id]
  }

  const counts = Object.values(status).reduce((a, s) => ((a[s] = (a[s] ?? 0) + 1), a), {})
  console.log(
    `  ${feature.padEnd(24)} ${String(Object.keys(status).length).padStart(3)} recorded  ` +
    Object.entries(counts).map(([k, v]) => `${v} ${k}`).join('  '))

  if (WRITE) {
    // Keep key order sorted so diffs stay readable across runs.
    fs.writeFileSync(sPath, JSON.stringify(sortObj(nextStatus), null, 2) + '\n')
    if (Object.keys(nextNotes).length) {
      fs.writeFileSync(nPath, JSON.stringify(sortObj(nextNotes), null, 2) + '\n')
    }
    touched++
  }
}

console.log(`\ntotal recorded: ${tally.pass} pass  ${tally.fail} fail  ${tally.blocked} blocked`)
if (infra.length) {
  console.log(
    `\nNOT RECORDED — ${infra.length} case(s) failed because the platform was unreachable ` +
    `(5xx / connection / auth), which is not a verdict on the endpoint. Re-run these:`)
  console.log(`   ${infra.join(' ')}`)
  // Written where a re-run can consume it directly rather than being retyped.
  const listPath = path.join(REPO, 'automation-hub', `rerun-cases-${APP}.txt`)
  if (WRITE) {
    fs.writeFileSync(listPath, infra.join('\n') + '\n')
    console.log(`\n   list written to ${path.relative(REPO, listPath)}`)
  }
}
if (unsupported.length) {
  console.log(
    `\nBLOCKED, not failed — ${unsupported.length} case(s) need test data this tenant does not ` +
    'have (no product of the required kind, or dispensing refused as Dawana-integrated):')
  console.log(`   ${unsupported.join(' ')}`)
}
if (fixed.length) console.log(`\nknown gaps that now PASS (remove the markers): ${fixed.join(', ')}`)
if (unknown.length) {
  console.log(`\nresults with no matching test case (${unknown.length}) — the multi-test ` +
    'journey specs, which are expected here:')
  for (const t of unknown.slice(0, 12)) console.log(`   ${t}`)
}
console.log(WRITE ? `\nwrote ${touched} feature(s)` : '\n(dry run — pass --write)')
