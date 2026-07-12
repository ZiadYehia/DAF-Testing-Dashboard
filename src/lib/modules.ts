import fs from 'fs'
import path from 'path'
import { getDataRoot } from './paths'

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

// Route wrappers live in the source tree, not DATA_ROOT
function routesRoot(): string {
  return path.join(process.cwd(), 'src', 'app', '[app]')
}

export function slugIsValid(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug)
}

export function listModules(appSlug: string): ModuleManifest[] {
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

export function getModule(appSlug: string, slug: string): ModuleManifest | null {
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

export function writeModule(appSlug: string, manifest: ModuleManifest): void {
  const dir = path.join(modulesDir(appSlug), manifest.slug)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'module.json'), JSON.stringify(manifest, null, 2), 'utf-8')
}

export function deleteModule(appSlug: string, slug: string): void {
  fs.rmSync(path.join(modulesDir(appSlug), slug), { recursive: true, force: true })
}

// Removes the 8 Next.js route wrapper files for a module.
// Guards against empty pathPrefix to never touch app-level routes.
export function removeModuleRoutes(pathPrefix: string): void {
  if (!pathPrefix) return
  fs.rmSync(path.join(routesRoot(), pathPrefix), { recursive: true, force: true })
}

// Generates the 8 Next.js route wrappers for a module under src/app/[app]/{pathPrefix}/.
// Skips files that already exist so re-running (e.g. defensive heal on PUT) is safe.
export function scaffoldModuleRoutes(
  _appSlug: string,
  slug: string,
  pathPrefix: string,
  moduleName: string
): void {
  const base = path.join(routesRoot(), pathPrefix)

  function writeIfMissing(file: string, content: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, content, 'utf-8')
    }
  }

  const pascalName = slug.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')

  // 1. features/page.tsx — real component (the only non-re-export)
  writeIfMissing(path.join(base, 'features', 'page.tsx'), buildFeaturesPage(slug, moduleName, pascalName))

  // 2–8. One-liner re-exports — bracket dirs are literal directory names
  writeIfMissing(path.join(base, 'features', 'new', 'page.tsx'),                    "export { default } from '@/app/[app]/features/new/page'\n")
  writeIfMissing(path.join(base, 'features', '[name]', 'page.tsx'),                 "export { default } from '@/app/[app]/features/[name]/page'\n")
  writeIfMissing(path.join(base, 'bugs', 'page.tsx'),                               "export { default } from '@/app/[app]/bugs/page'\n")
  writeIfMissing(path.join(base, 'bugs', 'new', 'page.tsx'),                        "export { default } from '@/app/[app]/bugs/new/page'\n")
  writeIfMissing(path.join(base, 'bugs', '[feature]', '[slug]', 'page.tsx'),        "export { default } from '@/app/[app]/bugs/[feature]/[slug]/page'\n")
  writeIfMissing(path.join(base, 'board', 'page.tsx'),                              "export { default } from '@/app/[app]/board/page'\n")
  writeIfMissing(path.join(base, 'requirements', 'page.tsx'),                       "export { default } from '@/app/[app]/requirements/page'\n")
  writeIfMissing(path.join(base, 'knowledge', 'page.tsx'),                          "export { default } from '@/app/[app]/knowledge/page'\n")
}

function buildFeaturesPage(_slug: string, _name: string, _pascalName: string): string {
  return "export { default } from '@/app/[app]/features/page'\n"
}
