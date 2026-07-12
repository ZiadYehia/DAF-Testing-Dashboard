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

function heuristicAppGroups(appSlug: string): GroupReadiness[] {
  const root = getDataRoot()
  const knowledgeDir = path.join(root, appSlug, 'knowledge')
  const mdFiles = fs.existsSync(knowledgeDir) ? fs.readdirSync(knowledgeDir).filter((f) => f.endsWith('.md')) : []
  const isRulesFile = (f: string) => /rule|format|writing|generation-process|standard/i.test(f)
  const isGlossaryFile = (f: string) => /glossary|terminolog/i.test(f)

  const domainFile = mdFiles.find((f) => !isRulesFile(f) && !isGlossaryFile(f))
  const domainReady = !!domainFile && nonEmptyFile(path.join(knowledgeDir, domainFile))
  const testingReady = nonEmptyFile(path.join(knowledgeDir, 'testcase-writing-rules.md'))
  const bugsReady =
    nonEmptyFile(path.join(root, appSlug, 'bug-format.md')) ||
    nonEmptyFile(path.join(process.cwd(), '.github', 'instructions', appSlug, 'bug-report-format.instructions.md'))
  const automationReady = nonEmptyFile(path.join(root, appSlug, 'automation.json'))

  const byId = (id: string) => APP_INTAKE_GROUPS.find((g) => g.id === id)!
  return [
    heuristicGroup(byId('domain'), domainReady),
    heuristicGroup(byId('testing'), testingReady),
    heuristicGroup(byId('bugs'), bugsReady),
    heuristicGroup(byId('automation'), automationReady),
  ]
}

export function appReadiness(appSlug: string): Readiness {
  const scope = { app: appSlug }
  const groups = intakeFileExists(scope) ? scoreGroups(APP_INTAKE_GROUPS, readIntake(scope).answers) : heuristicAppGroups(appSlug)

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

export function moduleReadiness(appSlug: string, moduleSlug: string): Readiness {
  const scope = { app: appSlug, module: moduleSlug }
  const group = MODULE_INTAKE_GROUPS[0]

  let groups: GroupReadiness[]
  if (intakeFileExists(scope)) {
    groups = scoreGroups(MODULE_INTAKE_GROUPS, readIntake(scope).answers)
  } else {
    const dir = path.join(getDataRoot(), appSlug, 'modules', moduleSlug, 'knowledge')
    const hasAny = fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.md') && nonEmptyFile(path.join(dir, f)))
    groups = [heuristicGroup(group, hasAny)]
  }

  const app = appReadiness(appSlug)
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

export function featureReadiness(appSlug: string, featureSlug: string): Readiness {
  const scope = { app: appSlug, feature: featureSlug }
  const group = FEATURE_INTAKE_GROUPS[0]

  const workflowPath = path.join(getDataRoot(), appSlug, 'features', featureSlug, 'workflow.md')
  const screenshotsDir = path.join(getDataRoot(), appSlug, 'features', featureSlug, 'screenshots')
  const hasWorkflow = nonEmptyFile(workflowPath)
  const hasScreenshot =
    fs.existsSync(screenshotsDir) && fs.readdirSync(screenshotsDir).some((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))

  let groups: GroupReadiness[]
  if (intakeFileExists(scope)) {
    groups = scoreGroups(FEATURE_INTAKE_GROUPS, readIntake(scope).answers)
  } else {
    groups = [heuristicGroup(group, hasWorkflow && hasScreenshot)]
  }

  const app = appReadiness(appSlug)
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
