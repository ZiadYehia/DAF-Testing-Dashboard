import fs from 'fs'
import path from 'path'
import { getDataRoot } from './paths'
import { getDataSource } from './db'
import { ModuleEntity, IModule } from './entities'

export interface ModuleManifest {
  slug: string
  name: string
  icon: string       // lucide icon name, e.g. "Shield", "Layers"
  order: number
  pathPrefix: string // URL path segment: "" for the default module, "framework" for /[app]/framework/...
  description?: string
}

function modulesDir(appSlug: string): string {
  return path.join(getDataRoot(), appSlug, 'modules')
}

export function slugIsValid(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug)
}

// ─── FS fallback (also the write-through target — see writeModule/deleteModule) ─

function listModulesFs(appSlug: string): ModuleManifest[] {
  const dir = modulesDir(appSlug)
  if (!fs.existsSync(dir)) return []

  const modules: ModuleManifest[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = path.join(dir, entry.name, 'module.json')
    if (!fs.existsSync(manifestPath)) continue
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ModuleManifest
      if (typeof manifest.pathPrefix !== 'string') manifest.pathPrefix = manifest.slug
      modules.push(manifest)
    } catch {
      // skip malformed manifests
    }
  }

  return modules.sort((a, b) => a.order - b.order)
}

function getModuleFs(appSlug: string, slug: string): ModuleManifest | null {
  const manifestPath = path.join(modulesDir(appSlug), slug, 'module.json')
  if (!fs.existsSync(manifestPath)) return null
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ModuleManifest
    if (typeof manifest.pathPrefix !== 'string') manifest.pathPrefix = manifest.slug
    return manifest
  } catch {
    return null
  }
}

function rowToManifest(row: IModule): ModuleManifest {
  return {
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    order: row.sortOrder,
    pathPrefix: row.pathPrefix,
    description: row.description ?? undefined,
  }
}

/**
 * List a app's modules. DB-first: reads the `modules` table (ordered by
 * sortOrder). Falls back to scanning module.json files — same behavior as
 * before the DB migration — when the DB throws or returns zero rows (not yet
 * seeded for this app).
 */
export async function listModules(appSlug: string): Promise<ModuleManifest[]> {
  try {
    const ds = await getDataSource()
    const rows = await ds
      .getRepository<IModule>(ModuleEntity)
      .find({ where: { appSlug }, order: { sortOrder: 'ASC' } })
    if (rows.length > 0) return rows.map(rowToManifest)
  } catch (err) {
    console.warn(`[modules] DB read failed for listModules("${appSlug}") — falling back to module.json scan (${err})`)
  }
  return listModulesFs(appSlug)
}

/**
 * Find one module by slug. DB-first, same pattern as listModules: reads the
 * `modules` row and falls back to scanning module.json when the DB throws or
 * has no matching row (not yet seeded for this app). Async — callers (ai.ts,
 * the admin modules API routes) now await it.
 */
export async function getModule(appSlug: string, slug: string): Promise<ModuleManifest | null> {
  try {
    const ds = await getDataSource()
    const row = await ds.getRepository<IModule>(ModuleEntity).findOne({ where: { appSlug, slug } })
    if (row) return rowToManifest(row)
  } catch (err) {
    console.warn(`[modules] DB read failed for getModule("${appSlug}/${slug}") — falling back to module.json (${err})`)
  }
  return getModuleFs(appSlug, slug)
}

/** Create/update a module. Write-through: module.json is written first (the
 *  source of truth for the sync getModule() read path), then the `modules`
 *  row is upserted non-fatally — a DB write failure never fails the request,
 *  since the FS write already succeeded. */
export async function writeModule(appSlug: string, manifest: ModuleManifest): Promise<void> {
  const dir = path.join(modulesDir(appSlug), manifest.slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'module.json'), JSON.stringify(manifest, null, 2), 'utf-8')

  try {
    const ds = await getDataSource()
    const repo = ds.getRepository<IModule>(ModuleEntity)
    const existing = await repo.findOne({ where: { appSlug, slug: manifest.slug } })
    const row: Partial<IModule> = {
      appSlug,
      slug: manifest.slug,
      name: manifest.name,
      icon: manifest.icon,
      sortOrder: manifest.order,
      pathPrefix: manifest.pathPrefix,
      description: manifest.description ?? null,
    }
    if (existing) await repo.update(existing.id, row)
    else await repo.insert(row)
  } catch (err) {
    console.warn(
      `[modules] DB write failed for writeModule("${appSlug}/${manifest.slug}") — module.json fallback still updated (${err})`
    )
  }
}

/** Delete a module. Write-through: removes the module.json directory and the
 *  `modules` row; the DB delete is non-fatal (FS removal already succeeded). */
export async function deleteModule(appSlug: string, slug: string): Promise<void> {
  fs.rmSync(path.join(modulesDir(appSlug), slug), { recursive: true, force: true })

  try {
    const ds = await getDataSource()
    await ds.getRepository<IModule>(ModuleEntity).delete({ appSlug, slug })
  } catch (err) {
    console.warn(`[modules] DB delete failed for deleteModule("${appSlug}/${slug}") — module.json fallback still removed (${err})`)
  }
}

// Module routes are served by the permanent dynamic wrappers under
// src/app/[app]/[prefix]/ — module create/delete are pure data operations.
// (Physical route scaffolding was removed: writing/deleting files under
// src/app while the dev server runs triggered an infinite reload loop.)
