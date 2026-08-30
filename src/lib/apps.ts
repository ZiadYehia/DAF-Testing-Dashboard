// App registry — DB-first (the `apps` table, see src/lib/entities.ts) with a
// data/apps.json fallback for when the DB is unreachable or hasn't been
// seeded yet. All accessors are ASYNC — every caller across layouts, server
// pages, API routes, and lib modules (ai.ts, auth.ts, intake.ts) awaits them.
// Client components must NOT import this file — they read apps from
// GET /api/apps via the useApps() hook in lib/use-apps.ts.
//
// Writes (createApp/updateApp/setAppEnabled) are write-through this phase:
// the DB row becomes the primary record, but apps.json is kept in sync too so
// the FS fallback never goes stale and anything still reading the file (or a
// future export) keeps working. A later phase can drop the FS side.

import fs from 'fs'
import path from 'path'
import { AppConfig } from './app-types'
import { getDataRoot } from './paths'
import { getDataSource } from './db'
import { AppEntity, IApp } from './entities'

export type { AppConfig } from './app-types'

function appsFile(): string {
  return path.join(getDataRoot(), 'apps.json')
}

// ─── apps.json write guard ──────────────────────────────────────────────────
// createApp/updateApp read-modify-write both the DB row and data/apps.json.
// Every function here now awaits the DB (getDataSource + repo calls), so —
// unlike the old fully-synchronous version of this file — two calls landing
// close together CAN interleave across those await points and race the
// read-modify-write. Serialize with a promise chain, the same pattern
// lib/execution.ts uses for its execution-status.json mutex.
let appsLock: Promise<unknown> = Promise.resolve()
function withAppsLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = appsLock.then(fn, fn)
  appsLock = run.then(
    () => undefined,
    () => undefined
  )
  return run
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

// ─── FS fallback ─────────────────────────────────────────────────────────────

/** Read the registry straight from disk. A missing/empty apps.json means zero apps; never throws. */
function readAppsFromFs(): AppConfig[] {
  const file = appsFile()
  try {
    if (!fs.existsSync(file)) {
      saveApps([])
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

/** Persist the full registry to disk (UTF-8, no BOM). Also the FS half of the createApp/updateApp write-through. */
export function saveApps(apps: AppConfig[]): void {
  const file = appsFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(apps, null, 2), 'utf-8')
}

// ─── DB row <-> AppConfig mapping ───────────────────────────────────────────

/** Parse the DB row's `capabilities` JSON column. A malformed value degrades to an empty object rather than failing the whole list. */
function parseCapabilities(json: string): AppConfig['capabilities'] {
  try {
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === 'object') return parsed as AppConfig['capabilities']
  } catch {
    // malformed JSON in the DB row — tolerate, don't fail the whole list
  }
  return {} as AppConfig['capabilities']
}

function rowToAppConfig(row: IApp): AppConfig {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    enabled: row.enabled,
    type: row.type as AppConfig['type'],
    platform: row.platform,
    capabilities: parseCapabilities(row.capabilities),
  }
}

function appConfigToRow(config: AppConfig): Partial<IApp> {
  return {
    slug: config.slug,
    name: config.name,
    description: config.description,
    icon: config.icon,
    enabled: config.enabled,
    type: config.type,
    platform: config.platform,
    capabilities: JSON.stringify(config.capabilities ?? {}),
    updatedAt: new Date(),
  }
}

/** True for the mssql unique-violation errors TypeORM surfaces on the `UQ_apps_slug` index. */
function isDuplicateSlugError(err: unknown): boolean {
  const e = err as { number?: number; driverError?: { number?: number }; message?: string } | null | undefined
  const num = e?.number ?? e?.driverError?.number
  if (num === 2627 || num === 2601) return true
  return typeof e?.message === 'string' && /UQ_apps_slug/i.test(e.message)
}

function duplicateSlugError(slug: string) {
  return Object.assign(new Error(`App "${slug}" already exists`), { status: 409 })
}

function appNotFoundError() {
  return Object.assign(new Error('App not found'), { status: 404 })
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * Read the registry. DB-first: reads the `apps` table ordered by id. Falls
 * back to data/apps.json — same behavior as before the DB migration — when
 * the DB throws (down/unreachable) or returns zero rows (not yet seeded).
 */
export async function getAllApps(): Promise<AppConfig[]> {
  try {
    const ds = await getDataSource()
    const rows = await ds.getRepository<IApp>(AppEntity).find({ order: { id: 'ASC' } })
    if (rows.length > 0) return rows.map(rowToAppConfig)
  } catch (err) {
    console.warn(`[apps] DB read failed — falling back to apps.json (${err})`)
  }
  return readAppsFromFs()
}

/** Find an app by slug (enabled or archived) — matches the legacy getApp() contract. */
export async function getApp(slug: string): Promise<AppConfig | undefined> {
  return (await getAllApps()).find((a) => a.slug === slug)
}

/** Only active apps — used for the switcher, dashboards and validation. */
export async function getEnabledApps(): Promise<AppConfig[]> {
  return (await getAllApps()).filter((a) => a.enabled)
}

// ─── Writes (write-through: DB + apps.json) ─────────────────────────────────

/** Create a new app. Throws { status: 409 } if the slug already exists (DB or FS). */
export async function createApp(config: AppConfig): Promise<AppConfig> {
  return withAppsLock(async () => {
    const existing = await getAllApps()
    if (existing.some((a) => a.slug === config.slug)) {
      throw duplicateSlugError(config.slug)
    }

    try {
      const ds = await getDataSource()
      await ds.getRepository<IApp>(AppEntity).insert(appConfigToRow(config))
    } catch (err) {
      if (isDuplicateSlugError(err)) throw duplicateSlugError(config.slug)
      console.warn(`[apps] DB write failed for createApp("${config.slug}") — apps.json fallback still updated (${err})`)
    }

    const apps = readAppsFromFs()
    apps.push(config)
    saveApps(apps)

    return config
  })
}

/** Patch an existing app's editable fields. Slug is immutable. Throws { status: 404 } if not found. */
export async function updateApp(
  slug: string,
  patch: Partial<Omit<AppConfig, 'slug'>>
): Promise<AppConfig> {
  return withAppsLock(async () => {
    const apps = await getAllApps()
    const idx = apps.findIndex((a) => a.slug === slug)
    if (idx === -1) throw appNotFoundError()
    const merged: AppConfig = {
      ...apps[idx],
      ...patch,
      slug, // never change the slug
      capabilities: { ...apps[idx].capabilities, ...(patch.capabilities ?? {}) },
    }

    try {
      const ds = await getDataSource()
      const repo = ds.getRepository<IApp>(AppEntity)
      const row = await repo.findOne({ where: { slug } })
      if (row) await repo.save({ ...row, ...appConfigToRow(merged) })
      else await repo.insert(appConfigToRow(merged))
    } catch (err) {
      console.warn(`[apps] DB write failed for updateApp("${slug}") — apps.json fallback still updated (${err})`)
    }

    const fsApps = readAppsFromFs()
    const fsIdx = fsApps.findIndex((a) => a.slug === slug)
    if (fsIdx === -1) fsApps.push(merged)
    else fsApps[fsIdx] = merged
    saveApps(fsApps)

    return merged
  })
}

/** Archive (enabled=false) or restore (enabled=true) an app without deleting data. */
export async function setAppEnabled(slug: string, enabled: boolean): Promise<AppConfig> {
  return updateApp(slug, { enabled })
}
