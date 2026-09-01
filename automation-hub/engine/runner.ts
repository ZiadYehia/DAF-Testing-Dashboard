/**
 * Automation Hub — replay engine.
 *
 * Reruns a project's saved spec via the Playwright Test runner in a child process.
 * No AI is involved in replay (that's authoring's job) — this is deterministic and free.
 *
 * For each run we:
 *   1. spawn `playwright test <spec> --output <raw>` with video+trace on
 *   2. parse the JSON reporter for pass/fail + duration
 *   3. copy video.webm / trace.zip out of the raw output into runs/<ts>/
 *   4. record the run in meta.json and prune history to MAX_RUN_HISTORY
 */
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import {
  HUB_ROOT, runDir, recordRun, readMeta, specFileName,
} from '../store'
import type { RunResult } from '../types'
import { playwrightProjectFor } from '../types'

const CONFIG = path.join(HUB_ROOT, 'playwright.config.ts')

/**
 * The login-bootstrap project in playwright.config.ts. Its test always passes,
 * so it must be excluded when deciding whether a replay actually executed
 * anything (see parseReport).
 */
const SETUP_PROJECT = 'setup'

/**
 * Hard wall-clock cap on a replay child process. Playwright's own test timeout
 * (60s) covers a slow test; this covers a hung runner/browser that never reports —
 * without it one stuck child blocks the project (and a regression run) forever.
 */
const RUN_TIMEOUT_MS = Number(process.env.AUTOMATION_RUN_TIMEOUT_MS ?? 5 * 60_000)

/** In-process lock: one replay at a time per project. */
const running = new Set<string>()

/** Make an ISO timestamp filesystem-safe (no ":" / "."). */
function safeTs(iso: string): string {
  return iso.replace(/[:.]/g, '-')
}

/** Recursively find the first file matching a predicate under `dir`. */
async function findFile(dir: string, match: (f: string) => boolean): Promise<string | null> {
  let entries: import('fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      const hit = await findFile(full, match)
      if (hit) return hit
    } else if (match(e.name)) {
      return full
    }
  }
  return null
}

/**
 * Parse the playwright JSON reporter output; tolerant of extra log noise.
 *
 * `executed` is false only when every test of the SPEC ran skipped (e.g. a
 * `test.fixme`d file), which Playwright still exits 0 for — so callers can
 * avoid mirroring a bogus "pass" onto a linked test case.
 *
 * It deliberately does NOT use the reporter's top-level `stats`: those counts
 * include the `setup` project's login bootstrap, which always passes, so a
 * fully-skipped spec still reported `expected: 1` and looked executed. Walk the
 * suite tree instead and only count test results whose projectName isn't the
 * setup project. `undefined` means the report couldn't be read at all
 * (malformed/absent JSON) — callers should treat that as "assume executed" so a
 * genuine parse failure doesn't also swallow a real pass/fail.
 *
 * `knownGap` is the one that matters for reporting honestly. A case marked `expectFail`
 * becomes `test.fail(true, reason)`: the assertion genuinely fails, Playwright calls that an
 * EXPECTED failure, and the process exits 0. Judging by exit code alone therefore painted
 * every known platform gap green in the Hub -- so opening a filed bug and replaying it showed
 * a pass, which reads as "this is fixed" when nothing had changed. Detect those explicitly.
 */
function parseReport(stdout: string): {
  durationMs?: number; error?: string; executed?: boolean; knownGap?: boolean
} {
  // The JSON reporter prints one big JSON object. Find the outermost braces.
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start === -1 || end === -1) return {}
  try {
    const report = JSON.parse(stdout.slice(start, end + 1))
    const durationMs = report?.stats?.duration
    // Dig out the first error message from the suite tree, and count how many
    // non-setup tests actually ran (anything but a 'skipped' result).
    let error: string | undefined
    let ranCount = 0
    let knownGap = false
    const visit = (node: any) => {
      for (const t of node?.specs ?? []) {
        for (const test of t?.tests ?? []) {
          if (test?.projectName !== SETUP_PROJECT) {
            for (const r of test?.results ?? []) {
              if (r?.status && r.status !== 'skipped') ranCount++
              // failed + expectedStatus 'failed' == a declared known gap, exit code 0.
              if (r?.status === 'failed' && test?.expectedStatus === 'failed') knownGap = true
            }
          }
          for (const r of test?.results ?? []) {
            if (error) continue
            const msg = r?.errors?.[0]?.message ?? r?.error?.message
            if (msg) error = String(msg).split('\n')[0]
          }
        }
      }
      for (const s of node?.suites ?? []) visit(s)
    }
    for (const s of report?.suites ?? []) visit(s)
    return {
      durationMs: typeof durationMs === 'number' ? durationMs : undefined,
      error, executed: ranCount > 0, knownGap,
    }
  } catch {
    return {}
  }
}

/**
 * Environment for the Playwright child.
 *
 * Inheriting the Next dev server's entire environment made the child die instantly on
 * Windows with exit code 3221225794 (0xC0000142, STATUS_DLL_INIT_FAILED) — before
 * printing anything, so the run surfaced in the dashboard as a bare "fail" with no
 * error, no log and no video, while the very same Playwright command succeeded when run
 * from a normal shell.
 *
 * So the child gets a curated environment instead: the OS variables a process needs to
 * start, plus the variables the hub itself relies on (DATA_ROOT propagates to
 * lib/apps.ts, and the PLAYWRIGHT_ and AUTOMATION_ prefixes tune the run). It does NOT inherit
 * NODE_OPTIONS or Next/Turbopack's internal `__NEXT_PRIVATE_*` variables, which a test
 * runner has no business receiving and which are the plausible source of the failed
 * initialization.
 *
 * The app's own secrets are NOT needed here: playwright.config.ts calls loadHubEnv() to
 * read automation-hub/.env in the child itself.
 */
function childEnv(): Record<string, string> {
  const passThroughExact = [
    // Windows/OS essentials — omitting SystemRoot or PATH is itself a cause of 0xC0000142.
    'SystemRoot', 'windir', 'SystemDrive', 'COMSPEC', 'PATH', 'Path', 'PATHEXT',
    'TEMP', 'TMP', 'HOME', 'HOMEDRIVE', 'HOMEPATH', 'USERPROFILE', 'USERNAME', 'USERDOMAIN',
    'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'ProgramData', 'ProgramFiles',
    'ProgramFiles(x86)', 'ProgramW6432', 'CommonProgramFiles', 'NUMBER_OF_PROCESSORS',
    'PROCESSOR_ARCHITECTURE', 'OS', 'LANG', 'LC_ALL', 'TZ', 'DISPLAY', 'SHELL', 'TERM',
    // What the hub and its specs actually need.
    'DATA_ROOT', 'AUTOTEST_FRAMEWORK_ROOT', 'CI', 'NODE_ENV',
  ]
  const passThroughPrefixes = ['PLAYWRIGHT_', 'AUTOMATION_']

  const env: Record<string, string> = { FORCE_COLOR: '0' }
  for (const key of passThroughExact) {
    const value = process.env[key]
    if (value !== undefined) env[key] = value
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && passThroughPrefixes.some((p) => key.startsWith(p))) env[key] = value
  }
  return env
}

/**
 * Run a project's spec and archive the result.
 * @param now ISO timestamp captured by the caller (route handler).
 */
export async function runProject(name: string, now: string): Promise<RunResult> {
  if (running.has(name)) {
    throw new Error(`A run for "${name}" is already in progress`)
  }
  running.add(name)
  const startedAt = Date.now()
  try {
    const ts = safeTs(now)
    const dir = runDir(name, ts)
    const rawOut = path.join(dir, '_raw')
    await fs.mkdir(rawOut, { recursive: true })

    // Invoke Playwright's CLI directly via node (no shell) so paths containing
    // spaces — e.g. "General Testing Dashboard" — are passed safely as argv.
    // Resolve the CLI as a plain path from node_modules rather than require.resolve,
    // which Turbopack rewrites inside bundled route handlers (the rewritten path
    // points into the server bundle and the child `node` can't load it).
    const cli = path.join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js')
    // Playwright's positional filter is a regex matched against the test file path
    // RELATIVE to cwd — an absolute Windows path matches nothing. cwd is HUB_ROOT,
    // so a forward-slash relative path selects exactly this project's spec.
    const meta = await readMeta(name)
    const specFilter = `projects/${name}/${specFileName(meta?.engine)}`
    const args = [
      cli, 'test', specFilter,
      '--config', CONFIG,
      // ALWAYS pass --project. The config's `chromium` and `api` projects share a
      // testMatch, so omitting this selects both and runs the spec twice — which against
      // a write-heavy API suite would duplicate every event it submits.
      `--project=${playwrightProjectFor(meta?.engine)}`,
      '--output', rawOut,
      '--reporter=json',
    ]

    const { code, stdout, timedOut } = await new Promise<{ code: number; stdout: string; timedOut: boolean }>((resolve) => {
      const child = spawn(process.execPath, args, {
        cwd: HUB_ROOT,
        // Cast: this repo augments ProcessEnv with required keys, but a child only
        // needs the curated set childEnv() builds.
        env: childEnv() as NodeJS.ProcessEnv,
        windowsHide: true,
      })
      let out = ''
      let killed = false
      // Watchdog: a hung child (browser that never launches, runner that never
      // reports) is killed with its whole tree — plain child.kill() would orphan
      // the browser processes on Windows.
      const watchdog = setTimeout(() => {
        killed = true
        try {
          if (process.platform === 'win32' && child.pid) {
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
          } else {
            child.kill('SIGKILL')
          }
        } catch { /* already gone */ }
      }, RUN_TIMEOUT_MS)
      child.stdout.on('data', (d) => { out += d.toString() })
      child.stderr.on('data', (d) => { out += d.toString() })
      child.on('close', (c) => { clearTimeout(watchdog); resolve({ code: c ?? 1, stdout: out, timedOut: killed }) })
      child.on('error', (err) => { clearTimeout(watchdog); resolve({ code: 1, stdout: out + '\n' + String(err), timedOut: killed }) })
    })

    const parsed = parseReport(stdout)
    // A known gap exits 0 but is NOT a pass: the platform is still wrong, which is why the
    // case carries a filed bug. Reporting it green is how a replay talks someone out of a
    // real defect.
    const status: 'pass' | 'fail' = code === 0 && !parsed.knownGap ? 'pass' : 'fail'
    if (timedOut && !parsed.error) {
      parsed.error = `Run exceeded ${Math.round(RUN_TIMEOUT_MS / 1000)}s and was killed (AUTOMATION_RUN_TIMEOUT_MS)`
    }
    // A child that fails while printing NOTHING used to surface in the UI as a bare
    // "fail" with no error, no log and no artifacts — indistinguishable from a broken
    // spec, and impossible to debug from the dashboard. Report the exit code instead:
    // an empty stdout means Playwright never got far enough to write its JSON report,
    // so the fault is in launching it, not in the test.
    if (!parsed.error && stdout.trim() === '') {
      parsed.error =
        `Playwright produced no output (exit code ${code}) — it never started, so the spec never ran. ` +
        `Check that node_modules/@playwright/test exists and that the server process can spawn it.`
    }
    // A parse failure (malformed/absent JSON, e.g. the process was killed before
    // the reporter could print) can't tell us whether tests ran — default to
    // true so it doesn't ALSO suppress a genuine timeout/fail from being synced.
    const executed = parsed.executed ?? true

    // Lift video + trace out of the nested raw output into the run folder.
    const video = await findFile(rawOut, (f) => f.endsWith('.webm'))
    const trace = await findFile(rawOut, (f) => f === 'trace.zip')
    let hasVideo = false
    let hasTrace = false
    if (video) { await fs.copyFile(video, path.join(dir, 'video.webm')); hasVideo = true }
    if (trace) { await fs.copyFile(trace, path.join(dir, 'trace.zip')); hasTrace = true }

    // API projects also emit a request/response log (see lib/eptts-api-log.ts). Lift it
    // so the Hub can show what was actually sent and received — for a 202-then-poll API
    // that detail is the whole point of a replay, and pass/fail alone says almost nothing.
    const apiArtifacts = ['api-log.html', 'api-exchanges.json', 'api-postman-collection.json']
    let hasApiLog = false
    for (const name of apiArtifacts) {
      const found = await findFile(rawOut, (f) => f === name)
      if (!found) continue
      await fs.copyFile(found, path.join(dir, name))
      if (name === 'api-log.html') hasApiLog = true
    }

    const durationMs = parsed.durationMs ?? (Date.now() - startedAt)
    const log = stdout.slice(-4000)

    await fs.writeFile(
      path.join(dir, 'result.json'),
      JSON.stringify({ status, exitCode: code, durationMs, error: parsed.error, hasVideo, hasTrace, hasApiLog, log, executed }, null, 2),
      'utf8',
    )
    // The raw playwright output is bulky and already mined — drop it.
    await fs.rm(rawOut, { recursive: true, force: true })

    await recordRun(name, { ts, status, durationMs, hasVideo, hasTrace, hasApiLog, error: parsed.error })

    return { status, exitCode: code, durationMs, ts, error: parsed.error, hasVideo, hasTrace, hasApiLog, log, executed }
  } finally {
    running.delete(name)
  }
}

export function isRunning(name: string): boolean {
  return running.has(name)
}
