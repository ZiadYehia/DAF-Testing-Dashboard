import fs from 'fs'
import path from 'path'
import { getDataRoot } from './paths'
import { getDataSource } from './db'
import { IKnowledgeFile, KnowledgeFileEntity } from './entities'
import { MARKER } from './intake'

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

// ─── DB helpers ───────────────────────────────────────────────────────────────
//
// Explicit `IS NULL` SQL (via createQueryBuilder) rather than the IsNull()
// FindOperator: under Turbopack the operator can be built from a different
// typeorm module instance than the DataSource uses, so its `instanceof`
// check fails and it gets bound as a literal param ("Validation failed for
// parameter") — see the equivalent comments in features.ts / bugs.ts.

function knowledgeRowsQuery(appSlug: string, module: string | null) {
  return getDataSource().then((ds) => {
    const qb = ds
      .getRepository<IKnowledgeFile>(KnowledgeFileEntity)
      .createQueryBuilder('k')
      .where('k.appSlug = :appSlug', { appSlug })
      .andWhere("k.docType = 'knowledge'")
    if (module === null) qb.andWhere('k.module IS NULL')
    else qb.andWhere('k.module = :module', { module })
    return qb
  })
}

/**
 * Fetch all knowledge_files rows for a scope (app-level when module is null).
 * Exported for context.ts, which needs per-file rows (not the concatenated
 * string loadAppKnowledge/loadModuleKnowledge return) to preserve front-matter
 * typing/priority per doc.
 */
export async function fetchKnowledgeRows(appSlug: string, module: string | null): Promise<IKnowledgeFile[]> {
  const qb = await knowledgeRowsQuery(appSlug, module)
  return qb.orderBy('k.filename', 'ASC').getMany()
}

/**
 * Fetch every docType='knowledge' row for an app across all scopes (app-level
 * plus every module), ordered by module then filename. Exported for
 * knowledge-gaps.ts, which needs to enumerate all module scopes that have
 * knowledge docs without knowing their slugs up front.
 */
export async function fetchAllKnowledgeRows(appSlug: string): Promise<IKnowledgeFile[]> {
  const ds = await getDataSource()
  return ds
    .getRepository<IKnowledgeFile>(KnowledgeFileEntity)
    .createQueryBuilder('k')
    .where('k.appSlug = :appSlug', { appSlug })
    .andWhere("k.docType = 'knowledge'")
    .orderBy('k.module', 'ASC')
    .addOrderBy('k.filename', 'ASC')
    .getMany()
}

/** Fetch a single knowledge_files row by filename within a scope. */
async function fetchKnowledgeRow(
  appSlug: string,
  filename: string,
  module: string | null
): Promise<IKnowledgeFile | null> {
  const qb = await knowledgeRowsQuery(appSlug, module)
  qb.andWhere('k.filename = :filename', { filename })
  return qb.getOne()
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

/** FS fallback: concatenates all .md files in the app-level knowledge/ directory. */
function loadAppKnowledgeFs(appSlug: string): string {
  const dir = path.join(getDataRoot(), appSlug, 'knowledge')
  if (!fs.existsSync(dir)) return ''
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
  return files.map((f) => fs.readFileSync(path.join(dir, f), 'utf-8')).join('\n\n---\n\n')
}

/** Concatenates all .md files in the app-level knowledge/ directory. DB-first, FS fallback. */
export async function loadAppKnowledge(appSlug: string): Promise<string> {
  try {
    const rows = await fetchKnowledgeRows(appSlug, null)
    if (rows.length > 0) return rows.map((r) => r.content).join('\n\n---\n\n')
  } catch {
    // fall through to FS
  }
  return loadAppKnowledgeFs(appSlug)
}

/** FS fallback: concatenates all .md files in a module's knowledge directory. */
function loadModuleKnowledgeFs(appSlug: string, module: string): string {
  const dir = knowledgeDir(appSlug, module)
  if (!fs.existsSync(dir)) return ''
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
  return files.map((f) => fs.readFileSync(path.join(dir, f), 'utf-8')).join('\n\n---\n\n')
}

/** Concatenates all .md files in a module's knowledge directory. Returns '' if no module or dir. */
export async function loadModuleKnowledge(appSlug: string, module: string | null): Promise<string> {
  if (!module) return ''
  try {
    const rows = await fetchKnowledgeRows(appSlug, module)
    if (rows.length > 0) return rows.map((r) => r.content).join('\n\n---\n\n')
  } catch {
    // fall through to FS
  }
  return loadModuleKnowledgeFs(appSlug, module)
}

// ─── Standard CRUD ───────────────────────────────────────────────────────────

function titleFor(filename: string, content: string): string {
  const firstHeading = content.match(/^#+ (.+)$/m)
  return firstHeading ? firstHeading[1] : filename.replace(/\.md$/, '')
}

/** FS fallback for listKnowledgeFiles. */
function listKnowledgeFilesFs(appSlug: string, module?: string | null): KnowledgeFile[] {
  const dir = knowledgeDir(appSlug, module)
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((filename) => {
      const fullPath = path.join(dir, filename)
      const content = fs.readFileSync(fullPath, 'utf-8')
      const stats = fs.statSync(fullPath)
      return {
        filename,
        title: titleFor(filename, content),
        size: stats.size,
      }
    })
}

export async function listKnowledgeFiles(appSlug: string, module?: string | null): Promise<KnowledgeFile[]> {
  const mod = module ?? null
  try {
    const rows = await fetchKnowledgeRows(appSlug, mod)
    if (rows.length > 0) {
      return rows.map((row) => ({
        filename: row.filename,
        title: titleFor(row.filename, row.content),
        size: Buffer.byteLength(row.content, 'utf-8'),
      }))
    }
  } catch {
    // fall through to FS
  }
  return listKnowledgeFilesFs(appSlug, mod)
}

/** FS fallback for readKnowledgeFile. */
function readKnowledgeFileFs(appSlug: string, filename: string, module?: string | null): string {
  const filePath = path.join(knowledgeDir(appSlug, module), filename)
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filename}`)
  return fs.readFileSync(filePath, 'utf-8')
}

export async function readKnowledgeFile(appSlug: string, filename: string, module?: string | null): Promise<string> {
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename')
  }
  const mod = module ?? null
  try {
    const row = await fetchKnowledgeRow(appSlug, filename, mod)
    if (row) return row.content
  } catch {
    // fall through to FS
  }
  return readKnowledgeFileFs(appSlug, filename, mod)
}

/**
 * Write a knowledge file. By default the file must already exist (edit-only);
 * pass `allowCreate` to create a new file (used by the Module Knowledge synthesizer).
 *
 * Write-through: the FS file is written (source of truth this phase for the
 * fallback path) and the DB row is upserted non-fatally — a DB write failure
 * does not fail the request, since the FS write already succeeded.
 */
export async function writeKnowledgeFile(
  appSlug: string,
  filename: string,
  content: string,
  opts: { allowCreate?: boolean; module?: string | null } = {}
): Promise<void> {
  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename')
  }
  if (!filename.endsWith('.md')) throw new Error('Only .md files are allowed')
  const mod = opts.module ?? null
  const dir = knowledgeDir(appSlug, mod)
  const filePath = path.join(dir, filename)
  if (!fs.existsSync(filePath) && !opts.allowCreate) {
    throw new Error(`File not found: ${filename}`)
  }

  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')

  try {
    const ds = await getDataSource()
    const repo = ds.getRepository<IKnowledgeFile>(KnowledgeFileEntity)
    const existing = await fetchKnowledgeRow(appSlug, filename, mod)
    if (existing) {
      // Omit generatedFromIntake from the update payload — preserves whatever
      // value the row already has instead of re-deriving it on every edit.
      await repo.update(existing.id, { content, updatedAt: new Date() })
    } else {
      await repo.save({
        appSlug,
        filename,
        content,
        module: mod,
        docType: 'knowledge',
        generatedFromIntake: content.includes(MARKER),
        updatedAt: new Date(),
      } as unknown as IKnowledgeFile)
    }
  } catch {
    // Non-fatal — FS write above already succeeded
  }
}
