import fs from 'fs'
import path from 'path'
import { getDataRoot } from './paths'

export interface KnowledgeFile {
  filename: string
  title: string
  size: number
}

// Resolves the knowledge directory for a given module:
// - null / undefined → app-level: data/{app}/knowledge/
// - any module slug → canonical: data/{app}/modules/{module}/knowledge/
//   with legacy fallback for "framework" → data/{app}/knowledge-framework/
function knowledgeDir(appSlug: string, module?: string | null): string {
  if (!module) {
    return path.join(getDataRoot(), appSlug, 'knowledge')
  }
  // Prevent path traversal
  if (module.includes('..') || module.includes('/') || module.includes('\\') || path.isAbsolute(module)) {
    throw new Error('Invalid module')
  }
  const canonical = path.join(getDataRoot(), appSlug, 'modules', module, 'knowledge')
  if (fs.existsSync(canonical)) return canonical
  // Legacy fallback: framework module used to live in knowledge-framework/
  if (module === 'framework') {
    const legacy = path.join(getDataRoot(), appSlug, 'knowledge-framework')
    if (fs.existsSync(legacy)) return legacy
  }
  return canonical // return canonical even if absent — writes will create it
}

// ─── Module-aware loaders (used by ai.ts for prompt building) ─────────────────

/** Reads the module field from a feature's metadata.json. Returns null if not set. */
export function getFeatureModule(appSlug: string, featureName: string): string | null {
  const metaFile = path.join(getDataRoot(), appSlug, 'features', featureName, 'metadata.json')
  if (!fs.existsSync(metaFile)) return null
  try {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as { module?: string | null }
    return meta.module ?? null
  } catch {
    return null
  }
}

/** Concatenates all .md files in the app-level knowledge/ directory. */
export function loadAppKnowledge(appSlug: string): string {
  const dir = path.join(getDataRoot(), appSlug, 'knowledge')
  if (!fs.existsSync(dir)) return ''
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
  return files.map((f) => fs.readFileSync(path.join(dir, f), 'utf-8')).join('\n\n---\n\n')
}

/** Concatenates all .md files in a module's knowledge directory. Returns '' if no module or dir. */
export function loadModuleKnowledge(appSlug: string, module: string | null): string {
  if (!module) return ''
  const dir = knowledgeDir(appSlug, module)
  if (!fs.existsSync(dir)) return ''
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
  return files.map((f) => fs.readFileSync(path.join(dir, f), 'utf-8')).join('\n\n---\n\n')
}

// ─── Standard CRUD ───────────────────────────────────────────────────────────

export function listKnowledgeFiles(appSlug: string, module?: string | null): KnowledgeFile[] {
  const dir = knowledgeDir(appSlug, module)
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((filename) => {
      const fullPath = path.join(dir, filename)
      const content = fs.readFileSync(fullPath, 'utf-8')
      const firstHeading = content.match(/^#+ (.+)$/m)
      const stats = fs.statSync(fullPath)
      return {
        filename,
        title: firstHeading ? firstHeading[1] : filename.replace(/\.md$/, ''),
        size: stats.size,
      }
    })
}

export function readKnowledgeFile(appSlug: string, filename: string, module?: string | null): string {
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename')
  }
  const filePath = path.join(knowledgeDir(appSlug, module), filename)
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filename}`)
  return fs.readFileSync(filePath, 'utf-8')
}

/**
 * Write a knowledge file. By default the file must already exist (edit-only);
 * pass `allowCreate` to create a new file (used by the Module Knowledge synthesizer).
 */
export function writeKnowledgeFile(
  appSlug: string,
  filename: string,
  content: string,
  opts: { allowCreate?: boolean; module?: string | null } = {}
): void {
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename')
  }
  if (!filename.endsWith('.md')) throw new Error('Only .md files are allowed')
  const dir = knowledgeDir(appSlug, opts.module)
  const filePath = path.join(dir, filename)
  if (!fs.existsSync(filePath) && !opts.allowCreate) {
    throw new Error(`File not found: ${filename}`)
  }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}
