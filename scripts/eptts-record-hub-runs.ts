/**
 * Record a CLI Playwright run into the Automation Hub's per-project run history.
 *
 * WHY THIS EXISTS. `scripts/eptts-record-run.js` pushes a run's verdicts into the dashboard's
 * execution status. It does NOT touch `automation-hub/projects/<name>/meta.json`, because the
 * Hub's history is normally written by the run route when a user clicks Replay. So a suite run
 * driven from the command line updated the dashboard and left every project's run history
 * showing the previous run — the two halves of the same screen disagreeing about the same case.
 *
 * This closes that gap using the real report: status, duration and first error come from
 * Playwright's JSON, and the api-log.html / api-exchanges.json / api-postman-collection.json
 * attachments are copied into runs/<ts>/ under the names the Hub looks for, so a recorded run
 * carries the same request/response evidence a Replay would.
 *
 * It calls store.ts's own `recordRun`, deliberately, rather than editing meta.json here — that
 * function owns per-environment pruning and `lastStatusByEnv`, and a second implementation of
 * that logic would drift.
 *
 * SKIPPED CASES GET NO ENTRY. RunRecord.status is 'pass' | 'fail' only, and a skipped case did
 * not run — inventing a record for it would put a verdict on screen that nothing measured.
 *
 * Usage:
 *   npx ts-node scripts/eptts-record-hub-runs.ts <report.json> --environment "ngrok relay"
 *   npx ts-node scripts/eptts-record-hub-runs.ts <report.json> --environment "ngrok relay" --write
 */
import fs from 'fs/promises'
import path from 'path'
import { PROJECTS_DIR, runDir, readMeta, writeMeta, recordRun } from '../automation-hub/store'

const argv = process.argv.slice(2)
const WRITE = argv.includes('--write')
const reportPath = argv.find((a) => !a.startsWith('--'))
function argValue(flag: string): string | null {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null
}
const ENVIRONMENT = argValue('--environment')

if (!reportPath) {
  console.error('required: <report.json>  [--environment "<name>"]  [--write]')
  process.exit(1)
}

const ANSI = /\u001b\[[0-9;]*m/g

interface Spec {
  title: string
  tests?: {
    status?: string
    results?: {
      status?: string
      duration?: number
      startTime?: string
      error?: { message?: string }
      attachments?: { name: string; path?: string }[]
    }[]
  }[]
}

/** Playwright's filesystem-safe run-folder timestamp, matching engine/runner.ts. */
function tsFolder(iso: string): string {
  return new Date(iso).toISOString().replace(/[:.]/g, '-')
}

async function main() {
  const report = JSON.parse(await fs.readFile(reportPath!, 'utf8'))
  const specs: Spec[] = []
  const walk = (s: { specs?: Spec[]; suites?: unknown[] }) => {
    for (const sp of s.specs ?? []) specs.push(sp)
    for (const c of (s.suites ?? []) as { specs?: Spec[]; suites?: unknown[] }[]) walk(c)
  }
  for (const s of (report.suites ?? []) as { specs?: Spec[]; suites?: unknown[] }[]) walk(s)

  // caseId -> project folder. Suffix-matched so tc_disp_001 never collides with tc_pdisp_001.
  const dirs = (await fs.readdir(PROJECTS_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory()).map((d) => d.name)

  let recorded = 0, skipped = 0, noProject = 0, withEvidence = 0, replaced = 0
  const missing: string[] = []

  for (const sp of specs) {
    const caseId = (sp.title.match(/^(T[CS]_[A-Z]+_\d+)/) ?? [])[1]
    if (!caseId) continue
    const t = sp.tests?.[0]
    if (!t || t.status === 'skipped') { skipped++; continue }

    const suffix = `-${caseId.toLowerCase()}`
    const matches = dirs.filter((d) => d.endsWith(suffix))
    if (matches.length !== 1) { noProject++; missing.push(`${caseId} (${matches.length} matches)`); continue }
    const name = matches[0]
    if (!(await readMeta(name))) { noProject++; missing.push(`${caseId} (no meta.json)`); continue }

    const r = t.results?.[0] ?? {}
    /**
     * Read the RAW result status, never `test.status`.
     *
     * `test.status` is Playwright's verdict about its own declaration, so for a case marked
     * `test.fail()` — a known platform gap — it INVERTS: 'expected' means the case failed as
     * declared (the gap is still there) and 'unexpected' means it passed (the gap is gone).
     * Mapping 'expected' to pass therefore reported the three destruction gap cases backwards
     * against the dashboard, which reads the raw outcome via eptts-record-run.js. `result.status`
     * says what actually happened and needs no annotation handling.
     */
    const ran = r.status
    const status: 'pass' | 'fail' = ran === 'passed' ? 'pass' : 'fail'
    const durationMs = r.duration ?? 0
    const error = r.error?.message ? r.error.message.replace(ANSI, '').split('\n')[0].trim() : undefined
    const ts = tsFolder(r.startTime ?? new Date().toISOString())

    // Copy the API evidence under the canonical names engine/runner.ts uses.
    const wanted = ['api-log.html', 'api-exchanges.json', 'api-postman-collection.json']
    const present = (r.attachments ?? []).filter((a) => wanted.includes(a.name) && a.path)
    let hasApiLog = false

    if (WRITE) {
      const dir = runDir(name, ts)
      await fs.mkdir(dir, { recursive: true })
      for (const a of present) {
        try {
          await fs.copyFile(a.path!, path.join(dir, a.name))
          if (a.name === 'api-log.html') hasApiLog = true
        } catch { /* artifact pruned since the run — record the verdict without it */ }
      }
      await fs.writeFile(
        path.join(dir, 'result.json'),
        JSON.stringify({ status, durationMs, error, hasVideo: false, hasTrace: false, hasApiLog,
          executed: true, source: 'cli', environment: ENVIRONMENT ?? null }, null, 2),
        'utf8',
      )
      // Idempotent: re-running this script must not double up history. A record for this
      // exact ts is dropped first, then recordRun re-adds it — so its per-environment pruning
      // and lastStatusByEnv recompute stay the single implementation of that logic.
      const existing = await readMeta(name)
      if (existing?.runs?.some((x) => x.ts === ts)) {
        await writeMeta({ ...existing, runs: existing.runs.filter((x) => x.ts !== ts) })
        replaced++
      }
      await recordRun(name, {
        ts, status, durationMs, hasVideo: false, hasTrace: false, hasApiLog,
        ...(error ? { error } : {}),
        ...(ENVIRONMENT ? { environment: ENVIRONMENT } : {}),
      })
    } else {
      hasApiLog = present.some((a) => a.name === 'api-log.html')
    }

    if (hasApiLog) withEvidence++
    recorded++
  }

  console.log(`environment: ${ENVIRONMENT ?? '(none)'}`)
  console.log(`run records ${WRITE ? 'written' : 'to write'}: ${recorded}   with api-log evidence: ${withEvidence}`)
  if (replaced) console.log(`replaced an earlier record for the same run: ${replaced}`)
  console.log(`skipped (no run to record): ${skipped}`)
  if (noProject) console.log(`no Hub project: ${noProject} -> ${missing.slice(0, 8).join(', ')}`)
  if (!WRITE) console.log('\n(dry run — pass --write)')
}

main().catch((e) => { console.error(e); process.exit(1) })
