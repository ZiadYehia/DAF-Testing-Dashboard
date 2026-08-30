// Server-only: "is this app/module/feature ready for AI generation" scoring.
//
// When intake.json exists, readiness is exact (per-question answered/missing).
// When it's absent (grandfathered hand-written apps), readiness falls
// back to md-file heuristics so existing apps read as ready without ever having
// filled out a form.

import fs from 'fs'
import path from 'path'
import { intakeFileExists, readIntake } from './intake'
import { APP_INTAKE_GROUPS, MODULE_INTAKE_GROUPS, FEATURE_INTAKE_GROUPS, type IntakeGroup, type IntakeValue } from './intake-types'
import { getDataRoot } from './paths'
import { getDataSource } from './db'
import { KnowledgeFileEntity, IKnowledgeFile, AutomationConfigEntity, IAutomationConfig } from './entities'

export interface GroupReadiness {
  id: string
  title: string
  answered: number
  total: number
  missing: string[]
}

export interface Readiness {
  score: number
  groups: GroupReadiness[]
  capabilities: {
    testcaseGen: string[]
    bugGen: string[]
    automation: string[]
  }
}

function isAnswered(v: IntakeValue | undefined): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) {
    if (v.length === 0) return false
    return v.some((row) => {
      if (row && typeof row === 'object') {
        return Object.values(row as Record<string, unknown>).some((x) => typeof x === 'string' && x.trim().length > 0)
      }
      return row != null
    })
  }
  return false
}

function scoreGroups(groups: IntakeGroup[], answers: Record<string, Record<string, IntakeValue>>): GroupReadiness[] {
  return groups.map((g) => {
    const groupAnswers = answers[g.id] ?? {}
    const missing: string[] = []
    let answered = 0
    for (const q of g.questions) {
      if (isAnswered(groupAnswers[q.id])) answered++
      else missing.push(q.label)
    }
    return { id: g.id, title: g.title, answered, total: g.questions.length, missing }
  })
}

/** An all-or-nothing group reading, used by the md-heuristic fallbacks. */
function heuristicGroup(g: IntakeGroup, ready: boolean): GroupReadiness {
  return {
    id: g.id,
    title: g.title,
    answered: ready ? g.questions.length : 0,
    total: g.questions.length,
    missing: ready ? [] : g.questions.map((q) => q.label),
  }
}

function nonEmptyFile(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.readFileSync(p, 'utf-8').trim().length > 0
  } catch {
    return false
  }
}

function scoreOf(groups: GroupReadiness[]): number {
  const total = groups.reduce((n, g) => n + g.total, 0)
  const answered = groups.reduce((n, g) => n + g.answered, 0)
  return total > 0 ? Math.round((answered / total) * 100) : 0
}

function missingLabels(g: GroupReadiness | undefined): string[] {
  return g ? g.missing.map((m) => `${g.title}: ${m}`) : []
}

// ─── App tier ───────────────────────────────────────────────────────────────────

/**
 * DB-first, per-bucket fallback: the app-level knowledge_files rows (docType
 * 'knowledge'/'bug-format') and the automation_configs row are queried directly
 * here via getDataSource (knowledge.ts is owned by a concurrently-running phase
 * of this migration and must not be imported into). Each of the three buckets
 * (app knowledge, bug-format, automation) falls back to its own FS heuristic
 * independently — an app can have e.g. an automation_configs row (saved anew
 * through the intake UI) while its domain/testing knowledge still lives only
 * in knowledge/*.md files that predate this migration.
 */
async function heuristicAppGroups(appSlug: string): Promise<GroupReadiness[]> {
  const root = getDataRoot()
  const knowledgeDir = path.join(root, appSlug, 'knowledge')
  const isRulesFile = (f: string) => /rule|format|writing|generation-process|standard/i.test(f)
  const isGlossaryFile = (f: string) => /glossary|terminolog/i.test(f)

  const domainReadyFs = (): boolean => {
    const mdFiles = fs.existsSync(knowledgeDir) ? fs.readdirSync(knowledgeDir).filter((f) => f.endsWith('.md')) : []
    const domainFile = mdFiles.find((f) => !isRulesFile(f) && !isGlossaryFile(f))
    return !!domainFile && nonEmptyFile(path.join(knowledgeDir, domainFile))
  }
  const testingReadyFs = (): boolean => nonEmptyFile(path.join(knowledgeDir, 'testcase-writing-rules.md'))
  const bugsReadyFs = (): boolean =>
    nonEmptyFile(path.join(root, appSlug, 'bug-format.md')) ||
    nonEmptyFile(path.join(process.cwd(), '.github', 'instructions', appSlug, 'bug-report-format.instructions.md'))
  const automationReadyFs = (): boolean => nonEmptyFile(path.join(root, appSlug, 'automation.json'))

  let appKnowledgeRows: IKnowledgeFile[] | null = null
  let bugFormatRows: IKnowledgeFile[] | null = null
  let automationRow: IAutomationConfig | null = null
  try {
    const ds = await getDataSource()
    const knowledgeRepo = ds.getRepository<IKnowledgeFile>(KnowledgeFileEntity)
    ;[appKnowledgeRows, bugFormatRows, automationRow] = await Promise.all([
      knowledgeRepo
        .createQueryBuilder('k')
        .where('k.appSlug = :appSlug', { appSlug })
        .andWhere('k.module IS NULL')
        .andWhere("k.docType = 'knowledge'")
        .getMany(),
      knowledgeRepo
        .createQueryBuilder('k')
        .where('k.appSlug = :appSlug', { appSlug })
        .andWhere('k.module IS NULL')
        .andWhere("k.docType = 'bug-format'")
        .getMany(),
      ds.getRepository<IAutomationConfig>(AutomationConfigEntity).findOne({ where: { appSlug } }),
    ])
  } catch (err) {
    console.warn(`[readiness] DB read failed for heuristicAppGroups("${appSlug}") — falling back to FS scans (${err})`)
  }

  const domainReady =
    appKnowledgeRows && appKnowledgeRows.length > 0
      ? (() => {
          const row = appKnowledgeRows!.find((r) => !isRulesFile(r.filename) && !isGlossaryFile(r.filename))
          return !!row && row.content.trim().length > 0
        })()
      : domainReadyFs()

  const testingReady =
    appKnowledgeRows && appKnowledgeRows.length > 0
      ? (() => {
          const row = appKnowledgeRows!.find((r) => r.filename === 'testcase-writing-rules.md')
          return !!row && row.content.trim().length > 0
        })()
      : testingReadyFs()

  const bugsReady =
    bugFormatRows && bugFormatRows.length > 0 ? bugFormatRows.some((r) => r.content.trim().length > 0) : bugsReadyFs()

  const automationReady = automationRow
    ? !!automationRow.baseUrlEnv.trim() || automationRow.login.trim() !== '[]'
    : automationReadyFs()

  const byId = (id: string) => APP_INTAKE_GROUPS.find((g) => g.id === id)!
  return [
    heuristicGroup(byId('domain'), domainReady),
    heuristicGroup(byId('testing'), testingReady),
    heuristicGroup(byId('bugs'), bugsReady),
    heuristicGroup(byId('automation'), automationReady),
  ]
}

export async function appReadiness(appSlug: string): Promise<Readiness> {
  const scope = { app: appSlug }
  const groups = (await intakeFileExists(scope))
    ? scoreGroups(APP_INTAKE_GROUPS, (await readIntake(scope)).answers)
    : await heuristicAppGroups(appSlug)

  const byId = (id: string) => groups.find((g) => g.id === id)

  return {
    score: scoreOf(groups),
    groups,
    capabilities: {
      testcaseGen: [...missingLabels(byId('domain')), ...missingLabels(byId('testing'))],
      bugGen: [...missingLabels(byId('domain')), ...missingLabels(byId('bugs'))],
      automation: missingLabels(byId('automation')),
    },
  }
}

// ─── Module tier ────────────────────────────────────────────────────────────────

async function moduleKnowledgeReadyFs(appSlug: string, moduleSlug: string): Promise<boolean> {
  const dir = path.join(getDataRoot(), appSlug, 'modules', moduleSlug, 'knowledge')
  return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.md') && nonEmptyFile(path.join(dir, f)))
}

export async function moduleReadiness(appSlug: string, moduleSlug: string): Promise<Readiness> {
  const scope = { app: appSlug, module: moduleSlug }
  const group = MODULE_INTAKE_GROUPS[0]

  let groups: GroupReadiness[]
  if (await intakeFileExists(scope)) {
    groups = scoreGroups(MODULE_INTAKE_GROUPS, (await readIntake(scope)).answers)
  } else {
    let hasAny: boolean
    try {
      const ds = await getDataSource()
      const rows = await ds
        .getRepository<IKnowledgeFile>(KnowledgeFileEntity)
        .createQueryBuilder('k')
        .where('k.appSlug = :appSlug', { appSlug })
        .andWhere('k.module = :module', { module: moduleSlug })
        .andWhere("k.docType = 'knowledge'")
        .getMany()
      hasAny = rows.length > 0 ? rows.some((r) => r.content.trim().length > 0) : await moduleKnowledgeReadyFs(appSlug, moduleSlug)
    } catch (err) {
      console.warn(`[readiness] DB read failed for moduleReadiness("${appSlug}/${moduleSlug}") — falling back to FS scan (${err})`)
      hasAny = await moduleKnowledgeReadyFs(appSlug, moduleSlug)
    }
    groups = [heuristicGroup(group, hasAny)]
  }

  const app = await appReadiness(appSlug)
  const ownMissing = groups.flatMap((g) => missingLabels(g))

  return {
    score: scoreOf(groups),
    groups,
    capabilities: {
      testcaseGen: [...app.capabilities.testcaseGen, ...ownMissing],
      bugGen: app.capabilities.bugGen,
      automation: app.capabilities.automation,
    },
  }
}

// ─── Feature tier ───────────────────────────────────────────────────────────────

export async function featureReadiness(appSlug: string, featureSlug: string): Promise<Readiness> {
  const scope = { app: appSlug, feature: featureSlug }
  const group = FEATURE_INTAKE_GROUPS[0]

  // Workflow/screenshot checks stay FS-based this phase — the features domain
  // (src/lib/features.ts) isn't part of this migration pass.
  const workflowPath = path.join(getDataRoot(), appSlug, 'features', featureSlug, 'workflow.md')
  const screenshotsDir = path.join(getDataRoot(), appSlug, 'features', featureSlug, 'screenshots')
  const hasWorkflow = nonEmptyFile(workflowPath)
  const hasScreenshot =
    fs.existsSync(screenshotsDir) && fs.readdirSync(screenshotsDir).some((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))

  let groups: GroupReadiness[]
  if (await intakeFileExists(scope)) {
    groups = scoreGroups(FEATURE_INTAKE_GROUPS, (await readIntake(scope)).answers)
  } else {
    groups = [heuristicGroup(group, hasWorkflow && hasScreenshot)]
  }

  const app = await appReadiness(appSlug)
  const ownMissing = groups.flatMap((g) => missingLabels(g))
  const extra: string[] = []
  if (!hasWorkflow) extra.push('Feature workflow (workflow.md)')
  if (!hasScreenshot) extra.push('At least one screenshot')

  return {
    score: scoreOf(groups),
    groups,
    capabilities: {
      testcaseGen: [...app.capabilities.testcaseGen, ...ownMissing, ...extra],
      bugGen: app.capabilities.bugGen,
      automation: app.capabilities.automation,
    },
  }
}
