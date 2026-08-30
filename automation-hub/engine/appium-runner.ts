/**
 * Automation Hub — Appium (Android) replay engine.
 *
 * Reruns a project's saved Appium spec (a vendored-harness .mjs script, see
 * engine/appium/harness.mjs) in a child process against the local emulator.
 * Mirrors engine/runner.ts's shape as closely as possible; see that file for
 * the Playwright equivalent. Differences are purely engine-specific:
 *   - the local Android emulator + a per-run Appium server must be booted
 *     first (device.ts / server.ts), guarded by a process-global device mutex
 *     so an authoring session can never run concurrently with a replay
 *   - the harness prints exactly one machine-parseable JSON result line
 *     instead of Playwright's JSON reporter blob
 *   - the harness writes video.mp4 directly to the path we hand it via
 *     VIDEO_OUT — no raw-output staging dir, no trace.zip equivalent
 */
import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { HUB_ROOT, runDir, specPath, readMeta, recordRun } from '../store'
import { type RunResult, validateAppiumTarget } from '../types'
import { resolveDevice, withDevice } from './appium/device'
import { startAppiumServer, freePort } from './appium/server'

/**
 * Hard wall-clock cap on a replay child process — same rationale and same env
 * var as engine/runner.ts's RUN_TIMEOUT_MS (not imported from there since
 * runner.ts doesn't export it; kept as an identical redeclaration here).
 */
const RUN_TIMEOUT_MS = Number(process.env.AUTOMATION_RUN_TIMEOUT_MS ?? 5 * 60_000)

/** In-process lock: one replay at a time per project. */
const running = new Set<string>()

/** Make an ISO timestamp filesystem-safe (no ":" / "."). */
function safeTs(iso: string): string {
  return iso.replace(/[:.]/g, '-')
}

/**
 * Parse the harness's single-line JSON result out of the child's stdout.
 * Scans from the end backwards (the result line is always last, but stray
 * log output before/after it is tolerated) and returns the first parsed
 * object tagged `__appiumResult__`, or null if none is found.
 */
function parseResultLine(stdout: string): { status: 'pass' | 'fail'; durationMs: number; error?: string } | null {
  const lines = stdout.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line) continue
    try {
      const obj = JSON.parse(line)
      if (obj?.__appiumResult__ === true) return obj
    } catch {
      // not JSON — keep scanning backwards
    }
  }
  return null
}

/**
 * Run a project's Appium spec and archive the result.
 * @param now ISO timestamp captured by the caller (route handler).
 */
export async function runProject(name: string, now: string): Promise<RunResult> {
  if (running.has(name)) {
    throw new Error(`A run for "${name}" is already in progress`)
  }
  running.add(name)
  const startedAt = Date.now()
  try {
    const meta = await readMeta(name)
    if (!meta) throw new Error(`Unknown project "${name}"`)
    if (meta.engine !== 'appium' || !meta.appium) {
      throw new Error(`Project "${name}" is not an Appium project`)
    }
    const appium = meta.appium
    const targetError = validateAppiumTarget(appium)
    if (targetError) throw new Error(targetError)

    const ts = safeTs(now)
    const dir = runDir(name, ts)
    await fs.mkdir(dir, { recursive: true })

    // The local device (real or emulator) is a single shared resource — never
    // let an authoring session and this replay drive it at the same time.
    //
    // Note: the authoring path (engine/appium-mcp-client.ts) still calls
    // resolveAvd + ensureEmulator directly and is emulator-only for now;
    // extend it to resolveDevice in a later pass so authoring can also target
    // a real device.
    const { code, stdout, timedOut } = await withDevice(async () => {
      // resolveDevice picks a real device (meta.appium.udid / ANDROID_UDID)
      // when configured, else falls back to the local emulator.
      const serial = await resolveDevice(meta)
      const port = await freePort()
      const handle = await startAppiumServer(port)
      try {
        return await new Promise<{ code: number; stdout: string; timedOut: boolean }>((resolve) => {
          const env: NodeJS.ProcessEnv = {
            ...process.env,
            APPIUM_PORT: String(port),
            ANDROID_DEVICE: serial,
            VIDEO_OUT: path.join(dir, 'video.mp4'),
            ...(appium.apkPath ? { APK_PATH: appium.apkPath } : {}),
            ...(appium.appPackage ? { APP_PACKAGE: appium.appPackage } : {}),
            ...(appium.appActivity ? { APP_ACTIVITY: appium.appActivity } : {}),
            ...(appium.noReset ? { NO_RESET: '1' } : {}),
          }
          // Invoke via plain node (no shell) so paths containing spaces —
          // e.g. "General Testing Dashboard" — are passed safely as argv.
          const child = spawn(process.execPath, [specPath(name, 'appium')], {
            cwd: HUB_ROOT,
            env,
          })
          let out = ''
          let killed = false
          // Watchdog: a hung child (emulator/session that never reports) is
          // killed with its whole tree — plain child.kill() would orphan
          // any lingering driver processes on Windows.
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
      } finally {
        await handle.stop().catch(() => {})
      }
    })

    const parsed = parseResultLine(stdout)
    let status: 'pass' | 'fail'
    let durationMs: number
    let error: string | undefined
    if (parsed) {
      status = parsed.status
      durationMs = parsed.durationMs
      error = parsed.error
    } else {
      status = code === 0 ? 'pass' : 'fail'
      durationMs = Date.now() - startedAt
      if (timedOut) {
        error = `Run exceeded ${Math.round(RUN_TIMEOUT_MS / 1000)}s and was killed (AUTOMATION_RUN_TIMEOUT_MS)`
      } else {
        error = `Appium script exited without reporting a result${stdout ? `\n${stdout.slice(-2000)}` : ''}`
      }
    }

    const hasVideo = await fs.access(path.join(dir, 'video.mp4')).then(() => true, () => false)
    // Appium has no trace.zip equivalent to Playwright's trace viewer.
    const hasTrace = false
    const log = stdout.slice(-4000)

    await fs.writeFile(
      path.join(dir, 'result.json'),
      // No per-test skip concept in the Appium harness protocol — a reported
      // result always means the script actually ran. See RunResult.executed.
      JSON.stringify({ status, durationMs, error, hasVideo, hasTrace, log, executed: true }, null, 2),
      'utf8',
    )

    await recordRun(name, { ts, status, durationMs, hasVideo, hasTrace, error })

    return { status, durationMs, ts, error, hasVideo, hasTrace, log, executed: true }
  } finally {
    running.delete(name)
  }
}

export function isRunning(name: string): boolean {
  return running.has(name)
}
