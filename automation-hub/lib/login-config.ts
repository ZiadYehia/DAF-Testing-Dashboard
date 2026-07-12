/**
 * Automation Hub — declarative login config schema (dependency-free).
 *
 * This module is imported by BOTH the Playwright child process (lib/apps.ts,
 * lib/login-runner.ts) and Next.js client components (the intake wizard's
 * automation-step editor). It must never import `@playwright/test`, `fs`, or any
 * other Node/browser-only API — plain types + pure functions only.
 *
 * An app's login flow is authored as data (data/<app>/automation.json), not code:
 * see AppAutomationConfig. validateAutomationConfig() is the single source of truth
 * for "is this JSON well-formed" — used both when the hub loads apps at startup and
 * when the intake UI saves the automation group.
 */

export type LocatorKind = 'css' | 'id' | 'text' | 'role' | 'testid' | 'label'

export interface StepLocator {
  kind: LocatorKind
  value: string
  /** Accessible name filter — only meaningful for kind: 'role'. */
  name?: string
}

export type LoginStep =
  | { action: 'goto'; url: string }
  | {
      action: 'click'
      locator: StepLocator
      onlyIfVisible?: boolean
      /**
       * Reproduces a flake-retry pattern seen in slow real-world apps: click, then wait (10s) for any of
       * `expectAnyVisible` to appear; on timeout, click once more and wait again
       * (15s). Only meaningful when `expectAnyVisible` is also set.
       */
      retryOnFlake?: boolean
      expectAnyVisible?: StepLocator[]
      timeoutMs?: number
    }
  | { action: 'fill'; locator: StepLocator; value: string; onlyIfVisible?: boolean }
  | { action: 'waitForUrl'; startsWith: string; timeoutMs?: number }
  | { action: 'waitForVisible'; locator: StepLocator; timeoutMs?: number }

export interface AppAutomationConfig {
  /** Dashboard app slug (must match the data/<slug>/ folder this file lives in). */
  slug: string
  /** Env key (in automation-hub/.env) holding the app's base URL. */
  baseUrlEnv: string
  /** Env keys (in automation-hub/.env) the login flow reads credentials from. */
  credentialEnvs: string[]
  login: LoginStep[]
}

const LOCATOR_KINDS: LocatorKind[] = ['css', 'id', 'text', 'role', 'testid', 'label']

function validateLocator(loc: unknown, path: string, problems: string[]): void {
  if (typeof loc !== 'object' || loc === null) {
    problems.push(`${path}: expected a locator object, got ${typeof loc}`)
    return
  }
  const l = loc as Record<string, unknown>
  if (typeof l.kind !== 'string' || !LOCATOR_KINDS.includes(l.kind as LocatorKind)) {
    problems.push(`${path}.kind: must be one of ${LOCATOR_KINDS.join(', ')} (got ${JSON.stringify(l.kind)})`)
  }
  if (typeof l.value !== 'string' || !l.value) {
    problems.push(`${path}.value: required non-empty string`)
  }
  if (l.name !== undefined && typeof l.name !== 'string') {
    problems.push(`${path}.name: must be a string when present`)
  }
}

/** Validate a parsed JSON value as an AppAutomationConfig. Returns [] when valid. */
export function validateAutomationConfig(x: unknown): string[] {
  const problems: string[] = []
  if (typeof x !== 'object' || x === null) {
    return ['config: expected a JSON object']
  }
  const cfg = x as Record<string, unknown>

  if (typeof cfg.slug !== 'string' || !cfg.slug) {
    problems.push('slug: required non-empty string')
  }
  if (typeof cfg.baseUrlEnv !== 'string' || !cfg.baseUrlEnv) {
    problems.push('baseUrlEnv: required non-empty string')
  }
  if (!Array.isArray(cfg.credentialEnvs) || cfg.credentialEnvs.some((e) => typeof e !== 'string')) {
    problems.push('credentialEnvs: required array of strings')
  }
  if (!Array.isArray(cfg.login)) {
    problems.push('login: required array of steps')
    return problems // can't validate individual steps without an array
  }

  cfg.login.forEach((step, i) => {
    const path = `login[${i}]`
    if (typeof step !== 'object' || step === null) {
      problems.push(`${path}: expected a step object`)
      return
    }
    const s = step as Record<string, unknown>
    switch (s.action) {
      case 'goto':
        if (typeof s.url !== 'string' || !s.url) problems.push(`${path}.url: required non-empty string`)
        break
      case 'click':
        validateLocator(s.locator, `${path}.locator`, problems)
        if (s.onlyIfVisible !== undefined && typeof s.onlyIfVisible !== 'boolean') {
          problems.push(`${path}.onlyIfVisible: must be a boolean when present`)
        }
        if (s.retryOnFlake !== undefined && typeof s.retryOnFlake !== 'boolean') {
          problems.push(`${path}.retryOnFlake: must be a boolean when present`)
        }
        if (s.expectAnyVisible !== undefined) {
          if (!Array.isArray(s.expectAnyVisible)) {
            problems.push(`${path}.expectAnyVisible: must be an array of locators when present`)
          } else {
            s.expectAnyVisible.forEach((loc, j) => validateLocator(loc, `${path}.expectAnyVisible[${j}]`, problems))
          }
        }
        if (s.timeoutMs !== undefined && typeof s.timeoutMs !== 'number') {
          problems.push(`${path}.timeoutMs: must be a number when present`)
        }
        break
      case 'fill':
        validateLocator(s.locator, `${path}.locator`, problems)
        if (typeof s.value !== 'string') problems.push(`${path}.value: required string`)
        if (s.onlyIfVisible !== undefined && typeof s.onlyIfVisible !== 'boolean') {
          problems.push(`${path}.onlyIfVisible: must be a boolean when present`)
        }
        break
      case 'waitForUrl':
        if (typeof s.startsWith !== 'string' || !s.startsWith) {
          problems.push(`${path}.startsWith: required non-empty string`)
        }
        if (s.timeoutMs !== undefined && typeof s.timeoutMs !== 'number') {
          problems.push(`${path}.timeoutMs: must be a number when present`)
        }
        break
      case 'waitForVisible':
        validateLocator(s.locator, `${path}.locator`, problems)
        if (s.timeoutMs !== undefined && typeof s.timeoutMs !== 'number') {
          problems.push(`${path}.timeoutMs: must be a number when present`)
        }
        break
      default:
        problems.push(`${path}.action: unknown action ${JSON.stringify(s.action)}`)
    }
  })

  return problems
}

/**
 * Interpolate `{base}` and `{env:NAME}` / `{env:NAME|fallback}` placeholders in a
 * template string. `{env:NAME}` resolves via ctx.env(NAME); when unset and a
 * `|fallback` is given, the fallback is used; when unset with no fallback the
 * placeholder is replaced with an empty string.
 */
export function interpolate(template: string, ctx: { base: string; env: (name: string) => string | undefined }): string {
  return template
    .replace(/\{base\}/g, ctx.base)
    .replace(/\{env:([A-Za-z_][A-Za-z0-9_]*)(?:\|([^}]*))?\}/g, (_match, name: string, fallback: string | undefined) => {
      const value = ctx.env(name)
      if (value !== undefined && value !== '') return value
      return fallback ?? ''
    })
}
