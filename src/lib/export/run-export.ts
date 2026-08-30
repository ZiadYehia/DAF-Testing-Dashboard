// Next.js-world export orchestrator — the sibling of database/src/seed/export.ts
// for the EntitySchema/getDataSource() ORM world (src/lib/entities.ts). Used by
// POST /api/admin/export so an admin can trigger the same one-way DB → data/
// file-tree export interactively, without shelling out to the CLI.
//
// Duplicates export.ts's fetch/prune logic against the Next.js entity set
// rather than sharing it — the two tsconfigs use incompatible entity
// definitions (EntitySchema vs decorator classes) and module systems, so only
// the pure formatting layer (./serializers) is shared, per the plan's
// allowance to duplicate thin data-fetch layers per side.
import fs from 'fs'
import path from 'path'
import { getDataSource } from '@/lib/db'
import { getDataRoot } from '@/lib/paths'
import {
  AppEntity, IApp,
  ModuleEntity, IModule,
  FeatureEntity, IFeature,
  AcceptanceCriterionEntity,
  TestcaseVersionEntity,
  TestExecutionEntity,
  BugEntity, IBug,
  KnowledgeFileEntity, IKnowledgeFile,
  RequirementEntity, IRequirement,
  StoryLinkEntity, IStoryLink,
  UserStoryEntity, IUserStory,
  IntakeDocumentEntity, IIntakeDocument,
  AutomationConfigEntity, IAutomationConfig,
} from '@/lib/entities'
import {
  serializeApps,
  serializeModule,
  serializeIntake,
  serializeKnowledgeFile,
  serializeFeature,
  serializeExecution,
  serializeBug,
  serializeRequirements,
  serializeStoryLinks,
  serializeStory,
  serializeAutomationConfig,
  knowledgeRelPath,
  type SerializedFile,
  type IntakeScopeInput,
} from './serializers'

export interface RunExportOptions {
  /** Defaults to getDataRoot(). */
  dataRoot?: string
  /** Scope the export to a single app slug. apps.json still lists every app. */
  appSlug?: string
}

export interface RunExportSummary {
  dataRoot: string
  apps: string[]
  countsByEntity: Record<string, number>
  filesWritten: number
  filesDeleted: number
  orphanedBinaries: string[]
}

const MANAGED_FEATURE_FILE = /^(workflow\.md|[^/]+-testcases(-v\d+)?\.md|metadata\.json|knowledge\.md|acceptance-criteria\.json|last-addition\.json|execution-status(-v\d+)?\.json|execution-bugs(-v\d+)?\.json|execution-notes(-v\d+)?\.json|intake\.json)$/

function listDirSafe(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
}

function isDirSafe(p: string): boolean {
  try { return fs.statSync(p).isDirectory() } catch { return false }
}

function writeFile(root: string, relPath: string, content: string): void {
  const full = path.join(root, relPath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf-8')
}

function deleteFileSafe(full: string): boolean {
  try {
    if (fs.existsSync(full)) { fs.unlinkSync(full); return true }
  } catch { /* non-fatal */ }
  return false
}

/** Renders the database back into the `data/` file tree (see database/src/seed/export.ts
 *  for the CLI sibling and the full pruning-rules writeup). */
export async function runExport(opts: RunExportOptions = {}): Promise<RunExportSummary> {
  const dataRoot = opts.dataRoot ?? getDataRoot()
  const ds = await getDataSource()

  const countsByEntity = new Map<string, number>()
  const bump = (concept: string, n = 1) => countsByEntity.set(concept, (countsByEntity.get(concept) ?? 0) + n)
  let filesWritten = 0
  let filesDeleted = 0
  const orphanedBinaries: string[] = []

  function writeAll(root: string, files: SerializedFile[]): void {
    for (const f of files) { writeFile(root, f.relPath, f.content); filesWritten++ }
  }

  async function exportApp(appSlug: string): Promise<void> {
    const appRoot = path.join(dataRoot, appSlug)
    const expected = new Set<string>()
    const track = (files: SerializedFile[]): SerializedFile[] => {
      for (const f of files) expected.add(f.relPath)
      return files
    }

    // ── Modules ──
    const modules = await ds.getRepository<IModule>(ModuleEntity).find({ where: { appSlug } })
    for (const m of modules) {
      writeAll(appRoot, track(serializeModule({
        slug: m.slug, name: m.name, icon: m.icon, order: m.sortOrder, pathPrefix: m.pathPrefix, description: m.description,
      })))
      bump('modules')
    }
    const dbModuleSlugs = new Set(modules.map((m) => m.slug))
    for (const slug of listDirSafe(path.join(appRoot, 'modules'))) {
      if (!isDirSafe(path.join(appRoot, 'modules', slug))) continue
      const manifestPath = path.join(appRoot, 'modules', slug, 'module.json')
      if (!dbModuleSlugs.has(slug) && fs.existsSync(manifestPath) && deleteFileSafe(manifestPath)) filesDeleted++
    }

    // ── Intake documents ──
    const intakeDocs = await ds.getRepository<IIntakeDocument>(IntakeDocumentEntity).find({ where: { appSlug } })
    for (const doc of intakeDocs) {
      let scope: IntakeScopeInput
      if (doc.scopeKind === 'module') scope = { kind: 'module', module: doc.scopeSlug }
      else if (doc.scopeKind === 'feature') scope = { kind: 'feature', feature: doc.scopeSlug }
      else scope = { kind: 'app' }
      let answers: Record<string, unknown> = {}
      try { answers = JSON.parse(doc.answers) } catch { /* malformed — skip */ }
      writeAll(appRoot, track(serializeIntake(scope, {
        updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date(0).toISOString(), answers,
      })))
      bump('intake-documents')
    }
    const intakeKeys = new Set(intakeDocs.map((d) => `${d.scopeKind}:${d.scopeSlug}`))
    if (!intakeKeys.has('app:') && fs.existsSync(path.join(appRoot, 'intake.json'))) {
      if (deleteFileSafe(path.join(appRoot, 'intake.json'))) filesDeleted++
    }

    // ── Knowledge files ──
    const knowledgeRows = await ds.getRepository<IKnowledgeFile>(KnowledgeFileEntity).find({ where: { appSlug } })
    for (const row of knowledgeRows) {
      writeAll(appRoot, track(serializeKnowledgeFile({
        filename: row.filename, content: row.content, module: row.module ?? null, docType: row.docType ?? 'knowledge',
      })))
      bump('knowledge-files')
    }
    const expectedKnowledgePaths = new Set(
      knowledgeRows.map((r) => knowledgeRelPath({ filename: r.filename, module: r.module ?? null, docType: r.docType ?? 'knowledge' }))
    )
    const knowledgeCandidates: string[] = []
    for (const f of listDirSafe(path.join(appRoot, 'knowledge'))) if (f.endsWith('.md')) knowledgeCandidates.push(`knowledge/${f}`)
    for (const f of listDirSafe(path.join(appRoot, 'examples'))) if (f.endsWith('.md')) knowledgeCandidates.push(`examples/${f}`)
    if (fs.existsSync(path.join(appRoot, 'bug-format.md'))) knowledgeCandidates.push('bug-format.md')
    if (fs.existsSync(path.join(appRoot, '.github', 'templates', 'workflow-template.md'))) {
      knowledgeCandidates.push('.github/templates/workflow-template.md')
    }
    for (const modSlug of listDirSafe(path.join(appRoot, 'modules'))) {
      for (const f of listDirSafe(path.join(appRoot, 'modules', modSlug, 'knowledge'))) {
        if (f.endsWith('.md')) knowledgeCandidates.push(`modules/${modSlug}/knowledge/${f}`)
      }
    }
    for (const rel of knowledgeCandidates) {
      if (!expectedKnowledgePaths.has(rel) && deleteFileSafe(path.join(appRoot, rel))) filesDeleted++
    }

    // ── Features ──
    const features = await ds.getRepository<IFeature>(FeatureEntity).find({ where: { appSlug } })
    const acRepo = ds.getRepository(AcceptanceCriterionEntity)
    const tvRepo = ds.getRepository(TestcaseVersionEntity)
    const teRepo = ds.getRepository(TestExecutionEntity)

    for (const feature of features) {
      const acs = await acRepo.createQueryBuilder('ac')
        .where('ac.featureId = :fId', { fId: feature.id }).orderBy('ac.sortOrder', 'ASC').getMany()
      const versions = await tvRepo.createQueryBuilder('tv')
        .where('tv.featureId = :fId', { fId: feature.id }).orderBy('tv.version', 'ASC').getMany()

      let lastAddition: { ids: string[]; version: number; at: string } | null = null
      if (feature.lastAddition) { try { lastAddition = JSON.parse(feature.lastAddition) } catch { lastAddition = null } }

      const featureFiles = serializeFeature({
        name: feature.name,
        workflow: feature.workflow,
        testcases: feature.testcases,
        knowledge: feature.knowledge ?? null,
        metadata: {
          jiraKey: feature.jiraKey ?? null,
          storyKey: feature.storyKey ?? null,
          module: feature.module ?? null,
          archivedAt: feature.archivedAt ? feature.archivedAt.toISOString() : null,
        },
        testcaseVersions: versions.map((v) => ({ version: v.version, content: v.content })),
        acceptanceCriteria: acs.map((ac) => ({
          id: ac.criterionKey, text: ac.text, parentId: ac.parentId, manualCoverage: ac.manualCoverage,
          aiCoveredBy: JSON.parse(ac.aiCoveredBy || '[]'), aiAnalyzedAt: ac.aiAnalyzedAt ? ac.aiAnalyzedAt.toISOString() : null,
        })),
        lastAddition,
      })
      writeAll(appRoot, track(featureFiles))
      bump('features')

      const teRows = await teRepo.createQueryBuilder('te').where('te.featureId = :fId', { fId: feature.id }).getMany()
      const byVersion = new Map<number | null, { status: Record<string, string>; bugs: Record<string, string>; notes: Record<string, string> }>()
      for (const row of teRows) {
        const key = row.version ?? null
        const bucket = byVersion.get(key) ?? { status: {}, bugs: {}, notes: {} }
        if (row.status) bucket.status[row.testcaseId] = row.status
        if (row.bugSlug) bucket.bugs[row.testcaseId] = row.bugSlug
        if (row.notes) bucket.notes[row.testcaseId] = row.notes
        byVersion.set(key, bucket)
      }
      for (const [version, maps] of byVersion) writeAll(appRoot, track(serializeExecution(feature.name, { version, ...maps })))
      bump('test-executions', teRows.length)

      for (const f of listDirSafe(path.join(appRoot, 'features', feature.name))) {
        if (!MANAGED_FEATURE_FILE.test(f)) continue
        const rel = `features/${feature.name}/${f}`
        if (!expected.has(rel) && deleteFileSafe(path.join(appRoot, rel))) filesDeleted++
      }
    }

    const dbFeatureNames = new Set(features.map((f) => f.name))
    for (const name of listDirSafe(path.join(appRoot, 'features'))) {
      const dir = path.join(appRoot, 'features', name)
      if (!isDirSafe(dir) || dbFeatureNames.has(name)) continue
      const screenshotsDir = path.join(dir, 'screenshots')
      const hasScreenshots = fs.existsSync(screenshotsDir) && listDirSafe(screenshotsDir).length > 0
      for (const f of listDirSafe(dir)) if (MANAGED_FEATURE_FILE.test(f) && deleteFileSafe(path.join(dir, f))) filesDeleted++
      if (hasScreenshots) {
        orphanedBinaries.push(`${appSlug}/features/${name}/screenshots (feature row deleted)`)
      } else {
        try { fs.rmdirSync(screenshotsDir) } catch { /* may not exist */ }
        try { fs.rmdirSync(dir) } catch { /* not empty — leave it */ }
      }
    }

    // ── Bugs ──
    const bugs = await ds.getRepository<IBug>(BugEntity).find({ where: { appSlug } })
    const bugKeys = new Set<string>()
    for (const bug of bugs) {
      bugKeys.add(`${bug.feature}::${bug.slug}`)
      writeAll(appRoot, track(serializeBug({
        feature: bug.feature, slug: bug.slug, title: bug.title, status: bug.status,
        jiraKey: bug.jiraKey, reportedAt: bug.reportedAt ? bug.reportedAt.toISOString() : null,
        priority: bug.priority, bugType: bug.bugType, parentKey: bug.parentKey, severity: bug.severity,
        layer: bug.layer, jiraStatus: bug.jiraStatus ?? null, jiraReporter: bug.jiraReporter ?? null,
        deletedAt: bug.deletedAt ? bug.deletedAt.toISOString() : null, body: bug.body,
      })))
      bump('bugs')
    }
    for (const featureDir of listDirSafe(path.join(appRoot, 'bugs'))) {
      const dir = path.join(appRoot, 'bugs', featureDir)
      if (!isDirSafe(dir)) continue
      for (const f of listDirSafe(dir)) {
        if (f === '_template.md' || f.endsWith('-attachments') || !f.endsWith('.md')) continue
        const slug = f.replace(/\.md$/, '')
        if (!bugKeys.has(`${featureDir}::${slug}`)) {
          if (deleteFileSafe(path.join(dir, f))) filesDeleted++
          const attachDir = path.join(dir, `${slug}-attachments`)
          if (fs.existsSync(attachDir) && listDirSafe(attachDir).length > 0) {
            orphanedBinaries.push(`${appSlug}/bugs/${featureDir}/${slug}-attachments (bug row deleted)`)
          }
        }
      }
    }

    // ── Requirements ──
    const reqRows = await ds.getRepository<IRequirement>(RequirementEntity).find({ where: { appSlug } })
    const expectedReqPaths = new Set<string>()
    for (const row of reqRows) {
      const files = serializeRequirements(row.module ?? null, row.content)
      for (const f of files) expectedReqPaths.add(f.relPath)
      writeAll(appRoot, files)
      if (files.length > 0) bump('requirements')
    }
    for (const f of listDirSafe(path.join(appRoot, 'requirements'))) {
      if (!/^FRs(-.+)?\.md$/.test(f)) continue
      const rel = `requirements/${f}`
      if (!expectedReqPaths.has(rel) && deleteFileSafe(path.join(appRoot, rel))) filesDeleted++
    }

    // ── Story links ──
    const linkRows = await ds.getRepository<IStoryLink>(StoryLinkEntity).find({ where: { appSlug }, order: { id: 'ASC' } })
    const links: Record<string, string> = {}
    for (const row of linkRows) if (row.storyKey) links[row.frId] = row.storyKey
    const linkFiles = serializeStoryLinks(links)
    writeAll(appRoot, linkFiles)
    if (linkFiles.length > 0) bump('story-links', linkRows.length)
    else if (deleteFileSafe(path.join(appRoot, 'requirements', 'story-links.json'))) filesDeleted++

    // ── User stories ──
    const stories = await ds.getRepository<IUserStory>(UserStoryEntity).find({ where: { appSlug } })
    const storyKeys = new Set(stories.map((s) => s.storyKey))
    for (const s of stories) {
      writeAll(appRoot, serializeStory({ key: s.storyKey, summary: s.summary, description: s.description }))
      bump('user-stories')
    }
    for (const f of listDirSafe(path.join(appRoot, 'stories'))) {
      if (!f.endsWith('.md') || f.toLowerCase() === 'index.md') continue
      const key = f.replace(/\.md$/i, '')
      if (!storyKeys.has(key) && deleteFileSafe(path.join(appRoot, 'stories', f))) filesDeleted++
    }

    // ── Automation config ──
    const autoRow = await ds.getRepository<IAutomationConfig>(AutomationConfigEntity).findOne({ where: { appSlug } })
    if (autoRow) {
      writeAll(appRoot, serializeAutomationConfig({
        slug: appSlug, baseUrlEnv: autoRow.baseUrlEnv,
        credentialEnvs: JSON.parse(autoRow.credentialEnvs || '[]'), login: JSON.parse(autoRow.login || '[]'),
        generatedFromIntake: autoRow.generatedFromIntake,
      }))
      bump('automation-configs')
    } else {
      const autoPath = path.join(appRoot, 'automation.json')
      if (fs.existsSync(autoPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(autoPath, 'utf-8'))
          if (parsed && parsed._derivedCache === true && deleteFileSafe(autoPath)) filesDeleted++
        } catch { /* unparsable — leave it alone */ }
      }
    }
  }

  const allApps = await ds.getRepository<IApp>(AppEntity).find({ order: { id: 'ASC' } })
  writeAll(dataRoot, serializeApps(allApps.map((a) => ({
    slug: a.slug, name: a.name, description: a.description, icon: a.icon, enabled: a.enabled,
    type: a.type, platform: a.platform, capabilities: JSON.parse(a.capabilities || '{}'),
  }))))
  bump('apps', allApps.length)

  const appSlugs = opts.appSlug ? allApps.filter((a) => a.slug === opts.appSlug).map((a) => a.slug) : allApps.map((a) => a.slug)
  for (const slug of appSlugs) await exportApp(slug)

  const manifest = {
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries([...countsByEntity.entries()].sort()),
    apps: allApps.map((a) => a.slug),
  }
  fs.writeFileSync(path.join(dataRoot, '.db-export.json'), JSON.stringify(manifest, null, 2), 'utf-8')

  const GENERATED_README_MARKER = '<!-- db-export-generated-readme -->'
  const readmePath = path.join(dataRoot, 'README.md')
  const shouldWriteReadme = !fs.existsSync(readmePath) || fs.readFileSync(readmePath, 'utf-8').includes(GENERATED_README_MARKER)
  if (shouldWriteReadme) {
    fs.writeFileSync(readmePath, `${GENERATED_README_MARKER}
# data/

This tree is a generated mirror of the database — the database is the source
of truth. It is regenerated by \`npm run db:export\` (see
\`database/src/seed/export.ts\`) and consumed back into the database by
\`npm run db:import\` (see \`database/src/seed/import.ts\`).

Do not hand-edit files here expecting them to persist — the next
\`db:export\` will overwrite them from the database. Screenshots and
attachments are binary and are never pruned or regenerated by the export.
`, 'utf-8')
  }

  return {
    dataRoot,
    apps: appSlugs,
    countsByEntity: Object.fromEntries(countsByEntity),
    filesWritten,
    filesDeleted,
    orphanedBinaries,
  }
}
