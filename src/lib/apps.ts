// App registry — now backed by data/apps.json so apps can be added, edited and
// archived at runtime from the UI. All accessors stay SYNCHRONOUS so the many
// server consumers (layouts, server pages, API routes, lib/ai.ts, lib/modules.ts)
// keep working unchanged. Client components must NOT import this file — they read
// apps from GET /api/apps via the useApps() hook in lib/use-apps.ts.

import fs from 'fs'
import path from 'path'
import { AppConfig } from './app-types'
import { getDataRoot } from './paths'

export type { AppConfig } from './app-types'

function appsFile(): string {
  return path.join(getDataRoot(), 'apps.json')
}

// ─── apps.json write guard ──────────────────────────────────────────────────
// createApp/updateApp and getAllApps()'s write-on-missing-file path all do a
// read-modify-write of data/apps.json. All accessors in this file are
// intentionally synchronous (see the module comment above — dozens of call
// sites across the app depend on that), so unlike automation-hub/store.ts and
// lib/execution.ts this can't use a promise-chain mutex without turning every
// caller async. It doesn't need one either: none of these functions contain an
// `await`/async gap, so Node's single-threaded event loop can never interleave
// two top-level calls into this module — the read-modify-write is already
// atomic within one process. `withAppsLock` documents/marks those critical
// sections (createApp and updateApp legitimately nest — e.g. createApp calls
// getAllApps, which may itself take the lock to lazily create a missing file —
// so this is a re-entrant depth counter, not a hard mutex).
let appsLockDepth = 0
function withAppsLock<T>(fn: () => T): T {
  appsLockDepth++
  try {
    return fn()
  } finally {
    appsLockDepth--
  }
}

function isAppConfig(x: unknown): x is AppConfig {
  if (!x || typeof x !== 'object') return false
  const a = x as Record<string, unknown>
  return (
    typeof a.slug === 'string' &&
    typeof a.name === 'string' &&
    typeof a.enabled === 'boolean' &&
    typeof a.capabilities === 'object' &&
    a.capabilities !== null
  )
}

/** Read the registry from disk. A missing/empty apps.json means zero apps; never throws. */
export function getAllApps(): AppConfig[] {
  const file = appsFile()
  try {
    if (!fs.existsSync(file)) {
      withAppsLock(() => saveApps([]))
      return []
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (!Array.isArray(parsed)) {
      console.warn(`[apps] ${file} exists but is not a JSON array — treating as zero apps. Fix or delete the file.`)
      return []
    }
    return parsed.filter(isAppConfig)
  } catch (err) {
    console.warn(`[apps] ${file} exists but could not be parsed — treating as zero apps. Fix or delete the file. (${err})`)
    return []
  }
}

/** Persist the registry to disk (UTF-8, no BOM). */
export function saveApps(apps: AppConfig[]): void {
  const file = appsFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(apps, null, 2), 'utf-8')
}

/** Find an app by slug (enabled or archived) — matches the legacy getApp() contract. */
export function getApp(slug: string): AppConfig | undefined {
  return getAllApps().find((a) => a.slug === slug)
}

/** Only active apps — used for the switcher, dashboards and validation. */
export function getEnabledApps(): AppConfig[] {
  return getAllApps().filter((a) => a.enabled)
}

/** Create a new app. Throws if the slug already exists. */
export function createApp(config: AppConfig): AppConfig {
  return withAppsLock(() => {
    const apps = getAllApps()
    if (apps.some((a) => a.slug === config.slug)) {
      throw Object.assign(new Error(`App "${config.slug}" already exists`), { status: 409 })
    }
    apps.push(config)
    saveApps(apps)
    return config
  })
}

/** Patch an existing app's editable fields. Slug is immutable. Throws if not found. */
export function updateApp(
  slug: string,
  patch: Partial<Omit<AppConfig, 'slug'>>
): AppConfig {
  return withAppsLock(() => {
    const apps = getAllApps()
    const idx = apps.findIndex((a) => a.slug === slug)
    if (idx === -1) throw Object.assign(new Error('App not found'), { status: 404 })
    const merged: AppConfig = {
      ...apps[idx],
      ...patch,
      slug, // never change the slug
      capabilities: { ...apps[idx].capabilities, ...(patch.capabilities ?? {}) },
    }
    apps[idx] = merged
    saveApps(apps)
    return merged
  })
}

/** Archive (enabled=false) or restore (enabled=true) an app without deleting data. */
export function setAppEnabled(slug: string, enabled: boolean): AppConfig {
  return updateApp(slug, { enabled })
}
