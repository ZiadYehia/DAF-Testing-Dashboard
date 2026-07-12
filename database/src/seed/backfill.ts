/**
 * Idempotent backfill — migrates existing filesystem data into the database.
 * Safe to re-run: uses upsert / count-before-insert patterns throughout.
 *
 * Run with:  npm run db:backfill
 */
import 'reflect-metadata'
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { AppDataSource } from '../data-source'
import { Bug } from '../entities/Bug'
import { Feature } from '../entities/Feature'
import { AcceptanceCriterion } from '../entities/AcceptanceCriterion'
import { TestcaseVersion } from '../entities/TestcaseVersion'
import { StoryLink } from '../entities/StoryLink'
import { UserStory } from '../entities/UserStory'
import { Requirement } from '../entities/Requirement'
import { KnowledgeFile } from '../entities/KnowledgeFile'

// ─── Config ────────────────────────────────────────────────────────────────────

const DATA_ROOT =
  process.env.DATA_ROOT ?? path.resolve(__dirname, '..', '..', '..', 'data')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return ''
  return fs.readFileSync(filePath, 'utf-8')
}

function parseStoryMd(raw: string): { summary: string; description: string } {
  const firstHeading = raw.match(/^#+\s+(.+)$/m)?.[1]?.trim()
  const firstLine = raw.split('\n').find((l) => l.trim().length > 0)?.trim() ?? ''
  const summary = firstHeading || firstLine.replace(/^\*+|\*+$/g, '')
  return { summary, description: raw }
}

function getAppSlugs(): string[] {
  if (!fs.existsSync(DATA_ROOT)) return []
  return fs
    .readdirSync(DATA_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
}

// ─── Per-app backfill functions ───────────────────────────────────────────────

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

  let newFeatures = 0
  let totalAcs = 0
  let totalVersions = 0

  for (const entry of entries) {
    const name = entry.name
    const featureDir = path.join(featDir, name)

    // ── Read FS data ──
    const workflow = readFile(path.join(featureDir, 'workflow.md'))
    const testcases = readFile(path.join(featureDir, `${name}-testcases.md`))
    const knowledgeRaw = readFile(path.join(featureDir, 'knowledge.md'))
    const knowledge = knowledgeRaw.trim() ? knowledgeRaw : null
    const workflowPath = path.join(featureDir, 'workflow.md')
    const lastModified = fs.existsSync(workflowPath)
      ? fs.statSync(workflowPath).mtime
      : null

    let jiraKey: string | null = null
    let storyKey: string | null = null
    const metaFile = path.join(featureDir, 'metadata.json')
    if (fs.existsSync(metaFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as {
          jiraKey?: string
          storyKey?: string
        }
        jiraKey = meta.jiraKey ?? null
        storyKey = meta.storyKey ?? null
      } catch { /* skip malformed */ }
    }

    // ── Upsert feature ──
    let feature = await featureRepo.findOne({ where: { appSlug, name } })
    if (!feature) {
      feature = await featureRepo.save({
        appSlug,
        name,
        workflow,
        testcases,
        lastModified,
        jiraKey,
        storyKey,
        knowledge,
      })
      newFeatures++
    } else {
      // Sync columns that may not have been written yet
      await featureRepo.update(feature.id, {
        jiraKey: feature.jiraKey ?? jiraKey,
        storyKey: feature.storyKey ?? storyKey,
        knowledge: feature.knowledge ?? knowledge,
      })
    }

    // ── Acceptance criteria (skip if already populated) ──
    const existingAcs = await acRepo.count({
      where: { feature: { id: feature.id } },
    })
    if (existingAcs === 0) {
      const acFile = path.join(featureDir, 'acceptance-criteria.json')
      if (fs.existsSync(acFile)) {
        try {
          const acs = JSON.parse(fs.readFileSync(acFile, 'utf-8')) as Array<{
            id: string
            text: string
            parentId?: string | null
            manualCoverage?: string | null
            aiCoveredBy?: string[]
            aiAnalyzedAt?: string | null
          }>
          for (let i = 0; i < acs.length; i++) {
            const ac = acs[i]
            await acRepo.save({
              criterionKey: ac.id,
              text: ac.text,
              parentId: ac.parentId ?? null,
              manualCoverage: ac.manualCoverage ?? null,
              aiCoveredBy: JSON.stringify(ac.aiCoveredBy ?? []),
              aiAnalyzedAt: ac.aiAnalyzedAt ? new Date(ac.aiAnalyzedAt) : null,
              sortOrder: i,
              feature: { id: feature.id },
            })
            totalAcs++
          }
        } catch (e) {
          console.warn(`    [warn] ACs for "${name}":`, (e as Error).message)
        }
      }
    }

    // ── Testcase versions (skip if already populated) ──
    const existingVersions = await tvRepo.count({
      where: { feature: { id: feature.id } },
    })
    if (existingVersions === 0) {
      const vRe = new RegExp(`^${name}-testcases-v(\\d+)\\.md$`)
      const vFiles = fs
        .readdirSync(featureDir)
        .filter((f) => vRe.test(f))
        .sort((a, b) => {
          const an = parseInt(a.match(vRe)![1], 10)
          const bn = parseInt(b.match(vRe)![1], 10)
          return an - bn
        })
      for (const vf of vFiles) {
        const vNum = parseInt(vf.match(vRe)![1], 10)
        const content = fs.readFileSync(path.join(featureDir, vf), 'utf-8')
        await tvRepo.save({
          version: vNum,
          content,
          feature: { id: feature.id },
        })
        totalVersions++
      }
    }
  }

  console.log(
    `  features: ${newFeatures} new | acs: ${totalAcs} inserted | versions: ${totalVersions} inserted`
  )
}

/**
 * Resolve the `module` value a bug should carry, derived from its feature.
 * A bug's module mirrors the URL path prefix of the feature's module:
 *   - the default module (path prefix "") → null  (the root /[app]/bugs list)
 *   - any other module (e.g. "framework", "risk") → that module's path prefix
 * Returns null when the feature has no module or no manifest is found.
 */
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

async function backfillBugs(appSlug: string): Promise<void> {
  const dir = path.join(DATA_ROOT, appSlug, 'bugs')
  if (!fs.existsSync(dir)) return

  const repo = AppDataSource.getRepository(Bug)
  let inserted = 0
  let skipped = 0

  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const feature = entry.name
    const featureDir = path.join(dir, feature)
    const module = resolveBugModule(appSlug, feature)

    for (const file of fs.readdirSync(featureDir).filter((f) => f.endsWith('.md') && f !== '_template.md')) {
      const slug = file.replace(/\.md$/, '')
      // Insert-only: never clobber a row that may have been edited through the app.
      const existing = await repo.findOne({ where: { appSlug, feature, slug } })
      if (existing) { skipped++; continue }

      const { data, content } = matter(fs.readFileSync(path.join(featureDir, file), 'utf-8'))
      await repo.save({
        appSlug,
        feature,
        slug,
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
        module,
        jiraStatus: data.jira_status ?? null,
        jiraReporter: data.jira_reporter ?? null,
      })
      inserted++
    }
  }

  if (inserted || skipped) console.log(`  bugs: ${inserted} inserted | ${skipped} already present`)
}

async function backfillStoryLinks(appSlug: string): Promise<void> {
  const file = path.join(DATA_ROOT, appSlug, 'requirements', 'story-links.json')
  if (!fs.existsSync(file)) return

  let links: Record<string, string>
  try {
    links = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, string>
  } catch {
    return
  }

  const repo = AppDataSource.getRepository(StoryLink)
  let count = 0
  for (const [frId, storyKey] of Object.entries(links)) {
    if (!frId || !storyKey) continue
    await repo.upsert({ appSlug, frId, storyKey }, ['appSlug', 'frId'])
    count++
  }
  if (count > 0) console.log(`  story-links: ${count} upserted`)
}

async function backfillUserStories(appSlug: string): Promise<void> {
  const dir = path.join(DATA_ROOT, appSlug, 'stories')
  if (!fs.existsSync(dir)) return

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'index.md')
  if (files.length === 0) return

  const repo = AppDataSource.getRepository(UserStory)
  let count = 0
  for (const f of files) {
    const storyKey = f.replace(/\.md$/i, '')
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
    const { summary, description } = parseStoryMd(raw)
    await repo.upsert(
      {
        appSlug,
        storyKey,
        summary,
        description,
        status: '',
        labels: '[]',
        components: '[]',
      },
      ['appSlug', 'storyKey']
    )
    count++
  }
  console.log(`  user-stories: ${count} upserted`)
}

async function backfillRequirements(appSlug: string): Promise<void> {
  const file = path.join(DATA_ROOT, appSlug, 'requirements', 'FRs.md')
  if (!fs.existsSync(file)) return

  const content = fs.readFileSync(file, 'utf-8')
  const repo = AppDataSource.getRepository(Requirement)
  await repo.upsert({ appSlug, content }, ['appSlug'])
  console.log(`  requirements: upserted`)
}

async function backfillKnowledgeFiles(appSlug: string): Promise<void> {
  const dir = path.join(DATA_ROOT, appSlug, 'knowledge')
  if (!fs.existsSync(dir)) return

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
  if (files.length === 0) return

  const repo = AppDataSource.getRepository(KnowledgeFile)
  let count = 0
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8')
    await repo.upsert({ appSlug, filename: f, content }, ['appSlug', 'filename'])
    count++
  }
  console.log(`  knowledge-files: ${count} upserted`)
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`DATA_ROOT: ${DATA_ROOT}`)
  console.log('Connecting to database...')
  await AppDataSource.initialize()
  console.log('Connected.\n')

  const apps = getAppSlugs()
  if (apps.length === 0) {
    console.log('No app directories found in DATA_ROOT. Nothing to backfill.')
    await AppDataSource.destroy()
    return
  }
  console.log(`Apps found: ${apps.join(', ')}`)

  for (const app of apps) {
    console.log(`\n=== ${app} ===`)
    await backfillFeatures(app)
    await backfillBugs(app)
    await backfillStoryLinks(app)
    await backfillUserStories(app)
    await backfillRequirements(app)
    await backfillKnowledgeFiles(app)
  }

  await AppDataSource.destroy()
  console.log('\nBackfill complete.')
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
