// Server-only: the structured intake store + deterministic compiler.
//
// intake.json is the source of truth; saving a group both persists the answers
// AND re-renders the exact markdown/JSON files src/lib/context.ts, src/lib/ai.ts
// and the Automation Hub already read — so those consumers need zero changes.
// Compiled files carry a `<!-- generated-from-intake -->` marker (or, for JSON,
// a `_generatedFromIntake: true` field); a file that lacks the marker is assumed
// hand-written and is never silently overwritten (see IntakeConflictError).

import fs from 'fs'
import path from 'path'
import { getApp } from './apps'
import { setSetting } from './settings'
import { getDataRoot } from './paths'
import {
  APP_INTAKE_GROUPS,
  MODULE_INTAKE_GROUPS,
  FEATURE_INTAKE_GROUPS,
  type IntakeGroup,
  type IntakeFile,
  type IntakeValue,
} from './intake-types'

export const MARKER = '<!-- generated-from-intake -->'

export type IntakeScope = { app: string } | { app: string; module: string } | { app: string; feature: string }
type ScopeKind = 'app' | 'module' | 'feature'

function scopeKind(scope: IntakeScope): ScopeKind {
  if ('module' in scope && scope.module) return 'module'
  if ('feature' in scope && scope.feature) return 'feature'
  return 'app'
}

function intakeFilePath(scope: IntakeScope): string {
  const root = getDataRoot()
  const kind = scopeKind(scope)
  if (kind === 'module') return path.join(root, scope.app, 'modules', (scope as { app: string; module: string }).module, 'intake.json')
  if (kind === 'feature') return path.join(root, scope.app, 'features', (scope as { app: string; feature: string }).feature, 'intake.json')
  return path.join(root, scope.app, 'intake.json')
}

/** The group definitions relevant to a scope's tier (app / module / feature). */
export function groupsForScope(scope: IntakeScope): IntakeGroup[] {
  const kind = scopeKind(scope)
  if (kind === 'module') return MODULE_INTAKE_GROUPS
  if (kind === 'feature') return FEATURE_INTAKE_GROUPS
  return APP_INTAKE_GROUPS
}

export function intakeFileExists(scope: IntakeScope): boolean {
  return fs.existsSync(intakeFilePath(scope))
}

/** Read the structured answers for a scope. Never throws — missing/malformed → empty. */
export function readIntake(scope: IntakeScope): IntakeFile {
  const file = intakeFilePath(scope)
  const empty: IntakeFile = { version: 1, updatedAt: new Date(0).toISOString(), answers: {} }
  if (!fs.existsSync(file)) return empty
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (parsed && typeof parsed === 'object' && parsed.answers && typeof parsed.answers === 'object') {
      return {
        version: 1,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : empty.updatedAt,
        answers: parsed.answers,
      }
    }
  } catch {
    // malformed JSON — treat as empty rather than throwing
  }
  return empty
}

/** Thrown when a compiled target exists but was hand-written (no marker) and force wasn't passed. */
export class IntakeConflictError extends Error {
  file: string
  constructor(file: string) {
    super(`Refusing to overwrite hand-written file without force: ${file}`)
    this.name = 'IntakeConflictError'
    this.file = file
  }
}

// ─── Marker / conflict helpers ─────────────────────────────────────────────────

function displayPath(filePath: string): string {
  return path.relative(process.cwd(), filePath).split(path.sep).join('/')
}

function hasMdMarker(content: string): boolean {
  // The marker may appear after a YAML front-matter block.
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  return body.trimStart().startsWith(MARKER)
}

function assertMdWritable(filePath: string, force: boolean): void {
  if (force || !fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf-8')
  if (!hasMdMarker(content)) throw new IntakeConflictError(displayPath(filePath))
}

function writeCompiledMd(filePath: string, content: string, force: boolean): void {
  assertMdWritable(filePath, force)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

function assertJsonWritable(filePath: string, force: boolean): void {
  if (force || !fs.existsSync(filePath)) return
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>)._generatedFromIntake === true) return
  } catch {
    // unreadable — treat as hand-written, require confirmation
  }
  throw new IntakeConflictError(displayPath(filePath))
}

// ─── Small answer-reading helpers ──────────────────────────────────────────────

function text(answers: Record<string, IntakeValue>, id: string): string {
  const v = answers[id]
  return typeof v === 'string' ? v.trim() : ''
}

function rows(answers: Record<string, IntakeValue>, id: string): Record<string, string>[] {
  const v = answers[id]
  return Array.isArray(v) ? (v as Record<string, string>[]) : []
}

function bulletList(lines: string[], empty: string): string {
  return lines.length > 0 ? lines.join('\n') : empty
}

function humanize(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Free-text "one item per line" answers → a markdown bullet list, tolerant of already-bulleted input. */
function asBulletedText(value: string, empty: string): string {
  if (!value) return empty
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith('-') ? l : `- ${l}`))
    .join('\n')
}

// ─── Compilers ──────────────────────────────────────────────────────────────────

function compileDomain(appSlug: string, appName: string, answers: Record<string, IntakeValue>, force: boolean): void {
  const purpose = text(answers, 'purpose') || '[Not specified]'

  const roleLines = rows(answers, 'roles')
    .filter((r) => r.name)
    .map((r) => `- ${r.name}${r.permissions ? ` — ${r.permissions}` : ''}`)
  const entityLines = rows(answers, 'entities')
    .filter((r) => r.name)
    .map((r) => `- ${r.name}${r.description ? ` — ${r.description}` : ''}`)
  const workflows = text(answers, 'workflows') || '[Not specified]'

  const envLines = rows(answers, 'environments')
    .filter((r) => r.label || r.url)
    .map((r) => `- ${r.label || 'Environment'}: ${r.url || '—'}`)
  const accountLines = rows(answers, 'testAccounts')
    .filter((r) => r.role || r.username)
    .map((r) => `- ${r.role || 'Role'}: ${r.username || '—'}${r.password ? ` / ${r.password}` : ''}`)
  const envSectionParts = [bulletList(envLines, ''), accountLines.length > 0 ? `Test accounts:\n${accountLines.join('\n')}` : '']
    .filter(Boolean)
  const envSection = envSectionParts.length > 0 ? envSectionParts.join('\n\n') : '[Not specified]'

  const glossaryLines = rows(answers, 'glossary')
    .filter((r) => r.term)
    .map((r) => `- ${r.term} — ${r.meaning || ''}`)

  const content = `${MARKER}
# ${appName} — Platform & Domain Knowledge

## What this product is

${purpose}

## User roles

${bulletList(roleLines, '- [No roles defined]')}

## Core concepts & entities

${bulletList(entityLines, '- [No entities defined]')}

## Key workflows

${workflows}

## Environments & access

${envSection}

## Glossary

${bulletList(glossaryLines, '- [No glossary terms defined]')}
`

  const filePath = path.join(getDataRoot(), appSlug, 'knowledge', `${appSlug}-platform-domain-knowledge.md`)
  writeCompiledMd(filePath, content, force)
}

async function compileTesting(
  appSlug: string,
  answers: Record<string, IntakeValue>,
  domainAnswers: Record<string, IntakeValue>,
  force: boolean
): Promise<void> {
  const idScheme = text(answers, 'idScheme') || '[Not specified]'
  const tableFormat = text(answers, 'tableFormat') || '[Not specified]'
  const stepStyle = text(answers, 'stepStyle') || '[Not specified]'
  const priorityScale = text(answers, 'priorityScale') || '[Not specified]'
  const coverage = text(answers, 'coverage') || '[Not specified]'

  const rulesContent = `---
type: rules
priority: 10
---
${MARKER}
# Test-Case Writing Rules

## ID scheme

${idScheme}

## Required fields / table format

${tableFormat}

## Style rules

${stepStyle}

## Priority scale

${priorityScale}
`
  writeCompiledMd(path.join(getDataRoot(), appSlug, 'knowledge', 'testcase-writing-rules.md'), rulesContent, force)

  const processContent = `${MARKER}
# Test-Case Generation Process

## Coverage expectations

${coverage}
`
  writeCompiledMd(path.join(getDataRoot(), appSlug, 'knowledge', 'testcase-generation-process.md'), processContent, force)

  const testerName = text(answers, 'testerName')
  const browserOs = text(answers, 'browserOs')
  const envLabel = text(answers, 'envLabel')
  const roleNames = rows(domainAnswers, 'roles').map((r) => r.name).filter(Boolean)
  const roleToken = roleNames.length > 0 ? `<${roleNames.join('|')}>` : '<Role>'

  await setSetting(appSlug, 'testerName', testerName)
  await setSetting(
    appSlug,
    'testcaseEnvironment',
    `Browser: ${browserOs || '—'} | Environment: ${envLabel || '—'} | Role: ${roleToken}`
  )
}

async function compileBugs(appSlug: string, answers: Record<string, IntakeValue>, force: boolean): Promise<void> {
  const formatSections = text(answers, 'formatSections') || '[Not specified]'
  const severity = text(answers, 'severityConventions') || '[Not specified]'

  const content = `${MARKER}
# Bug Report Format

## Required sections

${formatSections}

## Severity / priority conventions

${severity}
`
  // App root, not knowledge/ — so it never leaks into testcase prompts via context.ts.
  writeCompiledMd(path.join(getDataRoot(), appSlug, 'bug-format.md'), content, force)

  const browserOs = text(answers, 'browserOs')
  const envLabel = text(answers, 'envLabel')
  await setSetting(appSlug, 'bugEnvironment', `Browser: ${browserOs || '—'} | Environment: ${envLabel || '—'}`)
}

function compileAutomation(appSlug: string, answers: Record<string, IntakeValue>, force: boolean): void {
  const baseUrlEnv = text(answers, 'baseUrlEnv')
  const credentialEnvs = rows(answers, 'credentialEnvs').map((r) => r.name).filter(Boolean)
  // Login steps are opaque to this compiler — the automation-hub schema is owned
  // by a different phase of this plan; we just persist whatever the form built.
  const login = Array.isArray(answers.loginSteps) ? answers.loginSteps : []

  const config = {
    slug: appSlug,
    baseUrlEnv,
    credentialEnvs,
    login,
    _generatedFromIntake: true,
  }

  const filePath = path.join(getDataRoot(), appSlug, 'automation.json')
  assertJsonWritable(filePath, force)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
}

function compileModuleOverview(appSlug: string, moduleSlug: string, answers: Record<string, IntakeValue>, force: boolean): void {
  const summary = text(answers, 'summary') || '[Not specified]'
  const rolesInvolved = text(answers, 'rolesInvolved') || '[Not specified]'
  const mainWorkflows = text(answers, 'mainWorkflows') || '[Not specified]'
  const businessRules = text(answers, 'businessRules') || '[Not specified]'
  const openQuestions = text(answers, 'openQuestions') || '[None]'
  const keyFieldLines = rows(answers, 'keyFields')
    .filter((r) => r.name)
    .map((r) => `- ${r.name}${r.values ? ` — ${r.values}` : ''}`)

  const content = `${MARKER}
# ${humanize(moduleSlug)} — Module Overview

## Overview

${summary}

## Roles involved

${rolesInvolved}

## Main workflows

${mainWorkflows}

## Business rules

${businessRules}

## Key fields & enums

${bulletList(keyFieldLines, '- [Not specified]')}

## Open questions

${openQuestions}
`

  const filePath = path.join(getDataRoot(), appSlug, 'modules', moduleSlug, 'knowledge', 'module-overview.md')
  writeCompiledMd(filePath, content, force)
}

/** Ported from src/app/[app]/features/new/page.tsx buildWorkflow() — generalized (no app-specific branching). */
function compileFeatureWorkflow(appSlug: string, featureSlug: string, answers: Record<string, IntakeValue>, force: boolean): void {
  const featureName = text(answers, 'featureName') || humanize(featureSlug)
  const featureId = text(answers, 'featureId')
  const roles = rows(answers, 'roles').map((r) => r.name).filter(Boolean)
  const modulePath = text(answers, 'modulePath')
  const priority = text(answers, 'priority') || 'P2'
  const appVersion = text(answers, 'appVersion')
  const purpose = text(answers, 'purpose')
  const userFlow = text(answers, 'userFlow')
  const businessRules = text(answers, 'businessRules')
  const edgeCases = text(answers, 'edgeCases')

  const screens = rows(answers, 'screens').filter((s) => s.name)
  const screensSection =
    screens.length > 0 ? screens.map((s) => `### ${s.name}\n\n${s.description || ''}`).join('\n\n') : '[No screens defined]'

  const fields = rows(answers, 'fields').filter((f) => f.name)
  const fieldsTable =
    fields.length > 0
      ? `| Field Name | Input Type | Required | Validation Rules / Notes |\n|-----------|-----------|----------|---------------------------|\n${fields
          .map((f) => `| ${f.name} | ${f.inputType || ''} | ${f.required || ''} | ${f.validation || ''} |`)
          .join('\n')}`
      : '[No fields defined]'

  const relatedFeatures = rows(answers, 'relatedFeatures').filter((r) => r.name)
  const relatedTable = `| Feature ID | Feature Name | Relationship |\n|------------|-------------|--------------|\n${
    relatedFeatures.length > 0
      ? relatedFeatures.map((r) => `| | ${r.name} | ${r.relationship || ''} |`).join('\n')
      : '| | | |'
  }`

  const content = `${MARKER}
# ${featureName} Workflow

---

## Feature Details

| Field | Value |
|-------|-------|
| **Feature Name** | ${featureName} |
| **Feature ID** | ${featureId || '—'} |
| **Role(s)** | ${roles.join(' / ') || '—'} |
| **Module / Navigation Path** | ${modulePath || '—'} |
| **Priority** | ${priority} |
| **App Version** | ${appVersion || '—'} |

---

## Business Purpose

${purpose || '[Not specified]'}

---

## Screens

${screensSection}

---

## User Flow

${userFlow || '[Not specified]'}

---

## Field Definitions

${fieldsTable}

---

## Business Rules

${asBulletedText(businessRules, '[No rules defined]')}

---

## Edge Cases / Known Behaviors

${asBulletedText(edgeCases, '[No edge cases defined]')}

---

## Open Questions / TBD

- [ ] [Add questions as needed]

---

## Related Features

${relatedTable}
`

  const filePath = path.join(getDataRoot(), appSlug, 'features', featureSlug, 'workflow.md')
  writeCompiledMd(filePath, content, force)
}

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Merge `answers` into the group's slot in intake.json and run that group's
 * deterministic compiler. The compiler runs BEFORE intake.json is written, so a
 * rejected save (IntakeConflictError) leaves no partial state.
 */
export async function saveIntakeGroup(
  scope: IntakeScope,
  groupId: string,
  answers: Record<string, IntakeValue>,
  opts: { force?: boolean } = {}
): Promise<IntakeFile> {
  const kind = scopeKind(scope)
  const groups = groupsForScope(scope)
  if (!groups.some((g) => g.id === groupId)) {
    throw Object.assign(new Error(`Unknown intake group "${groupId}" for this scope`), { status: 400 })
  }

  const intake = readIntake(scope)
  const nextAnswers = { ...intake.answers, [groupId]: answers }
  const force = opts.force === true

  if (kind === 'app') {
    const appSlug = scope.app
    if (groupId === 'domain') {
      const app = getApp(appSlug)
      compileDomain(appSlug, app?.name ?? appSlug, answers, force)
    } else if (groupId === 'testing') {
      await compileTesting(appSlug, answers, nextAnswers.domain ?? {}, force)
    } else if (groupId === 'bugs') {
      await compileBugs(appSlug, answers, force)
    } else if (groupId === 'automation') {
      compileAutomation(appSlug, answers, force)
    }
  } else if (kind === 'module') {
    compileModuleOverview(scope.app, (scope as { app: string; module: string }).module, answers, force)
  } else {
    compileFeatureWorkflow(scope.app, (scope as { app: string; feature: string }).feature, answers, force)
  }

  const updated: IntakeFile = { version: 1, updatedAt: new Date().toISOString(), answers: nextAnswers }
  const file = intakeFilePath(scope)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}
