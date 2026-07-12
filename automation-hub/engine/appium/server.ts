/**
 * Automation Hub — Appium server process lifecycle (Phase 3).
 *
 * Spawns and tears down the local Appium server that both the Appium replay
 * runner (engine/appium-runner.ts) and the Appium MCP authoring client
 * (engine/appium-mcp-client.ts) connect webdriverio sessions to. Mirrors
 * engine/runner.ts's watchdog process-tree-kill pattern and
 * engine/mcp-client.ts's node_modules-path resolution style.
 */
import { spawn, type ChildProcess } from 'child_process'
import net from 'net'
import path from 'path'

/**
 * Absolute path to the locally-installed Appium server CLI. Built from
 * process.cwd() rather than require.resolve — Turbopack rewrites
 * require.resolve inside bundled route handlers (the same lesson as
 * mcp-client.ts's playwrightMcpCli).
 */
export function resolveAppiumCli(): string {
  return path.join(process.cwd(), 'node_modules', 'appium', 'index.js')
}

export interface AppiumHandle {
  port: number
  stop(): Promise<void>
}

/** How often to poll /status while the server is starting up. */
const READY_POLL_MS = 500
/** Overall cap on server startup before we give up. */
const READY_TIMEOUT_MS = 30_000
/** How much startup log to keep around to surface in a startup-failure error. */
const LOG_TAIL_CHARS = 4000

/** Kill the server's process tree — plain child.kill() would orphan children on Windows. */
function stopProcess(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return }
    child.once('close', () => resolve())
    try {
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
      } else {
        child.kill('SIGKILL')
      }
    } catch {
      resolve() // already gone
    }
  })
}

/**
 * Spawn the Appium server on `port` and wait until it responds on /status.
 * Rejects (after killing the process tree it started) if the server exits
 * early or never becomes ready within the timeout — in the exits-early case
 * we reject immediately with the captured log tail rather than waiting out
 * the full timeout.
 */
export async function startAppiumServer(port: number): Promise<AppiumHandle> {
  const cli = resolveAppiumCli()
  const child = spawn(
    process.execPath,
    [cli, '--port', String(port), '--base-path', '/', '--log-level', 'error'],
    { cwd: process.cwd() },
  )

  // Don't pipe/inherit stdout by default — capture into a rolling buffer so we
  // can surface the last bit of log if startup fails (mirrors runner.ts's
  // accumulation of child.stdout/stderr into a string).
  let log = ''
  let exited = false
  let exitCode: number | null = null
  child.stdout?.on('data', (d) => { log = (log + d.toString()).slice(-LOG_TAIL_CHARS) })
  child.stderr?.on('data', (d) => { log = (log + d.toString()).slice(-LOG_TAIL_CHARS) })
  child.on('close', (code) => { exited = true; exitCode = code })

  const stop = (): Promise<void> => stopProcess(child)

  try {
    const deadline = Date.now() + READY_TIMEOUT_MS
    for (;;) {
      if (exited) {
        throw new Error(
          `Appium server exited early (code ${exitCode ?? 'unknown'}) before becoming ready:\n${log}`,
        )
      }
      try {
        const res = await fetch(`http://127.0.0.1:${port}/status`)
        if (res.ok) break
      } catch {
        // not listening yet — keep polling
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `Appium server did not become ready on port ${port} within ${Math.round(READY_TIMEOUT_MS / 1000)}s:\n${log}`,
        )
      }
      await new Promise((r) => setTimeout(r, READY_POLL_MS))
    }
  } catch (err) {
    await stop().catch(() => { /* best-effort cleanup */ })
    throw err
  }

  return { port, stop }
}

/** Find a free TCP port by letting the OS assign one, then releasing it. */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}
