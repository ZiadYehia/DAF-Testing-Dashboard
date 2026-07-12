/**
 * Automation Hub — environment for the Playwright side (config, specs, helpers).
 *
 * Secrets and environment-specific values (base URLs, credentials) live in
 * automation-hub/.env (gitignored — see .env.example) so generated specs never
 * hardcode them. loadHubEnv() is called once from playwright.config.ts, which runs
 * inside the spawned test child process, so every spec sees the values on process.env.
 *
 * This module is Playwright-child-only: it resolves paths via __dirname, which the
 * Next.js server bundle rewrites. The Next side reads env key NAMES (never values)
 * through listHubEnvKeys() in store.ts instead.
 */
import fs from 'fs'
import path from 'path'

export const HUB_DIR = path.join(__dirname, '..')
export const ENV_PATH = path.join(HUB_DIR, '.env')

/** Minimal .env parser — KEY=VALUE lines, # comments, optional surrounding quotes. */
export function parseEnvFile(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
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
export function loadHubEnv(): void {
  let raw: string
  try {
    raw = fs.readFileSync(ENV_PATH, 'utf8')
  } catch {
    return // no .env yet — specs relying on env vars will fail with a clear message
  }
  for (const [key, value] of Object.entries(parseEnvFile(raw))) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

/** Read an env var a spec depends on, with an actionable failure message. */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing environment variable ${name} — set it in automation-hub/.env (see .env.example)`,
    )
  }
  return value
}
