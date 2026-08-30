/**
 * Idempotent import — migrates existing filesystem data into the database.
 * Safe to re-run: every write is either "insert only if the row is missing"
 * or "fill a NULL/empty column on an existing row" — an existing non-null DB
 * value is NEVER overwritten. Post-cutover the DB is the newer, authoritative
 * copy; the filesystem is a one-way seed source, not something to reconcile
 * back onto rows the app has since edited.
 *
 * Run with:  npm run db:import   (alias: npm run db:backfill)
 *
 * Flags:
 *   --app <slug>       Only import the given app.
 *   --dry-run          Print planned insert/fill counts per concept; no writes.
 *   --verify-binaries  After importing, verify every screenshots/attachments
 *                       row has its file on disk under DATA_ROOT. Prints
 *                       orphans and exits 1 if any are found.
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { IsNull } from 'typeorm'
import { AppDataSource } from '../data-source'
import { Bug } from '../entities/Bug'
import { Feature } from '../entities/Feature'
import { AcceptanceCriterion } from '../entities/AcceptanceCriterion'
import { TestcaseVersion } from '../entities/TestcaseVersion'
import { StoryLink } from '../entities/StoryLink'
import { UserStory } from '../entities/UserStory'
import { Requirement } from '../entities/Requirement'
import { KnowledgeFile } from '../entities/KnowledgeFile'
import { TestExecution } from '../entities/TestExecution'
import { Screenshot } from '../entities/Screenshot'
import { Attachment } from '../entities/Attachment'
import { App } from '../entities/App'
import { Module } from '../entities/Module'
import { IntakeDocument } from '../entities/IntakeDocument'
import { AutomationConfig } from '../entities/AutomationConfig'

// ─── CLI flags ────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { appFilter?: string; dryRun: boolean; verifyBinaries: boolean } {
  const appIdx = argv.indexOf('--app')
  const appFilter = appIdx !== -1 ? argv[appIdx + 1] : undefined
  return {
    appFilter,
    dryRun: argv.includes('--dry-run'),
    verifyBinaries: argv.includes('--verify-binaries'),
  }
}

const { appFilter: APP_FILTER, dryRun: DRY_RUN, verifyBinaries: VERIFY_BINARIES } = parseArgs(process.argv.slice(2))

// ─── Config ────────────────────────────────────────────────────────────────────

const DATA_ROOT =
  process.env.DATA_ROOT ?? path.resolve(__dirname, '..', '..', '..', 'data')

// Mirrors src/lib/intake.ts's MARKER — duplicated rather than imported because
// this script lives under database/ (its own tsconfig rootDir) and intake.ts
// pulls in server-only Next.js-adjacent modules. Keep these two in sync.
const INTAKE_MARKER = '<!-- generated-from-intake -->'

// Mirrors src/lib/features.ts's MIME_TYPES (image subset only — screenshots
// dirs only ever contain these per the existing `/\.(png|jpg|jpeg|gif|webp)$/i` filter).
const SCREENSHOT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

// Mirrors src/lib/bugs.ts's ATTACHMENT_MIME.
const ATTACHMENT_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
}

// ─── Per-concept counters ────────────────────────────────────────────────────
// `inserted` = brand-new rows created. `filled` = an existing row had a
// null/empty column populated. `skipped` = a row already fully present, left
// untouched. In --dry-run these reflect what WOULD happen — reads still run
// (needed to know what's missing), writes are just suppressed.

interface ConceptStats { inserted: number; filled: number; skipped: number }
const stats = new Map<string, ConceptStats>()
function statFor(concept: string): ConceptStats {
  let s = stats.get(concept)
  if (!s) { s = { inserted: 0, filled: 0, skipped: 0 }; stats.set(concept, s) }
  return s
}
function recordInsert(concept: string, n = 1): void { statFor(concept).inserted += n }
function recordFill(concept: string, n = 1): void { statFor(concept).filled += n }
function recordSkip(concept: string, n = 1): void { statFor(concept).skipped += n }

/** Insert-only pattern: skip entirely if a row already exists for this key. */
async function insertIfMissing(
  concept: string,
  exists: boolean,
  doInsert: () => Promise<void>
): Promise<void> {
  if (exists) { recordSkip(concept); return }
  if (!DRY_RUN) await doInsert()
  recordInsert(concept)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8')
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}

function hasIntakeMarker(content: string): boolean {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  return body.trimStart().startsWith(INTAKE_MARKER)
}

function fileByteSize(filePath: string): number | null {
  try { return fs.statSync(filePath).size } catch { return null }
}

function parseStoryMd(raw: string): { summary: string; description: string } {
  const firstHeading = raw.match(/^#+\s+(.+)$/m)?.[1]?.trim()
  const firstLine = raw.split('\n').find((l) => l.trim().length > 0)?.trim() ?? ''
  const summary = firstHeading || firstLine.replace(/^\*+|\*+$/g, '')
  return { summary, description: raw }
}

function listMdFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
}

function getAppSlugs(): string[] {
  if (!fs.existsSync(DATA_ROOT)) return []
  const all = fs
    .readdirSync(DATA_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  return APP_FILTER ? all.filter((a) => a === APP_FILTER) : all
}

function listModuleSlugs(appSlug: string): string[] {
  const dir = path.join(DATA_ROOT, appSlug, 'modules')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
}

// ─── apps.json → apps ────────────────────────────────────────────────────────

interface AppConfigJson {
  slug: string
  name: string
  description?: string
  icon?: string
  enabled?: boolean
  type?: string
  platform?: string
  capabilities?: Record<string, boolean>
}

async function importApps(): Promise<void> {
  const file = path.join(DATA_ROOT, 'apps.json')
  const parsed = readJson<AppConfigJson[]>(file)
  if (!Array.isArray(parsed)) return

  const repo = AppDataSource.getRepository(App)
  for (const a of parsed) {
    if (!a?.slug) continue
    if (APP_FILTER && a.slug !== APP_FILTER) continue
    const existing = await repo.findOne({ where: { slug: a.slug } })
    // Repair pass: rows written while icon was VARCHAR hold '?' instead of the
    // emoji (mojibake). '?' is never a legitimate icon, so refill from the file.
    if (existing && existing.icon.includes('?') && a.icon && !a.icon.includes('?')) {
      if (!DRY_RUN) await repo.update(existing.id, { icon: a.icon })
      recordFill('apps')
    }
    await insertIfMissing('apps', !!existing, async () => {
      await repo.save({
        slug: a.slug,
        name: a.name ?? a.slug,
        description: a.description ?? '',
        icon: a.icon ?? '',
        enabled: a.enabled ?? true,
        type: a.type ?? 'web',
        platform: a.platform ?? '',
        capabilities: JSON.stringify(a.capabilities ?? {}),
      })
    })
  }
}

// ─── modules/<m>/module.json → modules ────────────────────────────────────────

interface ModuleManifestJson {
  slug: string
  name: string
  icon?: string
  order?: number
  pathPrefix?: string
  description?: string
}

async function importModules(appSlug: string): Promise<void> {
  const repo = AppDataSource.getRepository(Module)
  for (const slug of listModuleSlugs(appSlug)) {
    const manifest = readJson<ModuleManifestJson>(path.join(DATA_ROOT, appSlug, 'modules', slug, 'module.json'))
    if (!manifest) continue
    const existing = await repo.findOne({ where: { appSlug, slug } })
    // Same VARCHAR-era mojibake repair as apps.icon.
    if (existing && existing.icon.includes('?') && manifest.icon && !manifest.icon.includes('?')) {
      if (!DRY_RUN) await repo.update(existing.id, { icon: manifest.icon })
      recordFill('modules')
    }
    await insertIfMissing('modules', !!existing, async () => {
      await repo.save({
        appSlug,
        slug: manifest.slug ?? slug,
        name: manifest.name ?? slug,
        icon: manifest.icon ?? '',
        sortOrder: typeof manifest.order === 'number' ? manifest.order : 0,
        pathPrefix: typeof manifest.pathPrefix === 'string' ? manifest.pathPrefix : slug,
        description: manifest.description ?? null,
      })
    })
  }
}

// ─── intake.json (app / module / feature) → intake_documents ────────────────

interface IntakeFileJson {
  updatedAt?: string
  answers?: Record<string, unknown>
}

async function importOneIntakeDocument(
  appSlug: string,
  scopeKind: 'app' | 'module' | 'feature',
  scopeSlug: string,
  filePath: string
): Promise<void> {
  const parsed = readJson<IntakeFileJson>(filePath)
  if (!parsed) return
  const repo = AppDataSource.getRepository(IntakeDocument)
  const existing = await repo.findOne({ where: { appSlug, scopeKind, scopeSlug } })
  await insertIfMissing('intake-documents', !!existing, async () => {
    await repo.save({
      appSlug,
      scopeKind,
      scopeSlug,
      answers: JSON.stringify(parsed.answers ?? {}),
      updatedAt: typeof parsed.updatedAt === 'string' ? new Date(parsed.updatedAt) : null,
    })
  })
}

async function importIntakeDocuments(appSlug: string): Promise<void> {
  // App scope
  await importOneIntakeDocument(appSlug, 'app', '', path.join(DATA_ROOT, appSlug, 'intake.json'))

  // Module scope
  for (const m of listModuleSlugs(appSlug)) {
    await importOneIntakeDocument(appSlug, 'module', m, path.join(DATA_ROOT, appSlug, 'modules', m, 'intake.json'))
  }

  // Feature scope
  const featDir = path.join(DATA_ROOT, appSlug, 'features')
  if (fs.existsSync(featDir)) {
    for (const entry of fs.readdirSync(featDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      await importOneIntakeDocument(
        appSlug, 'feature', entry.name,
        path.join(featDir, entry.name, 'intake.json')
      )
    }
  }
}

// ─── automation.json → automation_configs ────────────────────────────────────

interface AutomationConfigJson {
  baseUrlEnv?: string
  credentialEnvs?: string[]
  login?: unknown[]
  _generatedFromIntake?: boolean
}

async function importAutomationConfig(appSlug: string): Promise<void> {
  const parsed = readJson<AutomationConfigJson>(path.join(DATA_ROOT, appSlug, 'automation.json'))
  if (!parsed) return
  const repo = AppDataSource.getRepository(AutomationConfig)
  const existing = await repo.findOne({ where: { appSlug } })
  await insertIfMissing('automation-configs', !!existing, async () => {
    await repo.save({
      appSlug,
      baseUrlEnv: parsed.baseUrlEnv ?? '',
      credentialEnvs: JSON.stringify(parsed.credentialEnvs ?? []),
      login: JSON.stringify(parsed.login ?? []),
      generatedFromIntake: parsed._generatedFromIntake === true,
      updatedAt: null,
    })
  })
}

// ─── knowledge_files: app knowledge / bug-format / examples / template / module knowledge ──

async function importKnowledgeFile(
  concept: string,
  appSlug: string,
  moduleSlug: string | null,
  filename: string,
  content: string,
  docType: string
): Promise<void> {
  const repo = AppDataSource.getRepository(KnowledgeFile)
  const where = moduleSlug === null
    ? { appSlug, module: IsNull(), filename }
    : { appSlug, module: moduleSlug, filename }
  const existing = await repo.findOne({ where })
  await insertIfMissing(concept, !!existing, async () => {
    await repo.save({
      appSlug,
      module: moduleSlug,
      filename,
      content,
      docType,
      generatedFromIntake: hasIntakeMarker(content),
      updatedAt: null,
    })
  })
}

/** App-level knowledge/*.md — existing concept, now tagged docType='knowledge' + marker sniff. */
async function importAppKnowledge(appSlug: string): Promise<void> {
  const dir = path.join(DATA_ROOT, appSlug, 'knowledge')
  for (const f of listMdFiles(dir)) {
    await importKnowledgeFile('knowledge-files', appSlug, null, f, readFile(path.join(dir, f)), 'knowledge')
  }
}

/** data/<app>/modules/<m>/knowledge/*.md (with legacy knowledge-framework/ fallback for "framework"). */
async function importModuleKnowledge(appSlug: string): Promise<void> {
  for (const m of listModuleSlugs(appSlug)) {
    const canonical = path.join(DATA_ROOT, appSlug, 'modules', m, 'knowledge')
    let dir = canonical
    if (!fs.existsSync(canonical) && m === 'framework') {
      const legacy = path.join(DATA_ROOT, appSlug, 'knowledge-framework')
      if (fs.existsSync(legacy)) dir = legacy
    }
    for (const f of listMdFiles(dir)) {
      await importKnowledgeFile('module-knowledge-files', appSlug, m, f, readFile(path.join(dir, f)), 'knowledge')
    }
  }
}

/** data/<app>/bug-format.md → knowledge_files docType='bug-format'. */
async function importBugFormatKnowledge(appSlug: string): Promise<void> {
  const file = path.join(DATA_ROOT, appSlug, 'bug-format.md')
  if (!fs.existsSync(file)) return
  await importKnowledgeFile('bug-format', appSlug, null, 'bug-format.md', readFile(file), 'bug-format')
}

/** data/<app>/examples/*.md → knowledge_files docType='example'. */
async function importExampleKnowledge(appSlug: string): Promise<void> {
  const dir = path.join(DATA_ROOT, appSlug, 'examples')
  for (const f of listMdFiles(dir)) {
    await importKnowledgeFile('examples', appSlug, null, f, readFile(path.join(dir, f)), 'example')
  }
}

/** data/<app>/.github/templates/workflow-template.md → knowledge_files docType='template'. */
async function importTemplateKnowledge(appSlug: string): Promise<void> {
  const file = path.join(DATA_ROOT, appSlug, '.github', 'templates', 'workflow-template.md')
  if (!fs.existsSync(file)) return
  await importKnowledgeFile('template', appSlug, null, 'workflow-template.md', readFile(file), 'template')
}

// ─── requirements: root FRs.md + per-module FRs-<module>.md ─────────────────

/** Insert-if-missing, or fill an existing-but-empty `content` column. Never
 *  overwrites a non-empty requirements doc already in the DB. */
async function importRequirementsDoc(appSlug: string, moduleSlug: string | null, content: string): Promise<void> {
  if (!content) return
  const repo = AppDataSource.getRepository(Requirement)
  const where = moduleSlug === null ? { appSlug, module: IsNull() } : { appSlug, module: moduleSlug }
  const existing = await repo.findOne({ where })
  const concept = moduleSlug === null ? 'requirements' : 'module-requirements'
  if (!existing) {
    if (!DRY_RUN) await repo.save({ appSlug, content, module: moduleSlug })
    recordInsert(concept)
  } else if (!existing.content) {
    if (!DRY_RUN) await repo.update(existing.id, { content })
    recordFill(concept)
  } else {
    recordSkip(concept)
  }
}

async function importRequirements(appSlug: string): Promise<void> {
  await importRequirementsDoc(appSlug, null, readFile(path.join(DATA_ROOT, appSlug, 'requirements', 'FRs.md')))
  for (const m of listModuleSlugs(appSlug)) {
    await importRequirementsDoc(appSlug, m, readFile(path.join(DATA_ROOT, appSlug, 'requirements', `FRs-${m}.md`)))
  }
}

// ─── story-links.json → story_links (insert-if-missing / fill empty storyKey) ──

async function importStoryLinks(appSlug: string): Promise<void> {
  const links = readJson<Record<string, string>>(path.join(DATA_ROOT, appSlug, 'requirements', 'story-links.json'))
  if (!links) return

  const repo = AppDataSource.getRepository(StoryLink)
  for (const [frId, storyKey] of Object.entries(links)) {
    if (!frId || !storyKey) continue
    const existing = await repo.findOne({ where: { appSlug, frId } })
    if (!existing) {
      if (!DRY_RUN) await repo.save({ appSlug, frId, storyKey })
      recordInsert('story-links')
    } else if (!existing.storyKey) {
      if (!DRY_RUN) await repo.update(existing.id, { storyKey })
      recordFill('story-links')
    } else {
      recordSkip('story-links')
    }
  }
}

// ─── stories/*.md → user_stories (insert-if-missing) ─────────────────────────

async function importUserStories(appSlug: string): Promise<void> {
  const dir = path.join(DATA_ROOT, appSlug, 'stories')
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'index.md')

  const repo = AppDataSource.getRepository(UserStory)
  for (const f of files) {
    const storyKey = f.replace(/\.md$/i, '')
    const existing = await repo.findOne({ where: { appSlug, storyKey } })
    await insertIfMissing('user-stories', !!existing, async () => {
      const { summary, description } = parseStoryMd(fs.readFileSync(path.join(dir, f), 'utf-8'))
      await repo.save({ appSlug, storyKey, summary, description, status: '', labels: '[]', components: '[]' })
    })
  }
}

// ─── Features: rows / ACs / testcase versions / lastAddition / archivedAt / screenshots ──

function resolveBugModule(appSlug: string, feature: string): string | null {
  const metaFile = path.join(DATA_ROOT, appSlug, 'features', feature, 'metadata.json')
  let moduleSlug: string | null = null
  if (fs.existsSync(metaFile)) {
    try {
      moduleSlug = (JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as { module?: string | null }).module ?? null
    } catch { /* skip malformed */ }
  }
  if (!moduleSlug) return null
  const modFile = path.join(DATA_ROOT, appSlug, 'modules', moduleSlug, 'module.json')
  if (fs.existsSync(modFile)) {
    try {
      const pathPrefix = (JSON.parse(fs.readFileSync(modFile, 'utf-8')) as { pathPrefix?: string }).pathPrefix
      return pathPrefix ? pathPrefix : null
    } catch { /* skip malformed */ }
  }
  // No manifest — best-effort: use the slug as-is.
  return moduleSlug
}

interface FeatureMetadataJson {
  jiraKey?: string
  storyKey?: string
  module?: string | null
  archived?: boolean
  archivedAt?: string
}

interface LastAdditionJson {
  ids: string[]
  version: number
  at: string
}

async function importFeatureScreenshots(appSlug: string, featureId: number, featureName: string): Promise<void> {
  const dir = path.join(DATA_ROOT, appSlug, 'features', featureName, 'screenshots')
  if (!fs.existsSync(dir)) return
  const repo = AppDataSource.getRepository(Screenshot)
  for (const fileName of fs.readdirSync(dir).filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))) {
    const existing = await repo.findOne({ where: { feature: { id: featureId }, fileName } })
    await insertIfMissing('screenshots', !!existing, async () => {
      const ext = path.extname(fileName).toLowerCase()
      await repo.save({
        feature: { id: featureId },
        fileName,
        mimeType: SCREENSHOT_MIME[ext] ?? 'application/octet-stream',
        data: null,
        byteSize: fileByteSize(path.join(dir, fileName)),
      })
    })
  }
}

async function backfillFeatures(appSlug: string): Promise<void> {
  const featDir = path.join(DATA_ROOT, appSlug, 'features')
  if (!fs.existsSync(featDir)) return

  const entries = fs
    .readdirSync(featDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
  if (entries.length === 0) return

  const featureRepo = AppDataSource.getRepository(Feature)
  const acRepo = AppDataSource.getRepository(AcceptanceCriterion)
  const tvRepo = AppDataSource.getRepository(TestcaseVersion)

  for (const entry of entries) {
    const name = entry.name
    const featureDir = path.join(featDir, name)

    // ── Read FS data ──
    const workflow = readFile(path.join(featureDir, 'workflow.md'))
    const testcases = readFile(path.join(featureDir, `${name}-testcases.md`))
    const knowledgeRaw = readFile(path.join(featureDir, 'knowledge.md'))
    const knowledge = knowledgeRaw.trim() ? knowledgeRaw : null
    const workflowPath = path.join(featureDir, 'workflow.md')
    const lastModified = fs.existsSync(workflowPath) ? fs.statSync(workflowPath).mtime : null

    const meta = readJson<FeatureMetadataJson>(path.join(featureDir, 'metadata.json')) ?? {}
    const jiraKey = meta.jiraKey ?? null
    const storyKey = meta.storyKey ?? null
    const moduleVal = meta.module ?? null

    const lastAddition = readJson<LastAdditionJson>(path.join(featureDir, 'last-addition.json'))
    const lastAdditionJson = lastAddition ? JSON.stringify(lastAddition) : null

    let archivedAt: Date | null = null
    if (meta.archived === true) {
      const metaFile = path.join(featureDir, 'metadata.json')
      archivedAt = meta.archivedAt
        ? new Date(meta.archivedAt)
        : (fs.existsSync(metaFile) ? fs.statSync(metaFile).mtime : new Date())
    }

    // ── Upsert feature (insert-if-missing, else fill null columns only) ──
    let feature = await featureRepo.findOne({ where: { appSlug, name } })
    if (!feature) {
      if (!DRY_RUN) {
        feature = await featureRepo.save({
          appSlug, name, workflow, testcases, lastModified, jiraKey, storyKey, knowledge,
          lastAddition: lastAdditionJson, archivedAt, module: moduleVal,
        })
      }
      recordInsert('features')
      if (DRY_RUN) continue // no row to hang ACs/versions/screenshots off of in dry-run
    } else {
      const fill: Partial<Feature> = {}
      if (feature.jiraKey == null && jiraKey) fill.jiraKey = jiraKey
      if (feature.storyKey == null && storyKey) fill.storyKey = storyKey
      if (feature.knowledge == null && knowledge) fill.knowledge = knowledge
      if (feature.lastAddition == null && lastAdditionJson) fill.lastAddition = lastAdditionJson
      if (feature.archivedAt == null && archivedAt) fill.archivedAt = archivedAt
      if (feature.module == null && moduleVal) fill.module = moduleVal
      if (Object.keys(fill).length > 0) {
        if (!DRY_RUN) await featureRepo.update(feature.id, fill)
        recordFill('features')
      } else {
        recordSkip('features')
      }
    }
    if (!feature) continue

    // ── Acceptance criteria (skip whole concept if any already populated) ──
    const existingAcs = await acRepo.count({ where: { feature: { id: feature.id } } })
    if (existingAcs === 0) {
      const acFile = path.join(featureDir, 'acceptance-criteria.json')
      const acs = readJson<Array<{
        id: string; text: string; parentId?: string | null
        manualCoverage?: string | null; aiCoveredBy?: string[]; aiAnalyzedAt?: string | null
      }>>(acFile)
      if (acs) {
        for (let i = 0; i < acs.length; i++) {
          const ac = acs[i]
          if (!DRY_RUN) {
            await acRepo.save({
              criterionKey: ac.id, text: ac.text, parentId: ac.parentId ?? null,
              manualCoverage: ac.manualCoverage ?? null,
              aiCoveredBy: JSON.stringify(ac.aiCoveredBy ?? []),
              aiAnalyzedAt: ac.aiAnalyzedAt ? new Date(ac.aiAnalyzedAt) : null,
              sortOrder: i, feature: { id: feature.id },
            })
          }
          recordInsert('acceptance-criteria')
        }
      }
    } else {
      recordSkip('acceptance-criteria', existingAcs)
    }

    // ── Testcase versions (skip whole concept if any already populated) ──
    const existingVersions = await tvRepo.count({ where: { feature: { id: feature.id } } })
    if (existingVersions === 0) {
      const vRe = new RegExp(`^${name}-testcases-v(\\d+)\\.md$`)
      const vFiles = fs.readdirSync(featureDir).filter((f) => vRe.test(f)).sort((a, b) => {
        const an = parseInt(a.match(vRe)![1], 10)
        const bn = parseInt(b.match(vRe)![1], 10)
        return an - bn
      })
      for (const vf of vFiles) {
        const vNum = parseInt(vf.match(vRe)![1], 10)
        const content = fs.readFileSync(path.join(featureDir, vf), 'utf-8')
        if (!DRY_RUN) await tvRepo.save({ version: vNum, content, feature: { id: feature.id } })
        recordInsert('testcase-versions')
      }
    } else {
      recordSkip('testcase-versions', existingVersions)
    }

    // ── Screenshot binary metadata (data=NULL — served from disk until batch B) ──
    await importFeatureScreenshots(appSlug, feature.id, name)
  }
}

// ─── Bugs: rows + attachment binary metadata ─────────────────────────────────

async function importBugAttachments(appSlug: string, bugId: number, feature: string, slug: string): Promise<void> {
  const dir = path.join(DATA_ROOT, appSlug, 'bugs', feature, `${slug}-attachments`)
  if (!fs.existsSync(dir)) return
  const repo = AppDataSource.getRepository(Attachment)
  for (const fileName of fs.readdirSync(dir)) {
    const ext = path.extname(fileName).toLowerCase()
    if (!ATTACHMENT_MIME[ext]) continue
    const existing = await repo.findOne({ where: { bug: { id: bugId }, fileName } })
    await insertIfMissing('attachments', !!existing, async () => {
      await repo.save({
        bug: { id: bugId },
        fileName,
        mimeType: ATTACHMENT_MIME[ext],
        data: null,
        byteSize: fileByteSize(path.join(dir, fileName)),
      })
    })
  }
}

async function backfillBugs(appSlug: string): Promise<void> {
  const dir = path.join(DATA_ROOT, appSlug, 'bugs')
  if (!fs.existsSync(dir)) return

  const repo = AppDataSource.getRepository(Bug)

  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const feature = entry.name
    const featureDir = path.join(dir, feature)
    const moduleVal = resolveBugModule(appSlug, feature)

    for (const file of fs.readdirSync(featureDir).filter((f) => f.endsWith('.md') && f !== '_template.md')) {
      const slug = file.replace(/\.md$/, '')
      // Insert-only: never clobber a row that may have been edited through the app.
      const existing = await repo.findOne({ where: { appSlug, feature, slug } })
      let bugId: number | undefined = existing?.id

      await insertIfMissing('bugs', !!existing, async () => {
        const { data, content } = matter(fs.readFileSync(path.join(featureDir, file), 'utf-8'))
        const saved = await repo.save({
          appSlug, feature, slug,
          title: data.title ?? slug,
          status: data.status ?? 'draft',
          jiraKey: data.jira_key ?? null,
          reportedAt: data.reported_at ? new Date(data.reported_at) : null,
          priority: data.priority ?? '',
          bugType: data.bug_type ?? '',
          parentKey: data.parent_key ?? null,
          severity: data.severity ?? '',
          layer: data.layer ?? 'unknown',
          body: content.trim(),
          module: moduleVal,
          jiraStatus: data.jira_status ?? null,
          jiraReporter: data.jira_reporter ?? null,
        })
        bugId = saved.id
      })

      // Attachment binary metadata — needs a bug row (new or pre-existing) to hang off.
      if (bugId !== undefined) {
        await importBugAttachments(appSlug, bugId, feature, slug)
      }
    }
  }
}

// ─── Execution status / bug-links → test_executions ─────────────────────────

function testcaseVersionNumbers(appSlug: string, featureName: string): number[] {
  const dir = path.join(DATA_ROOT, appSlug, 'features', featureName)
  if (!fs.existsSync(dir)) return []
  const re = new RegExp(`^${featureName}-testcases-v(\\d+)\\.md$`)
  return fs.readdirSync(dir)
    .filter((f) => re.test(f))
    .map((f) => parseInt(f.match(re)![1], 10))
    .sort((a, b) => a - b)
}

/** Mirrors src/lib/execution.ts's resolveWriteVersion: the flat (unsuffixed)
 *  execution file maps onto the highest existing testcase version, or NULL
 *  when the feature has no versioned testcase files at all. */
function resolveFlatVersion(appSlug: string, featureName: string): number | null {
  const versions = testcaseVersionNumbers(appSlug, featureName)
  return versions.length > 0 ? versions[versions.length - 1] : null
}

interface ExecutionFileRef { version: number | null; path: string }

function listExecutionStatusFiles(appSlug: string, featureName: string, featureDir: string): ExecutionFileRef[] {
  const refs: ExecutionFileRef[] = []
  const flat = path.join(featureDir, 'execution-status.json')
  if (fs.existsSync(flat)) refs.push({ version: resolveFlatVersion(appSlug, featureName), path: flat })
  const vRe = /^execution-status-v(\d+)\.json$/
  for (const f of fs.readdirSync(featureDir)) {
    const m = f.match(vRe)
    if (m) refs.push({ version: parseInt(m[1], 10), path: path.join(featureDir, f) })
  }
  return refs
}

function listExecutionBugsFiles(appSlug: string, featureName: string, featureDir: string): ExecutionFileRef[] {
  const refs: ExecutionFileRef[] = []
  const flat = path.join(featureDir, 'execution-bugs.json')
  if (fs.existsSync(flat)) refs.push({ version: resolveFlatVersion(appSlug, featureName), path: flat })
  const vRe = /^execution-bugs-v(\d+)\.json$/
  for (const f of fs.readdirSync(featureDir)) {
    const m = f.match(vRe)
    if (m) refs.push({ version: parseInt(m[1], 10), path: path.join(featureDir, f) })
  }
  return refs
}

function listExecutionNotesFiles(appSlug: string, featureName: string, featureDir: string): ExecutionFileRef[] {
  const refs: ExecutionFileRef[] = []
  const flat = path.join(featureDir, 'execution-notes.json')
  if (fs.existsSync(flat)) refs.push({ version: resolveFlatVersion(appSlug, featureName), path: flat })
  const vRe = /^execution-notes-v(\d+)\.json$/
  for (const f of fs.readdirSync(featureDir)) {
    const m = f.match(vRe)
    if (m) refs.push({ version: parseInt(m[1], 10), path: path.join(featureDir, f) })
  }
  return refs
}

async function importExecutions(appSlug: string): Promise<void> {
  const featDir = path.join(DATA_ROOT, appSlug, 'features')
  if (!fs.existsSync(featDir)) return

  const featureRepo = AppDataSource.getRepository(Feature)
  const teRepo = AppDataSource.getRepository(TestExecution)

  for (const entry of fs.readdirSync(featDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const name = entry.name
    const featureDir = path.join(featDir, name)
    const feature = await featureRepo.findOne({ where: { appSlug, name } })
    if (!feature) continue // feature row must exist first (created by backfillFeatures)

    // ── Execution status: insert-if-missing per (feature, version, testcaseId) ──
    for (const ref of listExecutionStatusFiles(appSlug, name, featureDir)) {
      const map = readJson<Record<string, string>>(ref.path)
      if (!map) continue
      const versionWhere = ref.version === null ? IsNull() : ref.version
      for (const [testcaseId, status] of Object.entries(map)) {
        if (!testcaseId || !status) continue
        const existing = await teRepo.findOne({ where: { feature: { id: feature.id }, version: versionWhere, testcaseId } })
        await insertIfMissing('test-executions', !!existing, async () => {
          await teRepo.save({ feature: { id: feature.id }, version: ref.version, testcaseId, status })
        })
      }
    }

    // ── Execution → bug links: fill bugSlug on existing rows, else create with status 'new_added' ──
    for (const ref of listExecutionBugsFiles(appSlug, name, featureDir)) {
      const map = readJson<Record<string, string>>(ref.path)
      if (!map) continue
      const versionWhere = ref.version === null ? IsNull() : ref.version
      for (const [testcaseId, bugSlug] of Object.entries(map)) {
        if (!testcaseId || !bugSlug) continue
        const existing = await teRepo.findOne({ where: { feature: { id: feature.id }, version: versionWhere, testcaseId } })
        if (!existing) {
          if (!DRY_RUN) {
            await teRepo.save({ feature: { id: feature.id }, version: ref.version, testcaseId, status: 'new_added', bugSlug })
          }
          recordInsert('test-execution-bugs')
        } else if (!existing.bugSlug) {
          if (!DRY_RUN) await teRepo.update(existing.id, { bugSlug })
          recordFill('test-execution-bugs')
        } else {
          recordSkip('test-execution-bugs')
        }
      }
    }

    // ── Execution → notes: fill notes on existing rows, else create with status 'new_added' ──
    for (const ref of listExecutionNotesFiles(appSlug, name, featureDir)) {
      const map = readJson<Record<string, string>>(ref.path)
      if (!map) continue
      const versionWhere = ref.version === null ? IsNull() : ref.version
      for (const [testcaseId, note] of Object.entries(map)) {
        if (!testcaseId || !note) continue
        const existing = await teRepo.findOne({ where: { feature: { id: feature.id }, version: versionWhere, testcaseId } })
        if (!existing) {
          if (!DRY_RUN) {
            await teRepo.save({ feature: { id: feature.id }, version: ref.version, testcaseId, status: 'new_added', notes: note })
          }
          recordInsert('test-execution-notes')
        } else if (!existing.notes) {
          if (!DRY_RUN) await teRepo.update(existing.id, { notes: note })
          recordFill('test-execution-notes')
        } else {
          recordSkip('test-execution-notes')
        }
      }
    }
  }
}

// ─── Binary verification (--verify-binaries) ─────────────────────────────────

async function verifyBinaries(): Promise<boolean> {
  console.log('\nVerifying screenshots/attachments have files on disk...')
  let orphanCount = 0

  const screenshotRepo = AppDataSource.getRepository(Screenshot)
  const screenshotsQb = screenshotRepo
    .createQueryBuilder('s')
    .innerJoin('s.feature', 'f')
    .select(['s.fileName', 'f.appSlug', 'f.name'])
  if (APP_FILTER) screenshotsQb.where('f.appSlug = :appSlug', { appSlug: APP_FILTER })
  const screenshots = await screenshotsQb.getRawMany<{ s_fileName: string; f_appSlug: string; f_name: string }>()

  for (const row of screenshots) {
    const filePath = path.join(DATA_ROOT, row.f_appSlug, 'features', row.f_name, 'screenshots', row.s_fileName)
    if (!fs.existsSync(filePath)) {
      orphanCount++
      console.log(`  [orphan screenshot] ${row.f_appSlug}/${row.f_name}/${row.s_fileName}`)
    }
  }

  const attachmentRepo = AppDataSource.getRepository(Attachment)
  const attachmentsQb = attachmentRepo
    .createQueryBuilder('a')
    .innerJoin('a.bug', 'b')
    .select(['a.fileName', 'b.appSlug', 'b.feature', 'b.slug'])
  if (APP_FILTER) attachmentsQb.where('b.appSlug = :appSlug', { appSlug: APP_FILTER })
  const attachments = await attachmentsQb.getRawMany<{ a_fileName: string; b_appSlug: string; b_feature: string; b_slug: string }>()

  for (const row of attachments) {
    const filePath = path.join(DATA_ROOT, row.b_appSlug, 'bugs', row.b_feature, `${row.b_slug}-attachments`, row.a_fileName)
    if (!fs.existsSync(filePath)) {
      orphanCount++
      console.log(`  [orphan attachment] ${row.b_appSlug}/${row.b_feature}/${row.b_slug}/${row.a_fileName}`)
    }
  }

  if (orphanCount === 0) {
    console.log(`Verified ${screenshots.length} screenshots + ${attachments.length} attachments — all present on disk.`)
    return true
  }
  console.log(`\n${orphanCount} orphaned row(s) found (DB row with no file on disk).`)
  return false
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function printSummary(): void {
  console.log('\n=== Import summary ===')
  const concepts = [...stats.keys()].sort()
  for (const concept of concepts) {
    const s = statFor(concept)
    const parts = [`inserted: ${s.inserted}`]
    if (s.filled > 0) parts.push(`filled: ${s.filled}`)
    parts.push(`skipped: ${s.skipped}`)
    console.log(`  ${concept}: ${parts.join(' | ')}`)
  }
  if (concepts.length === 0) console.log('  (nothing found)')
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`DATA_ROOT: ${DATA_ROOT}`)
  if (APP_FILTER) console.log(`App filter: ${APP_FILTER}`)
  if (DRY_RUN) console.log('DRY RUN — no writes will be made.')
  console.log('Connecting to database...')
  await AppDataSource.initialize()
  console.log('Connected.\n')

  const apps = getAppSlugs()
  if (apps.length === 0) {
    console.log('No matching app directories found in DATA_ROOT. Nothing to import.')
    await AppDataSource.destroy()
    return
  }
  console.log(`Apps found: ${apps.join(', ')}`)

  await importApps()

  for (const app of apps) {
    console.log(`\n=== ${app} ===`)
    await importModules(app)
    await backfillFeatures(app)
    await backfillBugs(app)
    await importStoryLinks(app)
    await importUserStories(app)
    await importRequirements(app)
    await importAppKnowledge(app)
    await importModuleKnowledge(app)
    await importBugFormatKnowledge(app)
    await importExampleKnowledge(app)
    await importTemplateKnowledge(app)
    await importIntakeDocuments(app)
    await importAutomationConfig(app)
    await importExecutions(app)
  }

  printSummary()

  let exitCode = 0
  if (VERIFY_BINARIES) {
    const ok = await verifyBinaries()
    if (!ok) exitCode = 1
  }

  await AppDataSource.destroy()
  console.log(DRY_RUN ? '\nDry run complete.' : '\nImport complete.')
  if (exitCode !== 0) process.exit(exitCode)
}

main().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
