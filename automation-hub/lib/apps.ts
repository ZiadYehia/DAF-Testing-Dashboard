/**
 * Automation Hub — target-app registry.
 *
 * The hub automates MANY apps, not just one. Everything app-specific — the base-URL
 * env key and the scripted login flow — is declared as data at data/<slug>/automation.json
 * (schema: lib/login-config.ts) and interpreted by lib/login-runner.ts. To point the
 * hub at a new app: fill the Automation section of the app's intake form (or hand-write
 * data/<slug>/automation.json) and add its env keys to automation-hub/.env. Nothing in
 * the hub itself needs to change.
 *
 * Each app gets its own cached auth state at .auth/<slug>.json (created by
 * lib/auth.setup.ts). Specs opt in with:
 *   test.use({ storageState: stateFor('<slug>') })
 */
import type { Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { HUB_DIR, requireEnv } from './env'
import { validateAutomationConfig, type AppAutomationConfig } from './login-config'
import { runLogin } from './login-runner'

export interface TargetApp {
  /** Dashboard app slug; also names the cached auth state file (.auth/<slug>.json). */
  slug: string
  /** Env key (in automation-hub/.env) holding the app's base URL. */
  baseUrlEnv: string
  /** Drive the app's login flow from an unauthenticated page. */
  login: (page: Page) => Promise<void>
}

/** data/ root — DATA_ROOT propagates from the Next parent's spawn env (see engine/runner.ts). */
function dataRoot(): string {
  return process.env.DATA_ROOT ?? path.join(HUB_DIR, '..', 'data')
}

/** Scan data/<slug>/automation.json for every app folder and build the registry. */
function loadTargetApps(): TargetApp[] {
  const root = dataRoot()
  const apps: TargetApp[] = []

  let slugs: string[]
  try {
    slugs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return apps // no data/ directory yet
  }

  for (const slug of slugs) {
    const file = path.join(root, slug, 'automation.json')
    let raw: string
    try {
      raw = fs.readFileSync(file, 'utf8')
    } catch {
      continue // app has no automation config — not registered, not an error
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.warn(`[apps] skipping ${file}: invalid JSON (${err instanceof Error ? err.message : String(err)})`)
      continue
    }

    const problems = validateAutomationConfig(parsed)
    if (problems.length > 0) {
      console.warn(`[apps] skipping ${file}: ${problems.join('; ')}`)
      continue
    }

    const cfg = parsed as AppAutomationConfig
    apps.push({
      slug: cfg.slug,
      baseUrlEnv: cfg.baseUrlEnv,
      login: (page) => runLogin(page, cfg, requireEnv(cfg.baseUrlEnv)),
    })
  }

  return apps
}

export const TARGET_APPS: TargetApp[] = loadTargetApps()

export function getTargetApp(slug: string): TargetApp {
  const app = TARGET_APPS.find((a) => a.slug === slug)
  if (!app) {
    throw new Error(
      `Unknown target app "${slug}" — no data/${slug}/automation.json found. Fill the Automation ` +
        `section of the app's intake form (known: ${TARGET_APPS.map((a) => a.slug).join(', ') || 'none'})`,
    )
  }
  return app
}

/** Path to an app's cached auth state, for test.use({ storageState: stateFor(slug) }). */
export function stateFor(slug: string): string {
  return path.join(HUB_DIR, '.auth', `${slug}.json`)
}

/** The app's base URL from automation-hub/.env. */
export function baseUrl(slug: string): string {
  return requireEnv(getTargetApp(slug).baseUrlEnv)
}
