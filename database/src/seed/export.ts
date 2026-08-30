/**
 * One-way export — renders the database back into the `data/` file tree, in
 * the exact on-disk layout git already tracks, so `git diff` stays
 * meaningful after a DB edit and `db:export` output round-trips through
 * `db:import` (database/src/seed/import.ts) losslessly.
 *
 * All the actual formatting lives in src/lib/export/serializers.ts (pure,
 * zero ORM/fs) — this file is just the data-fetch + fs-write + prune shell
 * for the decorator-entity ("database/") ORM world. src/lib/export/run-export.ts
 * is the sibling shell for the Next.js (EntitySchema) world, used by the
 * admin "Export to files" button — the two duplicate fetch/prune logic
 * rather than share it, since the two tsconfigs use incompatible entity
 * definitions (decorators vs EntitySchema) and module systems.
 *
 * Run with:  npm run db:export
 *
 * Flags:
 *   --app <slug>   Only export the given app (apps.json still lists every app).
 *   --out <dir>    Write under this directory instead of DATA_ROOT.
 *
 * PRUNING: deletes managed TEXT files (workflow.md, testcases*.md,
 * metadata.json, knowledge.md, acceptance-criteria.json, last-addition.json,
 * execution-*.json, bug .md, knowledge/example/template .md, module.json,
 * intake.json, FRs*.md, story-links.json, stories/*.md) that no longer have
 * a backing DB row. NEVER touches screenshots/, *-attachments/ directories,
 * or any binary — those are reported (not deleted) when their owning
 * feature/bug row is gone.
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import { AppDataSource } from '../data-source'
import { App } from '../entities/App'
import { Module } from '../entities/Module'
import { Feature } from '../entities/Feature'
import { AcceptanceCriterion } from '../entities/AcceptanceCriterion'
import { TestcaseVersion } from '../entities/TestcaseVersion'
import { TestExecution } from '../entities/TestExecution'
import { Bug } from '../entities/Bug'
import { KnowledgeFile } from '../entities/KnowledgeFile'
import { Requirement } from '../entities/Requirement'
import { StoryLink } from '../entities/StoryLink'
import { UserStory } from '../entities/UserStory'
import { IntakeDocument } from '../entities/IntakeDocument'
import { AutomationConfig } from '../entities/AutomationConfig'
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
} from '../../../src/lib/export/serializers'

// ─── CLI flags ────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { appFilter?: string; outDir?: string } {
  const appIdx = argv.indexOf('--app')
  const outIdx = argv.indexOf('--out')
  return {
    appFilter: appIdx !== -1 ? argv[appIdx + 1] : undefined,
    outDir: outIdx !== -1 ? argv[outIdx + 1] : undefined,
  }
}

const { appFilter: APP_FILTER, outDir: OUT_DIR } = parseArgs(process.argv.slice(2))

const OUT_ROOT = OUT_DIR
  ? path.resolve(OUT_DIR)
  : (process.env.DATA_ROOT ?? path.resolve(__dirname, '..', '..', '..', 'data'))

const MANAGED_FEATURE_FILE = /^(workflow\.md|[^/]+-testcases(-v\d+)?\.md|metadata\.json|knowledge\.md|acceptance-criteria\.json|last-addition\.json|execution-status(-v\d+)?\.json|execution-bugs(-v\d+)?\.json|execution-notes(-v\d+)?\.json|intake\.json)$/

// ─── Small fs helpers ────────────────────────────────────────────────────────

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

// ─── Counters ────────────────────────────────────────────────────────────────

const countsByEntity = new Map<string, number>()
function bump(concept: string, n = 1): void { countsByEntity.set(concept, (countsByEntity.get(concept) ?? 0) + n) }

let filesWritten = 0
let filesDeleted = 0
const orphanedBinaries: string[] = []

function writeAll(root: string, files: SerializedFile[]): void {
  for (const f of files) {
    writeFile(root, f.relPath, f.content)
    filesWritten++
  }
}

// ─── Per-app export ──────────────────────────────────────────────────────────

async function exportApp(appSlug: string): Promise<void> {
  const appRoot = path.join(OUT_ROOT, appSlug)
  const expected = new Set<string>() // relPaths (within appRoot) this run is authoritative for

  function track(files: SerializedFile[]): SerializedFile[] {
    for (const f of files) expected.add(f.relPath)
    return files
  }

  // ── Modules ──
  const moduleRepo = AppDataSource.getRepository(Module)
  const modules = await moduleRepo.find({ where: { appSlug } })
  for (const m of modules) {
    writeAll(appRoot, track(serializeModule({
      slug: m.slug, name: m.name, icon: m.icon, order: m.sortOrder, pathPrefix: m.pathPrefix, description: m.description,
    })))
    bump('modules')
  }
  // Prune stale module.json (DB row gone)
  const dbModuleSlugs = new Set(modules.map((m) => m.slug))
  for (const slug of listDirSafe(path.join(appRoot, 'modules'))) {
    if (!isDirSafe(path.join(appRoot, 'modules', slug))) continue
    const manifestPath = path.join(appRoot, 'modules', slug, 'module.json')
    if (!dbModuleSlugs.has(slug) && fs.existsSync(manifestPath)) {
      if (deleteFileSafe(manifestPath)) filesDeleted++
    }
  }

  // ── Intake documents ──
  const intakeRepo = AppDataSource.getRepository(IntakeDocument)
  const intakeDocs = await intakeRepo.find({ where: { appSlug } })
  for (const doc of intakeDocs) {
    let scope: IntakeScopeInput
    if (doc.scopeKind === 'module') scope = { kind: 'module', module: doc.scopeSlug }
    else if (doc.scopeKind === 'feature') scope = { kind: 'feature', feature: doc.scopeSlug }
    else scope = { kind: 'app' }
    let answers: Record<string, unknown> = {}
    try { answers = JSON.parse(doc.answers) } catch { /* malformed — skip */ }
    writeAll(appRoot, track(serializeIntake(scope, {
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date(0).toISOString(),
      answers,
    })))
    bump('intake-documents')
  }
  // Prune stale intake.json (app root + per module + per feature)
  const intakeKeys = new Set(intakeDocs.map((d) => `${d.scopeKind}:${d.scopeSlug}`))
  if (!intakeKeys.has('app:') && fs.existsSync(path.join(appRoot, 'intake.json'))) {
    if (deleteFileSafe(path.join(appRoot, 'intake.json'))) filesDeleted++
  }

  // ── Knowledge files (app/module knowledge, bug-format, examples, template) ──
  const knowledgeRepo = AppDataSource.getRepository(KnowledgeFile)
  const knowledgeRows = await knowledgeRepo.find({ where: { appSlug } })
  for (const row of knowledgeRows) {
    writeAll(appRoot, track(serializeKnowledgeFile({
      filename: row.filename, content: row.content, module: row.module, docType: row.docType,
    })))
    bump('knowledge-files')
  }
  // Prune stale knowledge/example/template files
  const expectedKnowledgePaths = new Set(knowledgeRows.map((r) => knowledgeRelPath(r)))
  const knowledgeCandidates: string[] = []
  for (const f of listDirSafe(path.join(appRoot, 'knowledge'))) if (f.endsWith('.md')) knowledgeCandidates.push(`knowledge/${f}`)
  for (const f of listDirSafe(path.join(appRoot, 'examples'))) if (f.endsWith('.md')) knowledgeCandidates.push(`examples/${f}`)
  if (fs.existsSync(path.join(appRoot, 'bug-format.md'))) knowledgeCandidates.push('bug-format.md')
  if (fs.existsSync(path.join(appRoot, '.github', 'templates', 'workflow-template.md'))) {
    knowledgeCandidates.push('.github/templates/workflow-template.md')
  }
  for (const modSlug of listDirSafe(path.join(appRoot, 'modules'))) {
    const modKnowledgeDir = path.join(appRoot, 'modules', modSlug, 'knowledge')
    for (const f of listDirSafe(modKnowledgeDir)) if (f.endsWith('.md')) knowledgeCandidates.push(`modules/${modSlug}/knowledge/${f}`)
  }
  for (const rel of knowledgeCandidates) {
    if (!expectedKnowledgePaths.has(rel)) {
      if (deleteFileSafe(path.join(appRoot, rel))) filesDeleted++
    }
  }

  // ── Features (workflow/testcases/versions/metadata/knowledge/AC/last-addition) ──
  const featureRepo = AppDataSource.getRepository(Feature)
  const features = await featureRepo.find({ where: { appSlug } })
  const acRepo = AppDataSource.getRepository(AcceptanceCriterion)
  const tvRepo = AppDataSource.getRepository(TestcaseVersion)
  const teRepo = AppDataSource.getRepository(TestExecution)

  for (const feature of features) {
    const acs = await acRepo.createQueryBuilder('ac')
      .where('ac.featureId = :fId', { fId: feature.id }).orderBy('ac.sortOrder', 'ASC').getMany()
    const versions = await tvRepo.createQueryBuilder('tv')
      .where('tv.featureId = :fId', { fId: feature.id }).orderBy('tv.version', 'ASC').getMany()

    let lastAddition: { ids: string[]; version: number; at: string } | null = null
    if (feature.lastAddition) {
      try { lastAddition = JSON.parse(feature.lastAddition) } catch { lastAddition = null }
    }

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
        id: ac.criterionKey, text: ac.text, parentId: ac.parentId,
        manualCoverage: ac.manualCoverage, aiCoveredBy: JSON.parse(ac.aiCoveredBy || '[]'),
        aiAnalyzedAt: ac.aiAnalyzedAt ? ac.aiAnalyzedAt.toISOString() : null,
      })),
      lastAddition,
    })
    writeAll(appRoot, track(featureFiles))
    bump('features')

    // Execution status/bugs per version (including the legacy flat null group)
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
    for (const [version, maps] of byVersion) {
      writeAll(appRoot, track(serializeExecution(feature.name, { version, ...maps })))
    }
    bump('test-executions', teRows.length)

    // Prune stale per-feature files (e.g. a version/metadata/knowledge file the DB no longer backs)
    for (const f of listDirSafe(path.join(appRoot, 'features', feature.name))) {
      if (!MANAGED_FEATURE_FILE.test(f)) continue
      const rel = `features/${feature.name}/${f}`
      if (!expected.has(rel)) {
        if (deleteFileSafe(path.join(appRoot, rel))) filesDeleted++
      }
    }
  }

  // Prune whole feature directories whose DB row is gone entirely
  const dbFeatureNames = new Set(features.map((f) => f.name))
  for (const name of listDirSafe(path.join(appRoot, 'features'))) {
    const dir = path.join(appRoot, 'features', name)
    if (!isDirSafe(dir) || dbFeatureNames.has(name)) continue
    const screenshotsDir = path.join(dir, 'screenshots')
    const hasScreenshots = fs.existsSync(screenshotsDir) && listDirSafe(screenshotsDir).length > 0
    for (const f of listDirSafe(dir)) {
      if (MANAGED_FEATURE_FILE.test(f)) { if (deleteFileSafe(path.join(dir, f))) filesDeleted++ }
    }
    if (hasScreenshots) {
      orphanedBinaries.push(`${appSlug}/features/${name}/screenshots (feature row deleted)`)
    } else {
      try { fs.rmdirSync(screenshotsDir) } catch { /* may not exist */ }
      try { fs.rmdirSync(dir) } catch { /* not empty — leave it, something unrecognized is present */ }
    }
  }

  // ── Bugs ──
  const bugRepo = AppDataSource.getRepository(Bug)
  const bugs = await bugRepo.find({ where: { appSlug } })
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
  // Prune bug .md files with no DB row + report orphaned attachment dirs
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

  // ── Requirements (FRs.md + FRs-<module>.md) ──
  const reqRepo = AppDataSource.getRepository(Requirement)
  const reqRows = await reqRepo.find({ where: { appSlug } })
  const expectedReqPaths = new Set<string>()
  for (const row of reqRows) {
    const files = serializeRequirements(row.module, row.content)
    for (const f of files) expectedReqPaths.add(f.relPath)
    writeAll(appRoot, files)
    if (files.length > 0) bump('requirements')
  }
  for (const f of listDirSafe(path.join(appRoot, 'requirements'))) {
    if (!/^FRs(-.+)?\.md$/.test(f)) continue
    const rel = `requirements/${f}`
    if (!expectedReqPaths.has(rel)) { if (deleteFileSafe(path.join(appRoot, rel))) filesDeleted++ }
  }

  // ── Story links ──
  const storyLinkRepo = AppDataSource.getRepository(StoryLink)
  const linkRows = await storyLinkRepo.find({ where: { appSlug }, order: { id: 'ASC' } })
  const links: Record<string, string> = {}
  for (const row of linkRows) if (row.storyKey) links[row.frId] = row.storyKey
  const linkFiles = serializeStoryLinks(links)
  writeAll(appRoot, linkFiles)
  if (linkFiles.length > 0) bump('story-links', linkRows.length)
  else if (deleteFileSafe(path.join(appRoot, 'requirements', 'story-links.json'))) filesDeleted++

  // ── User stories ──
  const storyRepo = AppDataSource.getRepository(UserStory)
  const stories = await storyRepo.find({ where: { appSlug } })
  const storyKeys = new Set(stories.map((s) => s.storyKey))
  for (const s of stories) {
    writeAll(appRoot, serializeStory({ key: s.storyKey, summary: s.summary, description: s.description }))
    bump('user-stories')
  }
  for (const f of listDirSafe(path.join(appRoot, 'stories'))) {
    if (!f.endsWith('.md') || f.toLowerCase() === 'index.md') continue
    const key = f.replace(/\.md$/i, '')
    if (!storyKeys.has(key)) { if (deleteFileSafe(path.join(appRoot, 'stories', f))) filesDeleted++ }
  }

  // ── Automation config ──
  const autoRepo = AppDataSource.getRepository(AutomationConfig)
  const autoRow = await autoRepo.findOne({ where: { appSlug } })
  if (autoRow) {
    writeAll(appRoot, serializeAutomationConfig({
      slug: appSlug, baseUrlEnv: autoRow.baseUrlEnv,
      credentialEnvs: JSON.parse(autoRow.credentialEnvs || '[]'),
      login: JSON.parse(autoRow.login || '[]'),
      generatedFromIntake: autoRow.generatedFromIntake,
    }))
    bump('automation-configs')
  } else {
    // Only prune a file WE generated (carries our marker) — never touch a
    // hand-written automation.json for an app with no automation_configs row.
    const autoPath = path.join(appRoot, 'automation.json')
    if (fs.existsSync(autoPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(autoPath, 'utf-8'))
        if (parsed && parsed._derivedCache === true) { if (deleteFileSafe(autoPath)) filesDeleted++ }
      } catch { /* unparsable — leave it alone */ }
    }
  }
}

// ─── Manifest + README ───────────────────────────────────────────────────────

const GENERATED_README_MARKER = '<!-- db-export-generated-readme -->'

function writeManifestAndReadme(appSlugs: string[]): void {
  const manifest = {
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries([...countsByEntity.entries()].sort()),
    apps: appSlugs,
  }
  fs.writeFileSync(path.join(OUT_ROOT, '.db-export.json'), JSON.stringify(manifest, null, 2), 'utf-8')

  const readmePath = path.join(OUT_ROOT, 'README.md')
  const shouldWrite = !fs.existsSync(readmePath) || fs.readFileSync(readmePath, 'utf-8').includes(GENERATED_README_MARKER)
  if (shouldWrite) {
    const content = `${GENERATED_README_MARKER}
# data/

This tree is a generated mirror of the database — the database is the source
of truth. It is regenerated by \`npm run db:export\` (see
\`database/src/seed/export.ts\`) and consumed back into the database by
\`npm run db:import\` (see \`database/src/seed/import.ts\`).

Do not hand-edit files here expecting them to persist — the next
\`db:export\` will overwrite them from the database. Screenshots and
attachments are binary and are never pruned or regenerated by the export.
`
    fs.writeFileSync(readmePath, content, 'utf-8')
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`OUT_ROOT: ${OUT_ROOT}`)
  if (APP_FILTER) console.log(`App filter: ${APP_FILTER}`)
  console.log('Connecting to database...')
  await AppDataSource.initialize()
  console.log('Connected.\n')

  // apps.json always lists every app, regardless of --app scoping.
  const appRepo = AppDataSource.getRepository(App)
  const allApps = await appRepo.find({ order: { id: 'ASC' } })
  writeAll(OUT_ROOT, serializeApps(allApps.map((a) => ({
    slug: a.slug, name: a.name, description: a.description, icon: a.icon, enabled: a.enabled,
    type: a.type, platform: a.platform, capabilities: JSON.parse(a.capabilities || '{}'),
  }))))
  bump('apps', allApps.length)

  const appSlugs = APP_FILTER ? allApps.filter((a) => a.slug === APP_FILTER).map((a) => a.slug) : allApps.map((a) => a.slug)
  if (appSlugs.length === 0) {
    console.log('No matching apps found.')
  } else {
    console.log(`Apps: ${appSlugs.join(', ')}`)
    for (const slug of appSlugs) {
      console.log(`\n=== ${slug} ===`)
      await exportApp(slug)
    }
  }

  writeManifestAndReadme(allApps.map((a) => a.slug))

  console.log('\n=== Export summary ===')
  for (const [concept, n] of [...countsByEntity.entries()].sort()) console.log(`  ${concept}: ${n}`)
  console.log(`\nFiles written: ${filesWritten}`)
  console.log(`Files pruned:  ${filesDeleted}`)
  if (orphanedBinaries.length > 0) {
    console.log(`\nOrphaned binary directories (owning row deleted — left on disk, not touched):`)
    for (const o of orphanedBinaries) console.log(`  ${o}`)
  }

  await AppDataSource.destroy()
  console.log('\nExport complete.')
}

main().catch((err) => {
  console.error('Export failed:', err)
  process.exit(1)
})
