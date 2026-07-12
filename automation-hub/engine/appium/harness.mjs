/**
 * Automation Hub — Appium replay/authoring harness (Phase 3).
 *
 * Vendored runtime code that generated Appium specs import directly. Appium
 * has no bundled test-runner/assertion-library the way Playwright specs get
 * @playwright/test, so this file plays that role — WE own it. A generated
 * spec (built in a later phase) looks like:
 *
 *   import { runSpec } from '../../engine/appium/harness.mjs'
 *   await runSpec(async (driver) => {
 *     const el = await driver.$('~someAccessibilityId')
 *     await el.waitForDisplayed()
 *     await el.click()
 *   })
 *
 * This file is spawned directly as a child process via plain `node`, never
 * compiled — hence plain ESM JavaScript, not TypeScript.
 *
 * Secret boundary: this file runs as a spawned child process, so — unlike
 * engine/appium/device.ts and server.ts, which run inside the Next server and
 * must never load real automation-hub/.env values into their own process.env
 * — this file IS allowed to load them into its own process.env. This is a
 * minimal reimplementation of automation-hub/lib/env.ts's parseEnvFile/
 * loadHubEnv logic (can't import the .ts file directly — Node can't run TS
 * without a loader).
 */
import { remote } from 'webdriverio'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// This file lives at automation-hub/engine/appium/harness.mjs, so two levels
// up is automation-hub/.
const HUB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ENV_PATH = path.join(HUB_DIR, '.env')

/** Minimal .env parser — KEY=VALUE lines, # comments, optional surrounding quotes. */
function parseEnvFile(raw) {
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!m || line.trim().startsWith('#')) continue
    let value = m[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[m[1]] = value
  }
  return out
}

/** Load automation-hub/.env into process.env. Existing env vars win. */
function loadHubEnv() {
  let raw
  try {
    raw = fs.readFileSync(ENV_PATH, 'utf8')
  } catch {
    return // no .env yet — required env vars below will fail with a clear message
  }
  for (const [key, value] of Object.entries(parseEnvFile(raw))) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadHubEnv()

/** Read a required env var the runner is expected to set before spawning this script. */
function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

/**
 * Run one Appium flow: connect to the local Appium server, start a screen
 * recording, run `fn(driver)`, save the recording, tear the session down, and
 * print exactly one machine-parseable result line to stdout — regardless of
 * what failed, so the runner (built in a later phase) always has exactly one
 * parseable line to find.
 */
export async function runSpec(fn) {
  const startedAt = Date.now()
  let error

  try {
    const appiumPort = requireEnv('APPIUM_PORT')
    const apkPath = process.env.APK_PATH
    const androidDevice = requireEnv('ANDROID_DEVICE')
    const videoOut = requireEnv('VIDEO_OUT')

    if (!apkPath && !(process.env.APP_PACKAGE && process.env.APP_ACTIVITY)) {
      throw new Error(
        'Set APK_PATH, or APP_PACKAGE and APP_ACTIVITY for a pre-installed app.',
      )
    }

    const capabilities = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:udid': androidDevice,
      'appium:noReset': process.env.NO_RESET === '1',
    }
    if (apkPath) capabilities['appium:app'] = apkPath
    if (process.env.APP_PACKAGE) capabilities['appium:appPackage'] = process.env.APP_PACKAGE
    if (process.env.APP_ACTIVITY) capabilities['appium:appActivity'] = process.env.APP_ACTIVITY

    const driver = await remote({
      hostname: '127.0.0.1',
      port: Number(appiumPort),
      path: '/',
      capabilities,
      logLevel: 'error',
    })

    // Recording is best-effort — a device/driver that can't record shouldn't
    // fail the whole run. timeLimit raises Android's default 180s cap, which
    // is too short for a long login/onboarding flow.
    let recording = false
    try {
      await driver.startRecordingScreen({ timeLimit: 600 })
      recording = true
    } catch (startErr) {
      console.error('[appium-harness] failed to start screen recording:', startErr?.message ?? startErr)
    }

    try {
      await fn(driver)
    } catch (fnErr) {
      error = fnErr
    } finally {
      // A recording-save failure shouldn't mask the real test result — log it
      // to stderr and continue. Only attempt the save if recording actually
      // started.
      if (recording) {
        try {
          await driver.saveRecordingScreen(videoOut)
        } catch (saveErr) {
          console.error('[appium-harness] failed to save screen recording:', saveErr?.message ?? saveErr)
        }
      }
      // Session cleanup failure shouldn't crash result reporting either.
      try {
        await driver.deleteSession()
      } catch (closeErr) {
        console.error('[appium-harness] failed to close session cleanly:', closeErr?.message ?? closeErr)
      }
    }
  } catch (err) {
    // Catches everything above the inner try too — including a failed
    // remote() connection — so even a total connect failure still reports.
    error = err
  }

  const result = {
    __appiumResult__: true,
    status: error ? 'fail' : 'pass',
    durationMs: Date.now() - startedAt,
  }
  if (error) result.error = error?.message ?? String(error)
  console.log(JSON.stringify(result))
  process.exit(error ? 1 : 0)
}
