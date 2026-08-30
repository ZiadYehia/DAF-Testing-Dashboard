// Pure DB → filesystem serializers for the one-way `db:export` path (Phase 4
// of the DB-source-of-truth migration). Every function here takes a plain,
// typed shape (no ORM entities, no fs) and returns `{ relPath, content }[]` —
// relPath is relative to an app's data directory (e.g. `data/<app>/`), except
// `serializeApps`, whose single output file (`apps.json`) lives at the data
// root instead.
//
// These MUST match the exact byte output of the current write-through
// functions they replace, so that `git diff` stays meaningful after an
// export and `db:export` → `db:import` round-trips losslessly:
//   - src/lib/features.ts        (workflow/testcases[-vN]/metadata.json/
//                                  acceptance-criteria.json/last-addition.json)
//   - src/lib/bugs.ts            (writeBugMarkdown — frontmatter field order)
//   - src/lib/execution.ts       (execution-status[-vN].json / execution-bugs[-vN].json)
//   - src/lib/knowledge.ts       (knowledge/module-knowledge/bug-format/example/template)
//   - src/lib/apps.ts            (apps.json)
//   - src/lib/modules.ts         (module.json)
//   - src/lib/intake.ts          (intake.json)
//   - src/lib/requirements.ts    (story-links.json)
//   - src/lib/stories.ts         (stories/*.md)
//   - src/lib/automation-cache.ts (automation.json, incl. _derivedCache)
//
// All JSON files use `JSON.stringify(value, null, 2)` with NO trailing
// newline — matching every writer above (none of them append one). Markdown
// files are written byte-for-byte as given (no forced trailing newline,
// no trimming) — whatever content string the caller/compiler produced.

import matter from 'gray-matter'

export interface SerializedFile {
  relPath: string
  content: string
}

// ─── apps.json ────────────────────────────────────────────────────────────────

export interface AppRecordInput {
  slug: string
  name: string
  description: string
  icon: string
  enabled: boolean
  type: string
  platform: string
  capabilities: Record<string, unknown>
}

/** Mirrors src/lib/apps.ts's saveApps() — the full registry as a single JSON array. */
export function serializeApps(apps: AppRecordInput[]): SerializedFile[] {
  const payload = apps.map((a) => ({
    slug: a.slug,
    name: a.name,
    description: a.description,
    icon: a.icon,
    enabled: a.enabled,
    type: a.type,
    platform: a.platform,
    capabilities: a.capabilities,
  }))
  return [{ relPath: 'apps.json', content: JSON.stringify(payload, null, 2) }]
}

// ─── modules/<slug>/module.json ─────────────────────────────────────────────

export interface ModuleManifestInput {
  slug: string
  name: string
  icon: string
  order: number
  pathPrefix: string
  description?: string | null
}

/** Mirrors src/lib/modules.ts's writeModule(). */
export function serializeModule(manifest: ModuleManifestInput): SerializedFile[] {
  const out: {
    slug: string; name: string; icon: string; order: number; pathPrefix: string; description?: string
  } = {
    slug: manifest.slug,
    name: manifest.name,
    icon: manifest.icon,
    order: manifest.order,
    pathPrefix: manifest.pathPrefix,
  }
  if (manifest.description != null) out.description = manifest.description
  return [{ relPath: `modules/${manifest.slug}/module.json`, content: JSON.stringify(out, null, 2) }]
}

// ─── intake.json (per scope) ────────────────────────────────────────────────

export type IntakeScopeInput =
  | { kind: 'app' }
  | { kind: 'module'; module: string }
  | { kind: 'feature'; feature: string }

export interface IntakeFileInput {
  updatedAt: string
  answers: Record<string, unknown>
}

/** The relPath intake.json lives at for a given scope, within the app dir. */
export function intakeRelPath(scope: IntakeScopeInput): string {
  if (scope.kind === 'module') return `modules/${scope.module}/intake.json`
  if (scope.kind === 'feature') return `features/${scope.feature}/intake.json`
  return 'intake.json'
}

/** Mirrors src/lib/intake.ts's saveIntakeGroup() JSON write. */
export function serializeIntake(scope: IntakeScopeInput, intake: IntakeFileInput): SerializedFile[] {
  const payload = { version: 1, updatedAt: intake.updatedAt, answers: intake.answers }
  return [{ relPath: intakeRelPath(scope), content: JSON.stringify(payload, null, 2) }]
}

// ─── Knowledge markdown (app/module knowledge, bug-format, examples, template) ─

export interface KnowledgeFileInput {
  filename: string
  content: string
  module: string | null
  /** 'knowledge' | 'bug-format' | 'example' | 'template' */
  docType: string
}

/** The relPath a knowledge_files row lives at, within the app dir. */
export function knowledgeRelPath(row: Pick<KnowledgeFileInput, 'filename' | 'module' | 'docType'>): string {
  switch (row.docType) {
    case 'bug-format':
      return 'bug-format.md'
    case 'example':
      return `examples/${row.filename}`
    case 'template':
      return '.github/templates/workflow-template.md'
    default:
      return row.module ? `modules/${row.module}/knowledge/${row.filename}` : `knowledge/${row.filename}`
  }
}

/** Mirrors src/lib/knowledge.ts's writeKnowledgeFile() — raw content passthrough. */
export function serializeKnowledgeFile(row: KnowledgeFileInput): SerializedFile[] {
  return [{ relPath: knowledgeRelPath(row), content: row.content }]
}

// ─── Feature tree ────────────────────────────────────────────────────────────

export interface FeatureMetadataInput {
  jiraKey?: string | null
  storyKey?: string | null
  module?: string | null
  /** ISO timestamp, or null/undefined when the feature has never been archived. */
  archivedAt?: string | null
}

export interface AcceptanceCriterionInput {
  id: string
  text: string
  parentId: string | null
  manualCoverage: string | null
  aiCoveredBy: string[]
  aiAnalyzedAt: string | null
}

export interface LastAdditionInput {
  ids: string[]
  version: number
  at: string
}

export interface TestcaseVersionInput {
  version: number
  content: string
}

export interface FeatureInput {
  name: string
  workflow: string
  testcases: string
  /** null/undefined → no knowledge.md file (matches DB NULL / empty-and-absent). */
  knowledge?: string | null
  metadata: FeatureMetadataInput
  testcaseVersions: TestcaseVersionInput[]
  acceptanceCriteria: AcceptanceCriterionInput[]
  lastAddition: LastAdditionInput | null
}

/**
 * Mirrors the feature-tree writers in src/lib/features.ts: workflow.md,
 * <name>-testcases.md (write-through base file), <name>-testcases-vN.md,
 * metadata.json (only the fields actually set — mirrors readFeatureMetadata's
 * accumulate-only-set-keys pattern), knowledge.md (only when present),
 * acceptance-criteria.json (only when non-empty — mirrors "file only exists
 * once saveAcs has been called with data"), last-addition.json (only when set).
 */
export function serializeFeature(f: FeatureInput): SerializedFile[] {
  const base = `features/${f.name}`
  const files: SerializedFile[] = []

  files.push({ relPath: `${base}/workflow.md`, content: f.workflow })
  files.push({ relPath: `${base}/${f.name}-testcases.md`, content: f.testcases })

  for (const v of f.testcaseVersions) {
    files.push({ relPath: `${base}/${f.name}-testcases-v${v.version}.md`, content: v.content })
  }

  const meta: Record<string, unknown> = {}
  if (f.metadata.jiraKey != null) meta.jiraKey = f.metadata.jiraKey
  if (f.metadata.storyKey != null) meta.storyKey = f.metadata.storyKey
  if (f.metadata.module != null) meta.module = f.metadata.module
  if (f.metadata.archivedAt) {
    meta.archived = true
    meta.archivedAt = f.metadata.archivedAt
  }
  if (Object.keys(meta).length > 0) {
    files.push({ relPath: `${base}/metadata.json`, content: JSON.stringify(meta, null, 2) })
  }

  if (f.knowledge != null) {
    files.push({ relPath: `${base}/knowledge.md`, content: f.knowledge })
  }

  if (f.acceptanceCriteria.length > 0) {
    files.push({ relPath: `${base}/acceptance-criteria.json`, content: JSON.stringify(f.acceptanceCriteria, null, 2) })
  }

  if (f.lastAddition) {
    files.push({ relPath: `${base}/last-addition.json`, content: JSON.stringify(f.lastAddition, null, 2) })
  }

  return files
}

// ─── Execution status / bug-links ───────────────────────────────────────────

export interface ExecutionMapInput {
  /** null = legacy flat namespace (unsuffixed filename). */
  version: number | null
  status: Record<string, string>
  bugs: Record<string, string>
  notes: Record<string, string>
}

/**
 * Mirrors src/lib/execution.ts's writeToFs/setExecutionBug/setExecutionNote.
 * Files are only emitted when their map is non-empty — a version with zero
 * test_executions rows has never had a file written for it.
 */
export function serializeExecution(featureName: string, exec: ExecutionMapInput): SerializedFile[] {
  const base = `features/${featureName}`
  const suffix = exec.version !== null ? `-v${exec.version}` : ''
  const files: SerializedFile[] = []
  if (Object.keys(exec.status).length > 0) {
    files.push({ relPath: `${base}/execution-status${suffix}.json`, content: JSON.stringify(exec.status, null, 2) })
  }
  if (Object.keys(exec.bugs).length > 0) {
    files.push({ relPath: `${base}/execution-bugs${suffix}.json`, content: JSON.stringify(exec.bugs, null, 2) })
  }
  if (Object.keys(exec.notes).length > 0) {
    files.push({ relPath: `${base}/execution-notes${suffix}.json`, content: JSON.stringify(exec.notes, null, 2) })
  }
  return files
}

// ─── Bug markdown ────────────────────────────────────────────────────────────

export interface BugInput {
  feature: string
  slug: string
  title: string
  status: string
  jiraKey: string | null
  /** ISO timestamp, or null. */
  reportedAt: string | null
  priority: string
  bugType: string
  parentKey: string | null
  severity: string
  layer: string
  jiraStatus: string | null
  jiraReporter: string | null
  /** ISO timestamp when soft-deleted, else null/undefined. */
  deletedAt?: string | null
  body: string
}

/**
 * Mirrors src/lib/bugs.ts's writeBugMarkdown() field order exactly, plus the
 * `deleted_at` frontmatter key softDeleteBug() appends for soft-deleted bugs
 * (appended last — new key on an existing object, matching how
 * softDeleteBug mutates the parsed frontmatter in place).
 */
export function serializeBug(bug: BugInput): SerializedFile[] {
  const frontmatter: Record<string, unknown> = {
    title: bug.title,
    status: bug.status,
    jira_key: bug.jiraKey,
    reported_at: bug.reportedAt,
    feature: bug.feature,
    priority: bug.priority,
    bug_type: bug.bugType,
    parent_key: bug.parentKey,
    severity: bug.severity,
    layer: bug.layer,
    jira_status: bug.jiraStatus,
    jira_reporter: bug.jiraReporter,
  }
  if (bug.deletedAt) frontmatter.deleted_at = bug.deletedAt
  const content = matter.stringify(bug.body ?? '', frontmatter)
  return [{ relPath: `bugs/${bug.feature}/${bug.slug}.md`, content }]
}

// ─── Requirements (FRs.md / FRs-<module>.md) ────────────────────────────────

/** Mirrors src/lib/features.ts's saveRequirementsDoc() FS mirror — raw content passthrough. */
export function serializeRequirements(module: string | null, content: string): SerializedFile[] {
  if (!content) return []
  const relPath = module ? `requirements/FRs-${module}.md` : 'requirements/FRs.md'
  return [{ relPath, content }]
}

// ─── story-links.json ───────────────────────────────────────────────────────

/** Mirrors src/lib/stories.ts's (via requirements.ts) story-links.json write. Keys are
 *  emitted in the given object's own insertion order — callers should build the input
 *  in the same order the DB rows are read (typically by row id) to preserve file history. */
export function serializeStoryLinks(links: Record<string, string>): SerializedFile[] {
  if (Object.keys(links).length === 0) return []
  return [{ relPath: 'requirements/story-links.json', content: JSON.stringify(links, null, 2) }]
}

// ─── stories/<key>.md ────────────────────────────────────────────────────────

export interface StoryInput {
  key: string
  summary: string
  description: string
}

/** Mirrors src/lib/stories.ts's saveLocalStory(). */
export function serializeStory(story: StoryInput): SerializedFile[] {
  return [{ relPath: `stories/${story.key}.md`, content: `# ${story.summary}\n\n${story.description}` }]
}

// ─── automation.json ─────────────────────────────────────────────────────────

export interface AutomationConfigInput {
  slug: string
  baseUrlEnv: string
  credentialEnvs: unknown[]
  login: unknown[]
  generatedFromIntake: boolean
}

/** Mirrors src/lib/automation-cache.ts's writeAutomationCache() — the going-forward
 *  file author, including the `_derivedCache: true` marker it always sets. */
export function serializeAutomationConfig(cfg: AutomationConfigInput): SerializedFile[] {
  const payload = {
    slug: cfg.slug,
    baseUrlEnv: cfg.baseUrlEnv,
    credentialEnvs: cfg.credentialEnvs,
    login: cfg.login,
    _generatedFromIntake: cfg.generatedFromIntake,
    _derivedCache: true,
  }
  return [{ relPath: 'automation.json', content: JSON.stringify(payload, null, 2) }]
}
