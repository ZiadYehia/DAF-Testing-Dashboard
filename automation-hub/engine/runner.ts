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
  HUB_ROOT, runDir, recordRun,
} from '../store'
import type { RunResult } from '../types'

const CONFIG = path.join(HUB_ROOT, 'playwright.config.ts')

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

/** Parse the playwright JSON reporter output; tolerant of extra log noise. */
function parseReport(stdout: string): { durationMs?: number; error?: string } {
  // The JSON reporter prints one big JSON object. Find the outermost braces.
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start === -1 || end === -1) return {}
  try {
    const report = JSON.parse(stdout.slice(start, end + 1))
    const durationMs = report?.stats?.duration
    // Dig out the first error message from the suite tree, if any.
    let error: string | undefined
    const visit = (node: any) => {
      if (error) return
      for (const t of node?.specs ?? []) {
        for (const test of t?.tests ?? []) {
          for (const r of test?.results ?? []) {
            const msg = r?.errors?.[0]?.message ?? r?.error?.message
            if (msg) { error = String(msg).split('\n')[0]; return }
          }
        }
      }
      for (const s of node?.suites ?? []) visit(s)
    }
    for (const s of report?.suites ?? []) visit(s)
    return { durationMs: typeof durationMs === 'number' ? durationMs : undefined, error }
  } catch {
    return {}
  }
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
    const specFilter = `projects/${name}/test.spec.ts`
    const args = [
      cli, 'test', specFilter,
      '--config', CONFIG,
      '--output', rawOut,
      '--reporter=json',
    ]

    const { code, stdout, timedOut } = await new Promise<{ code: number; stdout: string; timedOut: boolean }>((resolve) => {
      const child = spawn(process.execPath, args, {
        cwd: HUB_ROOT,
        env: { ...process.env, FORCE_COLOR: '0' },
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

    const status: 'pass' | 'fail' = code === 0 ? 'pass' : 'fail'
    const parsed = parseReport(stdout)
    if (timedOut && !parsed.error) {
      parsed.error = `Run exceeded ${Math.round(RUN_TIMEOUT_MS / 1000)}s and was killed (AUTOMATION_RUN_TIMEOUT_MS)`
    }

    // Lift video + trace out of the nested raw output into the run folder.
    const video = await findFile(rawOut, (f) => f.endsWith('.webm'))
    const trace = await findFile(rawOut, (f) => f === 'trace.zip')
    let hasVideo = false
    let hasTrace = false
    if (video) { await fs.copyFile(video, path.join(dir, 'video.webm')); hasVideo = true }
    if (trace) { await fs.copyFile(trace, path.join(dir, 'trace.zip')); hasTrace = true }

    const durationMs = parsed.durationMs ?? (Date.now() - startedAt)
    const log = stdout.slice(-4000)

    await fs.writeFile(
      path.join(dir, 'result.json'),
      JSON.stringify({ status, durationMs, error: parsed.error, hasVideo, hasTrace, log }, null, 2),
      'utf8',
    )
    // The raw playwright output is bulky and already mined — drop it.
    await fs.rm(rawOut, { recursive: true, force: true })

    await recordRun(name, { ts, status, durationMs, hasVideo, hasTrace, error: parsed.error })

    return { status, durationMs, ts, error: parsed.error, hasVideo, hasTrace, log }
  } finally {
    running.delete(name)
  }
}

export function isRunning(name: string): boolean {
  return running.has(name)
}
