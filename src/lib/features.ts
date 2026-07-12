import fs from 'fs'
import path from 'path'
import { getDataSource } from './db'
import { getDataRoot } from './paths'
import {
  FeatureEntity,
  IFeature,
  ScreenshotEntity,
  IScreenshot,
  RequirementEntity,
  TestcaseVersionEntity,
} from './entities'
import { getAcStatsBulk, computeAcStats, AcStats } from './acceptance-criteria'
import { MARKER as INTAKE_MARKER } from './intake'
import { clearExecutions, removeExecutionEntries } from './execution'

function appDir(appSlug: string): string {
  return path.join(getDataRoot(), appSlug)
}

function featuresDir(appSlug: string): string {
  return path.join(appDir(appSlug), 'features')
}

function examplesDir(appSlug: string): string {
  return path.join(appDir(appSlug), 'examples')
}

function templateFile(appSlug: string): string {
  return path.join(appDir(appSlug), '.github', 'templates', 'workflow-template.md')
}

function metadataFile(appSlug: string, name: string): string {
  return path.join(featuresDir(appSlug), name, 'metadata.json')
}

function readFeatureMetadata(appSlug: string, name: string): { jiraKey?: string; storyKey?: string; module?: string | null; archived?: boolean; archivedAt?: string } {
  const file = metadataFile(appSlug, name)
  if (!fs.existsSync(file)) return {}
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return {} }
}

export async function saveFeatureMetadata(appSlug: string, name: string, data: { jiraKey?: string; storyKey?: string; module?: string | null }): Promise<void> {
  const file = metadataFile(appSlug, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const existing = readFeatureMetadata(appSlug, name)
  fs.writeFileSync(file, JSON.stringify({ ...existing, ...data }, null, 2), 'utf-8')
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(FeatureEntity)
    const feature = await repo.findOne({ where: { appSlug, name } })
    if (feature) {
      const updates: Partial<IFeature> = {}
      if ('jiraKey' in data) updates.jiraKey = data.jiraKey ?? null
      if ('storyKey' in data) updates.storyKey = data.storyKey ?? null
      if ('module' in data) updates.module = data.module ?? null
      if (Object.keys(updates).length > 0) await repo.update(feature.id, updates)
    }
  } catch {
    // DB unavailable — FS write above is sufficient
  }
}

/** Soft-deletes a feature: marks it archived in metadata.json (FS is authoritative).
 *  Returns false when the feature folder doesn't exist. */
export async function archiveFeature(appSlug: string, name: string): Promise<boolean> {
  const featureDir = path.join(featuresDir(appSlug), name)
  if (!fs.existsSync(featureDir)) return false

  const archivedAt = new Date().toISOString()
  const file = metadataFile(appSlug, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const existing = readFeatureMetadata(appSlug, name)
  fs.writeFileSync(file, JSON.stringify({ ...existing, archived: true, archivedAt }, null, 2), 'utf-8')

  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(FeatureEntity)
    const feature = await repo.findOne({ where: { appSlug, name } })
    if (feature) await repo.update(feature.id, { archivedAt: new Date(archivedAt) })
  } catch {
    // DB unavailable — FS write above is sufficient
  }
  return true
}

/** Restores a previously archived feature. Returns false when the feature folder doesn't exist. */
export async function restoreFeature(appSlug: string, name: string): Promise<boolean> {
  const featureDir = path.join(featuresDir(appSlug), name)
  if (!fs.existsSync(featureDir)) return false

  const file = metadataFile(appSlug, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const existing = { ...readFeatureMetadata(appSlug, name) }
  delete existing.archived
  delete existing.archivedAt
  fs.writeFileSync(file, JSON.stringify({ ...existing, archived: false }, null, 2), 'utf-8')

  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(FeatureEntity)
    const feature = await repo.findOne({ where: { appSlug, name } })
    if (feature) await repo.update(feature.id, { archivedAt: null })
  } catch {
    // DB unavailable — FS write above is sufficient
  }
  return true
}

export async function saveFeatureKnowledge(appSlug: string, name: string, content: string): Promise<void> {
  const featureDir = path.join(featuresDir(appSlug), name)
  fs.mkdirSync(featureDir, { recursive: true })
  fs.writeFileSync(path.join(featureDir, 'knowledge.md'), content, 'utf-8')
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(FeatureEntity)
    const feature = await repo.findOne({ where: { appSlug, name } })
    if (feature) await repo.update(feature.id, { knowledge: content })
  } catch {
    // DB unavailable — FS write above is sufficient
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeatureSummary {
  name: string
  hasWorkflow: boolean
  hasTestcases: boolean
  testcaseCount: number
  screenshotCount: number
  lastModified: string | null
  jiraKey?: string
  storyKey?: string
  module?: string | null
  hasKnowledge?: boolean
  hasAcceptanceCriteria?: boolean
  uncoveredAcCount?: number
  archived?: boolean
}

export interface TestcaseVersion {
  label: string     // display label e.g. "v1 (latest)", "v2"
  filename: string  // just the filename, no path
  content: string
}

/** The most recent batch of AI-appended cases, kept so the user can undo it. */
export interface LastAddition {
  ids: string[]
  version: number
  at: string
}

export interface FeatureDetail {
  name: string
  workflow: string
  testcases: string
  screenshots: string[]
  testcaseVersions: TestcaseVersion[]
  jiraKey?: string
  storyKey?: string
  module?: string | null
  knowledge?: string
  testingPhase?: string | null
  testingSubtasks?: Record<string, string>
  lastAddition?: { count: number; version: number; at: string } | null
  archived?: boolean
}

// ─── MIME type map ────────────────────────────────────────────────────────────

export const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countTestcases(content: string): number {
  const lines = content.split('\n').filter((l) => l.trim().startsWith('|'))
  return Math.max(0, lines.length - 2)
}

/** Write-through: keeps workflow/testcase markdown files for Copilot agent use. Non-fatal. */
function writeFeatureMarkdown(
  appSlug: string,
  name: string,
  type: 'workflow' | 'testcases',
  content: string
): void {
  try {
    const featurePath = path.join(featuresDir(appSlug), name)
    fs.mkdirSync(featurePath, { recursive: true })
    const filePath =
      type === 'workflow'
        ? path.join(featurePath, 'workflow.md')
        : path.join(featurePath, `${name}-testcases.md`)
    fs.writeFileSync(filePath, content, 'utf-8')
  } catch {
    // Non-fatal
  }
}

/** Returns all testcase version files for a feature, with content embedded. Filesystem-based.
 *  Only reads numbered version files ({name}-testcases-vN.md) — never the base file, which
 *  is a write-through copy of the latest version used only for backward compat/Copilot agents. */
function listVersionsFromFs(appSlug: string, name: string): TestcaseVersion[] {
  const featureDir = path.join(featuresDir(appSlug), name)
  if (!fs.existsSync(featureDir)) return []

  const versionRe = new RegExp(`^${name}-testcases-v(\\d+)\\.md$`)
  const numbered = fs.readdirSync(featureDir).filter((f) => versionRe.test(f))
  const sorted = numbered.sort((a, b) => {
    const an = parseInt(a.match(versionRe)![1], 10)
    const bn = parseInt(b.match(versionRe)![1], 10)
    return an - bn
  })

  return sorted.map((filename, idx) => {
    const isLatest = idx === sorted.length - 1
    const vNum = parseInt(filename.match(versionRe)![1], 10)
    return {
      label: isLatest ? `v${vNum} (latest)` : `v${vNum}`,
      filename,
      content: fs.readFileSync(path.join(featureDir, filename), 'utf-8'),
    }
  })
}

async function listVersions(appSlug: string, name: string): Promise<TestcaseVersion[]> {
  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name } })
    if (!feature) return listVersionsFromFs(appSlug, name)

    const rows = await ds.getRepository(TestcaseVersionEntity)
      .createQueryBuilder('tv')
      .where('tv.featureId = :fId', { fId: feature.id })
      .orderBy('tv.version', 'ASC')
      .getMany()

    if (rows.length === 0) return listVersionsFromFs(appSlug, name)

    return rows.map((row, idx) => ({
      label: idx === rows.length - 1 ? `v${row.version} (latest)` : `v${row.version}`,
      filename: `${name}-testcases-v${row.version}.md`,
      content: row.content,
    }))
  } catch {
    return listVersionsFromFs(appSlug, name)
  }
}

// ─── Testcase Markdown Utilities ─────────────────────────────────────────────

/** Parses the markdown table and returns TestCase ID + objective for each data row.
 *  Expects a table with Feature ID | TestCase ID | ... | Test Cases Title / Objective columns.
 */
export function parseTestcaseRows(markdown: string): { id: string; featureId: string; objective: string; steps: string }[] {
  const rows: { id: string; featureId: string; objective: string; steps: string }[] = []
  const lines = markdown.split('\n')
  let headerFound = false
  let separatorPassed = false
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!headerFound && line.includes('Feature ID') && line.includes('TestCase ID')) {
      headerFound = true
      continue
    }
    if (headerFound && !separatorPassed && line.includes('|---|')) {
      separatorPassed = true
      continue
    }
    if (separatorPassed && line.trim().startsWith('|')) {
      const cols = line.split('|')
      const featureId = cols[1]?.trim() ?? ''
      const id = cols[2]?.trim() ?? ''
      const objective = cols[5]?.trim() ?? ''
      // Column order: |_|Feature ID|TestCase ID|Tester|Validity|Objective|Enviroment|Pre-condition|Test Data|Steps|...
      const steps = cols[9]?.trim() ?? ''
      if (id) rows.push({ id, featureId, objective, steps })
    }
  }
  return rows
}

/** Returns the highest numeric suffix and prefix from TestCase IDs (e.g. LST_024 → { prefix: 'LST', lastNum: 24 }). */
export function getLastTestcaseId(markdown: string): { prefix: string; lastNum: number } {
  const rows = parseTestcaseRows(markdown)
  let lastNum = 0
  let prefix = ''
  for (const row of rows) {
    const match = row.id.match(/^([A-Z]{2,4})_(\d+)$/)
    if (match) {
      prefix = match[1]
      const num = parseInt(match[2], 10)
      if (num > lastNum) lastNum = num
    }
  }
  return { prefix, lastNum }
}

/** Appends data rows from `additions` (new AI output) to `existing` (the current full table). */
export function mergeTestcaseMarkdown(existing: string, additions: string): string {
  const newRows: string[] = []
  const lines = additions.split('\n')
  let headerFound = false
  let separatorPassed = false
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (!headerFound && line.includes('Feature ID') && line.includes('TestCase ID')) {
      headerFound = true
      continue
    }
    if (headerFound && !separatorPassed && line.includes('|---|')) {
      separatorPassed = true
      continue
    }
    if (separatorPassed && line.trim().startsWith('|')) {
      newRows.push(line)
    }
  }
  if (newRows.length === 0) return existing
  return existing.trimEnd() + '\n' + newRows.join('\n') + '\n'
}

// ─── Public API ──────────────────────────────────────────────────────────────

function listFeaturesFallback(appSlug: string, module?: string | null, includeArchived = false): FeatureSummary[] {
  const dir = featuresDir(appSlug)
  if (!fs.existsSync(dir)) return []
  const all = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const name = e.name
      const featureDir = path.join(dir, name)
      const workflowFile = path.join(featureDir, 'workflow.md')
      const testcasesFile = path.join(featureDir, `${name}-testcases.md`)
      const workflow = fs.existsSync(workflowFile) ? fs.readFileSync(workflowFile, 'utf-8') : ''
      const testcases = fs.existsSync(testcasesFile) ? fs.readFileSync(testcasesFile, 'utf-8') : ''
      const screenshotsDir = path.join(featureDir, 'screenshots')
      const screenshotCount = fs.existsSync(screenshotsDir)
        ? fs.readdirSync(screenshotsDir).filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f)).length
        : 0
      const lastModified = fs.existsSync(workflowFile)
        ? fs.statSync(workflowFile).mtime.toISOString()
        : null
      const { jiraKey, storyKey, archived } = readFeatureMetadata(appSlug, name)
      const hasKnowledge = fs.existsSync(path.join(dir, name, 'knowledge.md'))
      const acFile = path.join(dir, name, 'acceptance-criteria.json')
      let hasAcceptanceCriteria = false
      let uncoveredAcCount = 0
      if (fs.existsSync(acFile)) {
        try {
          const acs = JSON.parse(fs.readFileSync(acFile, 'utf-8')) as Array<{ id: string; parentId?: string | null; manualCoverage: string | null; aiCoveredBy: string[]; aiAnalyzedAt: string | null }>
          hasAcceptanceCriteria = acs.length > 0
          const acParentIds = new Set(acs.filter(a => a.parentId).map(a => a.parentId as string))
          uncoveredAcCount = acs.filter(ac => {
            if (acParentIds.has(ac.id)) return false
            if (ac.manualCoverage === 'covered') return false
            if (ac.manualCoverage === 'not_covered') return true
            if (ac.aiAnalyzedAt !== null) return ac.aiCoveredBy.length === 0
            return false
          }).length
        } catch { /* non-fatal */ }
      }
      const { module: featureModule } = readFeatureMetadata(appSlug, name)
      return { name, hasWorkflow: workflow.trim().length > 0, hasTestcases: testcases.trim().length > 0, testcaseCount: countTestcases(testcases), screenshotCount, lastModified, jiraKey, storyKey, module: featureModule ?? null, hasKnowledge, hasAcceptanceCriteria, uncoveredAcCount, archived: archived === true }
    })
  let result = all
  if (module !== undefined) result = result.filter((f) => module === null ? f.module === null : f.module === module)
  if (!includeArchived) result = result.filter((f) => !f.archived)
  return result
}

export async function listFeatures(appSlug: string, module?: string | null, opts: { includeArchived?: boolean } = {}): Promise<FeatureSummary[]> {
  const includeArchived = opts.includeArchived === true
  try {
    const ds = await getDataSource()
    const featureRepo = ds.getRepository(FeatureEntity)
    const screenshotRepo = ds.getRepository(ScreenshotEntity)
    // Use explicit IS NULL SQL rather than the IsNull() FindOperator: under
    // Turbopack the operator can be created from a different typeorm build than
    // the DataSource uses, so its `instanceof FindOperator` check fails and the
    // operator gets bound as a literal param ("Validation failed for parameter").
    const qb = featureRepo.createQueryBuilder('f').where('f.appSlug = :appSlug', { appSlug })
    if (module !== undefined) {
      if (module === null) qb.andWhere('f.module IS NULL')
      else qb.andWhere('f.module = :module', { module })
    }
    const features = await qb.orderBy('f.name', 'ASC').getMany()
    if (features.length === 0) return listFeaturesFallback(appSlug, module, includeArchived)
    // Fetch AC stats for all features in a single bulk query
    const acStatsMap = await getAcStatsBulk(features.map(f => f.id))
    // Fetch screenshot counts for all features in a single grouped query rather than
    // one COUNT per feature.
    const screenshotCountRows = await screenshotRepo
      .createQueryBuilder('s')
      .select('s.featureId', 'featureId')
      .addSelect('COUNT(*)', 'count')
      .where('s.featureId IN (:...ids)', { ids: features.map(f => f.id) })
      .groupBy('s.featureId')
      .getRawMany<{ featureId: number; count: string }>()
    const screenshotCountMap = new Map(screenshotCountRows.map((r) => [Number(r.featureId), Number(r.count)]))

    const summaries = await Promise.all(
      features.map(async (f) => {
        let screenshotCount = screenshotCountMap.get(f.id) ?? 0
        if (screenshotCount === 0) {
          const ssDir = path.join(featuresDir(appSlug), f.name, 'screenshots')
          if (fs.existsSync(ssDir)) {
            screenshotCount = fs.readdirSync(ssDir)
              .filter((file) => /\.(png|jpg|jpeg|gif|webp)$/i.test(file)).length
          }
        }
        const baseFile = path.join(featuresDir(appSlug), f.name, `${f.name}-testcases.md`)
        const testcasesContent = fs.existsSync(baseFile)
          ? fs.readFileSync(baseFile, 'utf-8')
          : (f.testcases ?? '')

        // DB-first for metadata fields. Always read FS metadata (rather than only when
        // jiraKey/storyKey are missing) because `archived` is FS-authoritative — the DB
        // column may not exist yet on unsynced databases.
        const meta = readFeatureMetadata(appSlug, f.name)
        const jiraKey = f.jiraKey ?? meta.jiraKey
        const storyKey = f.storyKey ?? meta.storyKey
        const archived = meta.archived === true
        const hasKnowledge = (f.knowledge != null && f.knowledge.trim().length > 0)
          ? true
          : fs.existsSync(path.join(featuresDir(appSlug), f.name, 'knowledge.md'))

        // AC stats: DB bulk result or FS fallback per feature
        let acStats: AcStats
        if (acStatsMap.has(f.id)) {
          acStats = acStatsMap.get(f.id)!
        } else {
          const acFile = path.join(featuresDir(appSlug), f.name, 'acceptance-criteria.json')
          if (fs.existsSync(acFile)) {
            try {
              const acs = JSON.parse(fs.readFileSync(acFile, 'utf-8')) as Array<{ id: string; parentId?: string | null; manualCoverage: string | null; aiCoveredBy: string[]; aiAnalyzedAt: string | null }>
              acStats = computeAcStats(acs.map(ac => ({ ...ac, text: '', parentId: ac.parentId ?? null, aiCoveredBy: ac.aiCoveredBy ?? [], manualCoverage: ac.manualCoverage as ('covered' | 'not_covered' | null) })))
            } catch { acStats = { hasAcceptanceCriteria: false, uncoveredAcCount: 0 } }
          } else {
            acStats = { hasAcceptanceCriteria: false, uncoveredAcCount: 0 }
          }
        }

        return {
          name: f.name,
          hasWorkflow: f.workflow
            ? f.workflow.trim().length > 0
            : fs.existsSync(path.join(featuresDir(appSlug), f.name, 'workflow.md')),
          hasTestcases: testcasesContent.trim().length > 0,
          testcaseCount: countTestcases(testcasesContent),
          screenshotCount,
          lastModified: f.lastModified ? f.lastModified.toISOString() : null,
          jiraKey,
          storyKey,
          module: f.module ?? null,
          hasKnowledge,
          hasAcceptanceCriteria: acStats.hasAcceptanceCriteria,
          uncoveredAcCount: acStats.uncoveredAcCount,
          archived,
        }
      })
    )
    return includeArchived ? summaries : summaries.filter((s) => !s.archived)
  } catch {
    return listFeaturesFallback(appSlug, module, includeArchived)
  }
}

export async function getFeature(
  appSlug: string,
  name: string
): Promise<FeatureDetail | null> {
  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name } })
    if (!feature) throw new Error('not in DB')
    const dbScreenshots = await ds
      .getRepository(ScreenshotEntity)
      .createQueryBuilder('s')
      .select(['s.id', 's.fileName'])
      .innerJoin('s.feature', 'f')
      .where('f.id = :fId', { fId: feature.id })
      .orderBy('s.uploadedAt', 'ASC')
      .getMany()
    let screenshotNames = dbScreenshots.map((s) => s.fileName)
    // FS is source of truth: surface and sync any disk images the DB doesn't know about.
    const ssDir = path.join(featuresDir(appSlug), name, 'screenshots')
    if (fs.existsSync(ssDir)) {
      const fsNames = fs.readdirSync(ssDir).filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
      const knownLower = new Set(screenshotNames.map((n) => n.toLowerCase()))
      const missing = fsNames.filter((f) => !knownLower.has(f.toLowerCase()))
      if (missing.length > 0) {
        screenshotNames = [...screenshotNames, ...missing]
        for (const fileName of missing) {
          try {
            const buf = fs.readFileSync(path.join(ssDir, fileName))
            saveScreenshot(appSlug, name, fileName, buf).catch(() => {})
          } catch { /* non-fatal */ }
        }
      }
    }
    // Deduplicate (guards against DB duplicate rows from concurrent syncs)
    screenshotNames = [...new Set(screenshotNames.map((n) => n.toLowerCase()))].map(
      (lower) => screenshotNames.find((n) => n.toLowerCase() === lower)!
    )
    const testcaseVersions = await listVersions(appSlug, name)
    let latestTestcases: string
    if (testcaseVersions.length > 0) {
      latestTestcases = testcaseVersions[testcaseVersions.length - 1].content
    } else {
      // Filesystem base file is source of truth for manually written testcases.
      // Always prefer it over the DB when it exists.
      const baseFile = path.join(featuresDir(appSlug), name, `${name}-testcases.md`)
      if (fs.existsSync(baseFile)) {
        latestTestcases = fs.readFileSync(baseFile, 'utf-8')
        // Sync to DB so list-view counts stay accurate
        saveTestcases(appSlug, name, latestTestcases).catch(() => {})
      } else {
        latestTestcases = feature.testcases ?? ''
      }
    }
    const meta = readFeatureMetadata(appSlug, name)
    const jiraKey = feature.jiraKey ?? meta.jiraKey
    const storyKey = feature.storyKey ?? meta.storyKey
    const featureModule = feature.module ?? meta.module ?? null
    const archived = meta.archived === true
    let knowledge: string | undefined
    if (feature.knowledge != null && feature.knowledge.trim().length > 0) {
      knowledge = feature.knowledge
    } else {
      // DB is NULL or empty-string: FS is source of truth. Fall back and self-heal.
      const knowledgeFile = path.join(featuresDir(appSlug), name, 'knowledge.md')
      if (fs.existsSync(knowledgeFile)) {
        const fsKnowledge = fs.readFileSync(knowledgeFile, 'utf-8')
        knowledge = fsKnowledge.trim().length > 0 ? fsKnowledge : undefined
        if (knowledge !== undefined && (feature.knowledge ?? '') === '') {
          saveFeatureKnowledge(appSlug, name, fsKnowledge).catch(() => {})
        }
      } else {
        knowledge = undefined
      }
    }
    // Fall back to FS workflow.md if DB is empty, and sync back to DB so list-view is accurate
    let workflow: string
    if (feature.workflow) {
      workflow = feature.workflow
    } else {
      const workflowFile = path.join(featuresDir(appSlug), name, 'workflow.md')
      if (fs.existsSync(workflowFile)) {
        workflow = fs.readFileSync(workflowFile, 'utf-8')
        saveWorkflow(appSlug, name, workflow).catch(() => {})
      } else {
        workflow = ''
      }
    }
    return {
      name: feature.name,
      workflow,
      testcases: latestTestcases,
      screenshots: screenshotNames,
      testcaseVersions,
      jiraKey,
      storyKey,
      module: featureModule,
      knowledge,
      testingPhase: feature.testingPhase ?? null,
      testingSubtasks: feature.testingSubtasks ? (JSON.parse(feature.testingSubtasks) as Record<string, string>) : {},
      lastAddition: toLastAdditionSummary(getLastAddition(appSlug, name)),
      archived,
    }
  } catch {
    // Fallback: filesystem
    const featureDir = path.join(featuresDir(appSlug), name)
    if (!fs.existsSync(featureDir)) return null
    const workflowFile = path.join(featureDir, 'workflow.md')
    const workflow = fs.existsSync(workflowFile) ? fs.readFileSync(workflowFile, 'utf-8') : ''
    const screenshotsDir = path.join(featureDir, 'screenshots')
    const screenshots = fs.existsSync(screenshotsDir)
      ? fs.readdirSync(screenshotsDir).filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
      : []
    const testcaseVersions = listVersionsFromFs(appSlug, name)
    const baseFile = path.join(featureDir, `${name}-testcases.md`)
    const latestTestcases = testcaseVersions.length > 0
      ? testcaseVersions[testcaseVersions.length - 1].content
      : (fs.existsSync(baseFile) ? fs.readFileSync(baseFile, 'utf-8') : '')
    const { jiraKey, storyKey, module: fsModule, archived } = readFeatureMetadata(appSlug, name)
    const knowledgeFile = path.join(featureDir, 'knowledge.md')
    const knowledge = fs.existsSync(knowledgeFile) ? fs.readFileSync(knowledgeFile, 'utf-8') : undefined
    return { name, workflow, testcases: latestTestcases, screenshots, testcaseVersions, jiraKey, storyKey, module: fsModule ?? null, knowledge, testingPhase: null, testingSubtasks: {}, lastAddition: toLastAdditionSummary(getLastAddition(appSlug, name)), archived: archived === true }
  }
}

function toLastAdditionSummary(last: LastAddition | null): { count: number; version: number; at: string } | null {
  return last ? { count: last.ids.length, version: last.version, at: last.at } : null
}

export async function getFeatureTestingData(
  appSlug: string,
  name: string,
): Promise<{ jiraKey: string | null; testingPhase: string | null; testingSubtasks: Record<string, string> }> {
  const ds = await getDataSource()
  const repo = ds.getRepository(FeatureEntity)
  const feature = await repo.findOne({ where: { appSlug, name } })
  if (!feature) throw new Error('Feature not found')
  return {
    jiraKey: feature.jiraKey ?? null,
    testingPhase: feature.testingPhase ?? null,
    testingSubtasks: feature.testingSubtasks
      ? (JSON.parse(feature.testingSubtasks) as Record<string, string>)
      : {},
  }
}

export async function saveFeatureTestingPhase(
  appSlug: string,
  name: string,
  phase: string | null,
  newSubtaskEntry?: { phase: string; key: string },
): Promise<{ testingSubtasks: Record<string, string> }> {
  const ds = await getDataSource()
  const repo = ds.getRepository(FeatureEntity)
  const feature = await repo.findOne({ where: { appSlug, name } })
  if (!feature) throw new Error('Feature not found')

  const existing: Record<string, string> = feature.testingSubtasks
    ? (JSON.parse(feature.testingSubtasks) as Record<string, string>)
    : {}
  if (newSubtaskEntry) existing[newSubtaskEntry.phase] = newSubtaskEntry.key

  await repo.update(feature.id, {
    testingPhase: phase,
    testingSubtasks: JSON.stringify(existing),
  })

  return { testingSubtasks: existing }
}

export async function createFeature(appSlug: string, name: string, module?: string | null): Promise<void> {
  const tpl = templateFile(appSlug)
  const workflow = fs.existsSync(tpl)
    ? fs.readFileSync(tpl, 'utf-8')
    : `${INTAKE_MARKER}\n# ${name} Workflow\n\n_Fill in workflow details here._\n`
  // Always write to filesystem first (used by Copilot agents and as fallback)
  writeFeatureMarkdown(appSlug, name, 'workflow', workflow)
  try { fs.mkdirSync(path.join(featuresDir(appSlug), name, 'screenshots'), { recursive: true }) } catch { /* non-fatal */ }
  // Write module to metadata.json so FS is source of truth
  if (module) {
    const existing = readFeatureMetadata(appSlug, name)
    const file = metadataFile(appSlug, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ ...existing, module }, null, 2), 'utf-8')
  }
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(FeatureEntity)
    const existing = await repo.findOne({ where: { appSlug, name } })
    if (!existing) await repo.save({ appSlug, name, workflow, testcases: '', lastModified: new Date(), module: module ?? null })
  } catch {
    // DB unavailable — filesystem write above is sufficient
  }
}

export async function saveWorkflow(
  appSlug: string,
  name: string,
  content: string
): Promise<void> {
  writeFeatureMarkdown(appSlug, name, 'workflow', content)
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(FeatureEntity)
    const feature = await repo.findOne({ where: { appSlug, name } })
    if (feature) {
      await repo.update(feature.id, { workflow: content, lastModified: new Date() })
    } else {
      await repo.save({ appSlug, name, workflow: content, testcases: '', lastModified: new Date() })
    }
  } catch {
    // DB unavailable — filesystem write above is sufficient
  }
}

export async function saveTestcases(
  appSlug: string,
  name: string,
  content: string
): Promise<void> {
  writeFeatureMarkdown(appSlug, name, 'testcases', content)
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(FeatureEntity)
    const feature = await repo.findOne({ where: { appSlug, name } })
    if (feature) {
      await repo.update(feature.id, { testcases: content, lastModified: new Date() })
    } else {
      await repo.save({ appSlug, name, workflow: '', testcases: content, lastModified: new Date() })
    }
  } catch {
    // DB unavailable — filesystem write above is sufficient
  }
}

export async function updateTestcaseVersionContent(
  appSlug: string,
  name: string,
  versionFilename: string,
  content: string
): Promise<void> {
  const featureDir = path.join(featuresDir(appSlug), name)
  fs.mkdirSync(featureDir, { recursive: true })
  fs.writeFileSync(path.join(featureDir, versionFilename), content, 'utf-8')

  const versionRe = new RegExp(`^${name}-testcases-v(\\d+)\\.md$`)
  const match = versionFilename.match(versionRe)
  if (!match) return
  const version = parseInt(match[1], 10)

  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name } })
    if (feature) {
      const tvRepo = ds.getRepository(TestcaseVersionEntity)
      const existing = await tvRepo
        .createQueryBuilder('tv')
        .where('tv.featureId = :fId AND tv.version = :v', { fId: feature.id, v: version })
        .getOne()
      if (existing) {
        await tvRepo.update(existing.id, { content })
      } else {
        await tvRepo.insert({ version, content, feature: { id: feature.id } })
      }
    }
  } catch {
    // DB unavailable — FS write above is sufficient
  }
}

export async function saveTestcaseVersion(
  appSlug: string,
  name: string,
  content: string,
  opts?: { clearExecution?: boolean }
): Promise<number> {
  const existing = listVersionsFromFs(appSlug, name)
  const featureDir = path.join(featuresDir(appSlug), name)
  fs.mkdirSync(featureDir, { recursive: true })

  // If a base file exists (manually written) and no numbered versions exist yet,
  // preserve it as v1.md so users can switch back to it after the AI generates v2.
  const baseFile = path.join(featureDir, `${name}-testcases.md`)
  const baseContent = fs.existsSync(baseFile) ? fs.readFileSync(baseFile, 'utf-8') : ''
  const baseExists = baseContent.trim().length > 0
  const promotedBaseToV1 = baseExists && existing.length === 0
  if (promotedBaseToV1) {
    fs.writeFileSync(path.join(featureDir, `${name}-testcases-v1.md`), baseContent, 'utf-8')
  }
  const nextVersion = existing.length > 0
    ? parseInt(existing[existing.length - 1].filename.match(new RegExp(`${name}-testcases-v(\\d+)\\.md`))![1], 10) + 1
    : baseExists ? 2 : 1
  fs.writeFileSync(path.join(featureDir, `${name}-testcases-v${nextVersion}.md`), content, 'utf-8')

  // DB write-through
  try {
    const ds = await getDataSource()
    const feature = await ds.getRepository(FeatureEntity).findOne({ where: { appSlug, name } })
    if (feature) {
      const tvRepo = ds.getRepository(TestcaseVersionEntity)
      if (promotedBaseToV1) {
        await tvRepo.insert({ version: 1, content: baseContent, feature: { id: feature.id } })
      }
      await tvRepo.insert({ version: nextVersion, content, feature: { id: feature.id } })
    }
  } catch {
    // DB unavailable — FS files above are sufficient
  }

  // Write-through to base file (latest copy for backward compat / Copilot agents)
  await saveTestcases(appSlug, name, content)

  // A full regenerate creates a new version — its own execution file starts
  // clean by construction, but clear it explicitly in case a version number
  // was reused (e.g. after a manual reset). Scoped to `nextVersion` only, so
  // older versions' execution history is untouched. Additive callers
  // (add-more, quick-add) pass nothing and keep existing statuses — only
  // their newly-appended cases default to untested.
  if (opts?.clearExecution) {
    await clearExecutions(appSlug, name, String(nextVersion))
    // The recorded undo batch belongs to the replaced case set; its IDs now mean
    // different cases, so undo must not survive a regenerate.
    clearLastAddition(appSlug, name)
  }

  return nextVersion
}

// ─── Additive saves (Add Cases) ──────────────────────────────────────────────
// Versions mark baselines (full generations / manual snapshots). Additive AI ops
// (gap-fill "add more", scenario quick-add) mutate the LATEST version in place —
// no version churn, and execution statuses (keyed by testcase ID) are untouched.
// Rollback safety comes from last-addition.json + undoLastAddition instead.

/** Saves `content` (the full merged table) into the latest version in place.
 *  Creates v1 only when no numbered version exists yet. Returns the version number. */
export async function saveTestcaseAdditions(
  appSlug: string,
  name: string,
  content: string
): Promise<number> {
  const existing = listVersionsFromFs(appSlug, name)
  if (existing.length === 0) {
    // First-ever save for this feature (or only a manual base file exists, which
    // saveTestcaseVersion preserves as v1). Creating the initial version is fine.
    return saveTestcaseVersion(appSlug, name, content)
  }
  const latest = existing[existing.length - 1]
  const versionRe = new RegExp(`^${name}-testcases-v(\\d+)\\.md$`)
  const version = parseInt(latest.filename.match(versionRe)![1], 10)
  await updateTestcaseVersionContent(appSlug, name, latest.filename, content)
  // Write-through to base file (latest copy for backward compat / Copilot agents)
  await saveTestcases(appSlug, name, content)
  return version
}

function lastAdditionFile(appSlug: string, name: string): string {
  return path.join(featuresDir(appSlug), name, 'last-addition.json')
}

export function getLastAddition(appSlug: string, name: string): LastAddition | null {
  const file = lastAdditionFile(appSlug, name)
  if (!fs.existsSync(file)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as LastAddition
    if (!Array.isArray(raw.ids) || raw.ids.length === 0) return null
    if (typeof raw.version !== 'number' || typeof raw.at !== 'string') return null
    return raw
  } catch {
    return null
  }
}

export function recordLastAddition(appSlug: string, name: string, ids: string[], version: number): void {
  if (ids.length === 0) return
  const file = lastAdditionFile(appSlug, name)
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ ids, version, at: new Date().toISOString() }, null, 2), 'utf-8')
  } catch {
    // non-fatal — undo simply won't be offered
  }
}

export function clearLastAddition(appSlug: string, name: string): void {
  try {
    const file = lastAdditionFile(appSlug, name)
    if (fs.existsSync(file)) fs.unlinkSync(file)
  } catch {
    // non-fatal
  }
}

/** Strips the last recorded batch of appended cases from the latest version (in
 *  place) and removes their execution status/bug-link entries. */
export async function undoLastAddition(
  appSlug: string,
  name: string
): Promise<{ removed: number; version: number; testcases: string } | { error: string }> {
  const last = getLastAddition(appSlug, name)
  if (!last) return { error: 'Nothing to undo — no recent AI addition recorded.' }

  const versions = listVersionsFromFs(appSlug, name)
  if (versions.length === 0) return { error: 'No test case versions found.' }
  const latest = versions[versions.length - 1]
  const versionRe = new RegExp(`^${name}-testcases-v(\\d+)\\.md$`)
  const latestNum = parseInt(latest.filename.match(versionRe)![1], 10)
  if (latestNum !== last.version) {
    // A newer version was created since the addition — its IDs no longer refer
    // to the recorded batch, so undoing would corrupt the current set.
    clearLastAddition(appSlug, name)
    return { error: 'The last addition belongs to an older version and can no longer be undone.' }
  }

  const ids = new Set(last.ids)
  const kept = latest.content
    .split('\n')
    .filter((line) => {
      if (!line.trim().startsWith('|')) return true
      const id = line.split('|')[2]?.trim()
      return !id || !ids.has(id)
    })
    .join('\n')

  await updateTestcaseVersionContent(appSlug, name, latest.filename, kept)
  await saveTestcases(appSlug, name, kept)
  await removeExecutionEntries(appSlug, name, last.ids, String(latestNum))
  clearLastAddition(appSlug, name)
  return { removed: last.ids.length, version: latestNum, testcases: kept }
}

export async function saveScreenshot(
  appSlug: string,
  featureName: string,
  fileName: string,
  buffer: Buffer
): Promise<void> {
  // Always write to filesystem (serves as both fallback and Copilot-agent source)
  const screenshotsDir = path.join(featuresDir(appSlug), featureName, 'screenshots')
  fs.mkdirSync(screenshotsDir, { recursive: true })
  fs.writeFileSync(path.join(screenshotsDir, fileName), buffer)
  try {
    const ds = await getDataSource()
    const featureRepo = ds.getRepository(FeatureEntity)
    const screenshotRepo = ds.getRepository(ScreenshotEntity)
    const ext = path.extname(fileName).toLowerCase()
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream'
    let feature = await featureRepo.findOne({ where: { appSlug, name: featureName } })
    if (!feature) {
      feature = (await featureRepo.save({ appSlug, name: featureName, workflow: '', testcases: '', lastModified: new Date() })) as IFeature
    }
    const existing = await screenshotRepo
      .createQueryBuilder('s').innerJoin('s.feature', 'f')
      .where('f.id = :fId AND s.fileName = :fn', { fId: feature.id, fn: fileName }).getOne()
    if (existing) {
      await screenshotRepo.update(existing.id, { data: buffer, mimeType })
    } else {
      await screenshotRepo.save({ feature, fileName, mimeType, data: buffer, uploadedAt: new Date() } as Omit<IScreenshot, 'id'>)
    }
  } catch {
    // DB unavailable — filesystem write above is sufficient
  }
}

export async function deleteScreenshot(
  appSlug: string,
  featureName: string,
  fileName: string
): Promise<boolean> {
  // Delete from filesystem first
  const screenshotPath = path.join(featuresDir(appSlug), featureName, 'screenshots', fileName)
  const existsOnDisk = fs.existsSync(screenshotPath)
  if (existsOnDisk) fs.unlinkSync(screenshotPath)
  try {
    const ds = await getDataSource()
    const screenshotRepo = ds.getRepository(ScreenshotEntity)
    const screenshot = await screenshotRepo
      .createQueryBuilder('s').innerJoin('s.feature', 'f')
      .where('f.appSlug = :appSlug AND f.name = :name AND s.fileName = :fn', { appSlug, name: featureName, fn: fileName })
      .getOne()
    if (screenshot) await screenshotRepo.delete(screenshot.id)
    return existsOnDisk || !!screenshot
  } catch {
    return existsOnDisk
  }
}

export async function getScreenshotData(
  appSlug: string,
  featureName: string,
  fileName: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  try {
    const ds = await getDataSource()
    const screenshot = await ds
      .getRepository(ScreenshotEntity)
      .createQueryBuilder('s')
      .select(['s.id', 's.data', 's.mimeType'])
      .innerJoin('s.feature', 'f')
      .where('f.appSlug = :appSlug AND f.name = :name AND s.fileName = :fn', { appSlug, name: featureName, fn: fileName })
      .getOne()
    if (screenshot) return { data: screenshot.data, mimeType: screenshot.mimeType }
  } catch {
    // Fall through to filesystem
  }
  // Fallback: filesystem
  const screenshotPath = path.join(featuresDir(appSlug), featureName, 'screenshots', fileName)
  if (!fs.existsSync(screenshotPath)) return null
  const ext = path.extname(fileName).toLowerCase()
  const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream'
  return { data: fs.readFileSync(screenshotPath), mimeType }
}

/** Still filesystem-based — examples are static template files, not stored in DB. */
export function listExamples(appSlug: string): string[] {
  const dir = examplesDir(appSlug)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith('-testcases.md'))
}

/** FS location of the requirements doc: FRs.md for the app root, FRs-{module}.md per module. */
function requirementsFile(appSlug: string, module: string | null): string {
  return path.join(getDataRoot(), appSlug, 'requirements', module ? `FRs-${module}.md` : 'FRs.md')
}

const isTableSeparator = (l: string) => /^\|[\s\-|:]+\|$/.test(l.trim())

/** Escape characters that would break a markdown table cell. */
function sanitizeTableCell(value: string): string {
  return value.replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim()
}

/** Persist a requirements doc: DB upsert (row created on first write) + FS mirror. */
async function saveRequirementsDoc(appSlug: string, module: string | null, content: string): Promise<void> {
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(RequirementEntity)
    const qb = repo.createQueryBuilder('r').where('r.appSlug = :appSlug', { appSlug })
    if (module === null) qb.andWhere('r.module IS NULL')
    else qb.andWhere('r.module = :module', { module })
    const row = await qb.getOne()
    if (row) await repo.update(row.id, { content })
    else await repo.save({ appSlug, content, module })
  } catch {
    // DB unavailable — FS write below is sufficient
  }
  try {
    const file = requirementsFile(appSlug, module)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content, 'utf-8')
  } catch {
    // Non-fatal
  }
}

export async function getRequirements(appSlug: string, module?: string | null): Promise<string> {
  const moduleVal = module ?? null
  try {
    const ds = await getDataSource()
    const qb = ds.getRepository(RequirementEntity).createQueryBuilder('r').where('r.appSlug = :appSlug', { appSlug })
    if (moduleVal === null) qb.andWhere('r.module IS NULL')
    else qb.andWhere('r.module = :module', { module: moduleVal })
    const row = await qb.getOne()
    if (row?.content) return row.content
  } catch {
    // DB unavailable — fall through to file
  }
  const file = requirementsFile(appSlug, moduleVal)
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf-8')
  return ''
}

export async function updateRequirement(
  appSlug: string,
  rowIndex: number,
  field: 'status' | 'priority',
  value: string,
  module?: string | null
): Promise<boolean> {
  const moduleVal = module ?? null

  function applyUpdate(content: string): string | null {
    const allLines = content.split('\n')
    const tableLineIndices = allLines
      .map((l, i) => ({ line: l, idx: i }))
      .filter(({ line }) => line.trim().startsWith('|'))

    const dataRows = tableLineIndices.filter(({ line }) => !isTableSeparator(line))
    const target = dataRows[rowIndex + 1] // +1 to skip header
    if (!target) return null

    const headers = dataRows[0].line.split('|').slice(1, -1).map((h) => h.trim())
    const colIdx = headers.findIndex((h) => h.toLowerCase().includes(field))
    if (colIdx === -1) return null

    const parts = target.line.split('|')
    parts[colIdx + 1] = ` ${value} `
    allLines[target.idx] = parts.join('|')
    return allLines.join('\n')
  }

  const content = await getRequirements(appSlug, moduleVal)
  if (!content) return false
  const updated = applyUpdate(content)
  if (!updated) return false
  await saveRequirementsDoc(appSlug, moduleVal, updated)
  return true
}

export interface NewRequirementRow {
  id: string
  requirement: string
  module?: string
  priority?: string
  status?: string
}

/**
 * Append FR rows to the requirements table, creating the doc (and its table)
 * on first write. Rows whose ID already exists — or that lack an ID or
 * requirement text — are skipped, not overwritten.
 */
export async function addRequirementRows(
  appSlug: string,
  rows: NewRequirementRow[],
  module?: string | null
): Promise<{ added: string[]; skipped: string[] }> {
  const moduleVal = module ?? null
  let content = (await getRequirements(appSlug, moduleVal)).replace(/\s+$/, '')

  let allLines = content ? content.split('\n') : []
  let tableLines = allLines
    .map((l, i) => ({ line: l, idx: i }))
    .filter(({ line }) => line.trim().startsWith('|'))

  if (tableLines.filter(({ line }) => !isTableSeparator(line)).length === 0) {
    // No table yet — scaffold one below any existing prose.
    const title = `# Functional Requirements${moduleVal ? ` — ${moduleVal}` : ''}`
    const scaffold = ['| ID | Requirement | Module | Priority | Status |', '|----|-------------|--------|----------|--------|']
    allLines = content ? [...allLines, '', ...scaffold] : [title, '', ...scaffold]
    tableLines = allLines
      .map((l, i) => ({ line: l, idx: i }))
      .filter(({ line }) => line.trim().startsWith('|'))
  }

  const dataRows = tableLines.filter(({ line }) => !isTableSeparator(line))
  const headers = dataRows[0].line.split('|').slice(1, -1).map((h) => h.trim())
  const idCol = Math.max(0, headers.findIndex((h) => h.toLowerCase() === 'id'))
  const existingIds = new Set(
    dataRows.slice(1).map(({ line }) => line.split('|').slice(1, -1)[idCol]?.trim()).filter(Boolean)
  )

  // Map known fields onto whatever columns this table actually has.
  const cellFor = (header: string, row: NewRequirementRow): string => {
    const h = header.toLowerCase()
    if (h === 'id') return sanitizeTableCell(row.id)
    if (h.includes('requirement')) return sanitizeTableCell(row.requirement)
    if (h.includes('module')) return sanitizeTableCell(row.module ?? '')
    if (h.includes('priority')) return sanitizeTableCell(row.priority ?? 'P2')
    if (h.includes('status')) return sanitizeTableCell(row.status ?? 'Not Started')
    return ''
  }

  const added: string[] = []
  const skipped: string[] = []
  const newLines: string[] = []
  for (const row of rows) {
    const id = sanitizeTableCell(row.id ?? '')
    if (!id || !row.requirement?.trim() || existingIds.has(id)) {
      skipped.push(row.id ?? '')
      continue
    }
    existingIds.add(id)
    newLines.push(`| ${headers.map((h) => cellFor(h, row)).join(' | ')} |`)
    added.push(id)
  }

  if (newLines.length > 0) {
    const lastTableIdx = tableLines[tableLines.length - 1].idx
    allLines.splice(lastTableIdx + 1, 0, ...newLines)
    await saveRequirementsDoc(appSlug, moduleVal, allLines.join('\n') + '\n')
  }
  return { added, skipped }
}

/** Remove the FR row whose ID matches. Returns false when the doc or row is missing. */
export async function deleteRequirementRow(
  appSlug: string,
  frId: string,
  module?: string | null
): Promise<boolean> {
  const moduleVal = module ?? null
  const content = await getRequirements(appSlug, moduleVal)
  if (!content) return false

  const allLines = content.split('\n')
  const dataRows = allLines
    .map((l, i) => ({ line: l, idx: i }))
    .filter(({ line }) => line.trim().startsWith('|') && !isTableSeparator(line))
  if (dataRows.length < 2) return false

  const headers = dataRows[0].line.split('|').slice(1, -1).map((h) => h.trim())
  const idCol = Math.max(0, headers.findIndex((h) => h.toLowerCase() === 'id'))
  const target = dataRows.slice(1).find(({ line }) => line.split('|').slice(1, -1)[idCol]?.trim() === frId)
  if (!target) return false

  allLines.splice(target.idx, 1)
  await saveRequirementsDoc(appSlug, moduleVal, allLines.join('\n'))
  return true
}

export async function getAppStats(appSlug: string): Promise<{
  totalFeatures: number
  totalTestcases: number
  featuresWithTestcases: number
  totalScreenshots: number
}> {
  const features = await listFeatures(appSlug)
  return {
    totalFeatures: features.length,
    totalTestcases: features.reduce((acc, f) => acc + f.testcaseCount, 0),
    featuresWithTestcases: features.filter((f) => f.hasTestcases).length,
    totalScreenshots: features.reduce((acc, f) => acc + f.screenshotCount, 0),
  }
}
