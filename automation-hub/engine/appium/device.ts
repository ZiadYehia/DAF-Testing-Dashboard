/**
 * Automation Hub — Appium/Android device lifecycle (Phase 3).
 *
 * Shared plumbing for booting/reusing the local Android emulator, used by both
 * the Appium replay runner (engine/appium-runner.ts) and the Appium MCP
 * authoring client (engine/appium-mcp-client.ts). Mirrors the idioms of
 * engine/mcp-client.ts (HMR-safe globalThis singletons) and engine/runner.ts
 * (Windows process-tree kill).
 */
import { spawn } from 'child_process'
import path from 'path'
import type { ProjectMeta } from '../../types'

/**
 * Resolve the AVD to boot: a project's explicit override, else the
 * ANDROID_AVD env var. Throws with an actionable message when neither is set —
 * callers can't do anything useful with an empty AVD name.
 */
export function resolveAvd(meta?: Pick<ProjectMeta, 'appium'>): string {
  const avd = meta?.appium?.avd ?? process.env.ANDROID_AVD ?? ''
  if (!avd) {
    throw new Error(
      "No AVD configured — set ANDROID_AVD in automation-hub/.env or the project's appium.avd",
    )
  }
  return avd
}

/**
 * Resolve the adb/emulator binary. Prefers ANDROID_HOME (joined with the
 * platform tool's subpath); falls back to the bare tool name — i.e. rely on
 * PATH — when ANDROID_HOME isn't set, so this still works on a machine where
 * the Android SDK tools are just on PATH.
 */
function resolveAndroidBin(tool: 'adb' | 'emulator'): string {
  const home = process.env.ANDROID_HOME
  if (!home) return tool
  const dir = tool === 'adb' ? 'platform-tools' : 'emulator'
  const exe = process.platform === 'win32' ? `${tool}.exe` : tool
  return path.join(home, dir, exe)
}

/** Run a CLI tool to completion, capturing stdout/stderr rather than piping. */
function run(bin: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args)
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => { stdout += d.toString() })
    child.stderr?.on('data', (d) => { stderr += d.toString() })
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
    child.on('error', (err) => resolve({ code: 1, stdout, stderr: stderr + '\n' + String(err) }))
  })
}

/** Match an `adb devices` line for an already-booted device, e.g. "emulator-5554\tdevice". */
const BOOTED_DEVICE_RE = /^(\S+)\s+device$/

/** Return the serial of a running emulator per `adb devices`, or null if none is up yet. */
async function findBootedEmulator(adb: string): Promise<string | null> {
  const { stdout } = await run(adb, ['devices'])
  for (const rawLine of stdout.split(/\r?\n/)) {
    const m = BOOTED_DEVICE_RE.exec(rawLine.trim())
    if (m && m[1].startsWith('emulator-')) return m[1]
  }
  return null
}

/** Match any `adb devices` line, capturing the serial and its state, e.g. "R58M1234ABC\tunauthorized". */
const DEVICE_STATE_RE = /^(\S+)\s+(\S+)$/

/** A real device's state per `adb devices`, or null when the serial doesn't appear at all. */
type DeviceState = 'device' | 'unauthorized' | 'offline' | null

/** Look up a specific serial's state in `adb devices` output. */
async function findDeviceState(adb: string, serial: string): Promise<DeviceState> {
  const { stdout } = await run(adb, ['devices'])
  for (const rawLine of stdout.split(/\r?\n/)) {
    const m = DEVICE_STATE_RE.exec(rawLine.trim())
    if (m && m[1] === serial) {
      const state = m[2]
      return state === 'device' || state === 'unauthorized' || state === 'offline' ? state : null
    }
  }
  return null
}

/**
 * Ensure the local Android emulator is up and fully booted, starting it if
 * necessary, and return its device serial (e.g. "emulator-5554").
 *
 * There's realistically only ever one AVD on this box (matching the
 * single-device-mutex design of withDevice below), so if any emulator-* is
 * already in `device` state we reuse it without checking which AVD it is.
 */
export async function ensureEmulator(avd: string, timeoutMs = 120_000): Promise<string> {
  const adb = resolveAndroidBin('adb')
  const emulatorBin = resolveAndroidBin('emulator')

  const already = await findBootedEmulator(adb)
  if (already) return already

  // Boot detached and unref'd — this emulator is a long-lived process that
  // must keep running after this function (and the spawning Node process's
  // current tick) returns; it should NOT be killed when the spawn call resolves.
  const child = spawn(emulatorBin, ['-avd', avd, '-no-window', '-no-snapshot-save'], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  // Waits for the device to appear in `adb devices` state — not full Android boot.
  await run(adb, ['wait-for-device'])

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { stdout } = await run(adb, ['shell', 'getprop', 'sys.boot_completed'])
    if (stdout.trim() === '1') {
      const serial = await findBootedEmulator(adb)
      if (serial) return serial
      break // boot_completed but no emulator-* serial yet — fall through to the timeout error
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(`Emulator "${avd}" did not finish booting within ${Math.round(timeoutMs / 1000)}s`)
}

/**
 * Best-effort APK install onto an already-running device.
 *
 * This is NOT the primary install path — Appium's own `appium:app` capability
 * (set by the harness/session, not here) installs, launches, and detects the
 * activity of the APK itself when a session starts. This helper exists only
 * for edge cases, e.g. pre-installing the app before an MCP authoring session
 * that expects the app to already be present on the device.
 */
export async function ensureApkInstalled(serial: string, apkPath: string): Promise<void> {
  const adb = resolveAndroidBin('adb')
  const { code, stderr } = await run(adb, ['-s', serial, 'install', '-r', apkPath])
  if (code !== 0) {
    const tail = stderr.trim().slice(-1000) || `adb exited with code ${code}`
    throw new Error(`adb install failed for "${apkPath}": ${tail}`)
  }
}

/**
 * Resolve the device serial to drive for a run: a real device's adb serial —
 * project override (meta.appium.udid) or the ANDROID_UDID env var — when set,
 * else the local emulator (resolveAvd + ensureEmulator, unchanged behavior).
 *
 * When a udid is configured we require it to already be present and in
 * `device` state; we never attempt to fix an unauthorized/offline/missing
 * real device programmatically (unlike the emulator, which we boot
 * ourselves), so callers get an actionable error pointing at the manual fix.
 */
export async function resolveDevice(meta?: Pick<ProjectMeta, 'appium'>): Promise<string> {
  const udid = (meta?.appium?.udid ?? process.env.ANDROID_UDID ?? '').trim()
  if (udid) {
    const adb = resolveAndroidBin('adb')
    const state = await findDeviceState(adb, udid)
    if (state === 'device') return udid
    if (state === 'unauthorized') {
      throw new Error(
        `Device "${udid}" is unauthorized — accept the USB-debugging authorization prompt on the phone, then try again.`,
      )
    }
    if (state === 'offline') {
      throw new Error(
        `Device "${udid}" is offline — try reconnecting the USB cable or restarting adb ("adb kill-server && adb start-server").`,
      )
    }
    throw new Error(
      `Device "${udid}" not found — connect it via USB, enable USB debugging in Developer Options on the phone, and confirm it shows up in "adb devices".`,
    )
  }
  const avd = resolveAvd(meta)
  return ensureEmulator(avd)
}

// ─── process-global device mutex ────────────────────────────────────────────
// There's only ever one local AVD, so an authoring session and a replay run
// must never drive it concurrently. Keyed on a globalThis singleton (mirrors
// mcp-client.ts's startIdleSweep guard) so Next's dev-mode module reload
// doesn't lose in-flight lock state — a plain module-scope Promise would get
// reset on every HMR reload.
interface DeviceMutex { chain: Promise<unknown> }

function getDeviceMutex(): DeviceMutex {
  const g = globalThis as typeof globalThis & { __appiumDeviceMutex?: DeviceMutex }
  if (!g.__appiumDeviceMutex) {
    g.__appiumDeviceMutex = { chain: Promise.resolve() }
  }
  return g.__appiumDeviceMutex
}

/**
 * Run `fn` exclusively against the local device, queued behind any in-flight
 * caller. Mirrors store.ts's withMetaLock's promise-chaining shape: queued via
 * `.then(fn, fn)`, with a non-rejecting tail stored back so one failure
 * doesn't wedge the next caller.
 */
export function withDevice<T>(fn: () => Promise<T>): Promise<T> {
  const mutex = getDeviceMutex()
  const run = mutex.chain.then(fn, fn)
  mutex.chain = run.then(() => undefined, () => undefined)
  return run
}

/**
 * Acquire the device mutex for a caller whose "critical section" isn't one
 * async function call but a long-lived, multi-step session (the Appium MCP
 * authoring client — see engine/appium-mcp-client.ts). `withDevice` releases
 * as soon as its callback's promise settles, which is exactly wrong for a
 * session that spans many `runTurn` calls over potentially minutes: if
 * authoring only held the lock during its initial emulator-boot step, a
 * replay run could start on the same device the moment that step finished,
 * even though the authoring session is still driving it. That would defeat
 * the whole point of the mutex (replay and authoring must never touch the
 * device concurrently).
 *
 * This is the same promise-chain queue `withDevice` uses (and the same
 * globalThis singleton, via getDeviceMutex), just without the scoped-callback
 * shape: instead of "run this function while holding the lock", it's
 * "give me the lock now, and a function to give it back later". The
 * returned release function MUST be called exactly once (e.g. from
 * closeSession or the idle-sweep) or the device stays locked forever.
 */
export function acquireDevice(): Promise<() => void> {
  const mutex = getDeviceMutex()
  const previous = mutex.chain
  let release!: () => void
  // `held` only settles once `release()` is invoked — so the next queued
  // acquirer (withDevice or acquireDevice) waits behind it, not just behind
  // our synchronous acquisition.
  const held = new Promise<void>((resolve) => { release = resolve })
  mutex.chain = previous.then(() => held, () => held)
  // Callers wait their turn (behind `previous`, which never rejects — see
  // withDevice's non-rejecting tail) before getting the release function.
  return previous.then(() => release, () => release)
}
