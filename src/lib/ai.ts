import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'
import { getApp } from './apps'
import { getSetting } from './settings'
import { parseTestcaseRows, getLastTestcaseId } from './features'
import { getFeatureModule, loadAppKnowledge, loadModuleKnowledge } from './knowledge'
import { buildContext, loadKnowledgeDocs } from './context'
import { getApprovedExamplesForPrompt } from './approved-examples'
import { getModule } from './modules'
import { getBugFormat } from './bug-format-server'
import { BUG_TYPE_OPTIONS, type BugLayer, type BugVariant, type BugVariantConfig, type BugFormatConfig } from './bug-format'

// ─── Model Registry ────────────────────────────────────────────────────────────

export interface AIModelDef {
  id: string
  name: string
  /** Built-in provider ('google' | 'anthropic' | 'groq') or a custom provider id. */
  provider: string
  requiredEnvKey: string
  /** Whether the model can process image content */
  supportsVision: boolean
  description: string
}

export interface AIModel extends AIModelDef {
  enabled: boolean
  disabledReason?: string
}

const AI_MODEL_DEFS: AIModelDef[] = [
  // ── Google (free key from aistudio.google.com) ───────────────────────────
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    requiredEnvKey: 'GEMINI_API_KEY',
    supportsVision: true,
    description: 'Best quality — supports screenshots',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    requiredEnvKey: 'GEMINI_API_KEY',
    supportsVision: true,
    description: 'Highest quality — supports screenshots',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    requiredEnvKey: 'GEMINI_API_KEY',
    supportsVision: true,
    description: 'Fast & capable — supports screenshots',
  },
  // ── Anthropic ────────────────────────────────────────────────────────────
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    requiredEnvKey: 'ANTHROPIC_API_KEY',
    supportsVision: true,
    description: 'High quality reasoning — supports screenshots',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    requiredEnvKey: 'ANTHROPIC_API_KEY',
    supportsVision: true,
    description: 'Fast & lightweight — supports screenshots',
  },
  // ── Groq (fast inference) ────────────────────────────────────────────────
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    requiredEnvKey: 'GROQ_API_KEY',
    supportsVision: false,
    description: 'Excellent quality — blazing fast inference (no screenshots)',
  },
  {
    id: 'moonshotai/kimi-k2-instruct',
    name: 'Kimi K2 (Groq)',
    provider: 'groq',
    requiredEnvKey: 'GROQ_API_KEY',
    supportsVision: false,
    description: 'Top-tier open model — great at reasoning (no screenshots)',
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B (Groq)',
    provider: 'groq',
    requiredEnvKey: 'GROQ_API_KEY',
    supportsVision: false,
    description: 'Lightweight & fastest (no screenshots)',
  },
]

/** Returns all models with live enabled/disabled status based on current env vars. */
export function getModelsWithStatus(): AIModel[] {
  return AI_MODEL_DEFS.map((def) => {
    const enabled = !!process.env[def.requiredEnvKey]
    return {
      ...def,
      enabled,
      disabledReason: enabled ? undefined : `Add ${def.requiredEnvKey} to .env.local to enable`,
    }
  })
}

/** @deprecated use getModelsWithStatus() */
export function getEnabledModels(): AIModel[] {
  return getModelsWithStatus().filter((m) => m.enabled)
}

/**
 * DB-aware version — merges the hardcoded defaults with the DB model registry
 * (custom models + manual disables) and resolves enabled status from keys.
 * Use in server-side API routes.
 */
export async function getModelsWithStatusAsync(): Promise<AIModel[]> {
  const { getModelRegistry } = await import('./ai-config')
  const registry = await getModelRegistry()
  // Custom models override built-ins with the same id; both are listed.
  const byId = new Map<string, AIModelDef>()
  for (const def of AI_MODEL_DEFS) byId.set(def.id, def)
  for (const def of registry.custom) byId.set(def.id, def)

  return Promise.all(
    [...byId.values()].map(async (def) => {
      const envKey = process.env[def.requiredEnvKey]
      const dbKey = await getSetting('global', def.requiredEnvKey).catch(() => null)
      const hasKey = !!(envKey || dbKey)
      const manuallyDisabled = registry.disabled.includes(def.id)
      const enabled = hasKey && !manuallyDisabled
      return {
        ...def,
        enabled,
        disabledReason: manuallyDisabled
          ? 'Disabled in AI settings'
          : hasKey ? undefined : `Add ${def.requiredEnvKey} in Settings → AI to enable`,
      }
    })
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PhaseEvent {
  label: string
  detail?: string
  step: number
  total: number
}

export interface GeneratedBugReport {
  title: string
  feature: string
  priority: string
  bug_type: string
  body: string
  layer: BugLayer
  severity?: string
}

export type GeneratedTestcases = string

export interface AcceptanceCriterion {
  id: string
  text: string
  parentId: string | null
  manualCoverage: 'covered' | 'not_covered' | null
  aiCoveredBy: string[]
  aiAnalyzedAt: string | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDataRoot(): string {
  return process.env.DATA_ROOT ?? path.join(process.cwd(), 'data')
}

function readFileIfExists(filePath: string): string {
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8')
  return ''
}

// ─── Retry Helper ────────────────────────────────────────────────────────────

function isRetryableError(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase()
  // Transient HTTP statuses
  if (/\b(429|500|502|503|504)\b/.test(message)) return true
  // Provider/network phrasings
  return /service unavailable|overloaded|rate limit|too many requests|timeout|timed out|etimedout|econnreset|econnrefused|enotfound|socket hang up|fetch failed|network error/i.test(
    message
  )
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 2000
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isRetryableError(err) || attempt === maxAttempts) throw err
      // Exponential backoff with a little jitter to avoid thundering-herd retries.
      const jitter = Math.floor(Math.random() * 400)
      await new Promise((res) => setTimeout(res, baseDelayMs * attempt + jitter))
    }
  }
  throw lastError
}

// ─── Context Loaders ──────────────────────────────────────────────────────────

function loadAppContext(appSlug: string): {
  domainKnowledge: string
  bugFormatGuide: string
  features: string[]
} {
  const dataRoot = getDataRoot()

  // Domain knowledge — app-tier docs, front-matter typed and token-budgeted
  // (bug generation is app-scoped, so no module/feature tier here).
  const domainKnowledge = buildContext(loadKnowledgeDocs(appSlug, null, null)).app

  // Bug format guide — data/<app>/bug-format.md (compiled or hand-written) is the
  // primary source; the legacy .github/instructions/{appSlug}/ lookup is kept as
  // a fallback for apps that haven't migrated to intake yet.
  const ghDir = path.join(process.cwd(), '.github', 'instructions')
  const compiledBugFormat = readFileIfExists(path.join(dataRoot, appSlug, 'bug-format.md'))
  const bugFormatGuide = compiledBugFormat
    ? compiledBugFormat
    : [
        readFileIfExists(path.join(ghDir, appSlug, 'bug-report-format.instructions.md')),
        readFileIfExists(path.join(ghDir, 'shared', 'global.instructions.md')),
      ]
        .filter(Boolean)
        .join('\n\n---\n\n')

  // Available features
  const featuresDir = path.join(dataRoot, appSlug, 'features')
  const features: string[] = []
  if (fs.existsSync(featuresDir)) {
    for (const entry of fs.readdirSync(featuresDir)) {
      if (fs.statSync(path.join(featuresDir, entry)).isDirectory()) {
        features.push(entry)
      }
    }
  }

  return { domainKnowledge, bugFormatGuide, features }
}

// ─── Bug Report System Prompt ────────────────────────────────────────────────

function buildBugSystemPrompt(
  appSlug: string,
  format: BugFormatConfig,
  vc: BugVariantConfig,
  settings?: PromptSettings
): string {
  const { domainKnowledge, bugFormatGuide, features } = loadAppContext(appSlug)

  const app = getApp(appSlug)
  const appName = app ? `${app.name} (${app.description})` : appSlug
  const featureList = features.length > 0 ? features.join(', ') : 'not available'

  // Body section list is assembled from the enabled toggles, in template order.
  const bodySections: string[] = [
    'summary paragraph(s)',
    '---separator',
    '**Steps to Reproduce:**',
    '---separator',
    '**Expected Result:**',
    '---separator',
    '**Actual Result:**',
  ]
  if (vc.fields.environment) {
    bodySections.push(
      '---separator',
      `**Environment:** (use: ${settings?.bugEnvironment ?? 'Browser: <browser + version> | OS: <OS> | Environment: Design only — not yet implemented'})`
    )
  }
  if (vc.fields.priority) {
    bodySections.push('---separator', '**Priority:**')
  }
  if (vc.fields.severity) {
    bodySections.push('---separator', '**Severity:**')
  }
  if (vc.fields.bugType) {
    bodySections.push('---separator', '**Bug Type:**')
  }

  // JSON contract fields — priority/bug_type/severity are only present when the
  // app's bug format config has that field enabled.
  const jsonLines: string[] = [
    `  "title": "A natural language sentence describing the bug — what is broken and in what context. GOOD examples: 'Orders list table becomes empty when all columns are deselected from the column visibility menu', 'Save button remains disabled after all required fields are filled on the order creation form', 'Filter panel closes without applying selections when clicking outside the modal'. BAD examples (never do this): 'order-list-bug', 'table-empty-bug', 'error in filter'."`,
    `  "feature": "kebab-case feature name — use one of the available features above if it matches, OR suggest a new descriptive kebab-case name (e.g. 'registration', 'order-create') if none of the existing ones fit"`,
  ]
  if (vc.fields.priority) {
    jsonLines.push(`  "priority": "exactly one of: ${format.priorityOptions.join(' | ')}"`)
  }
  if (vc.fields.severity) {
    jsonLines.push(`  "severity": "exactly one of: ${format.severityOptions.join(' | ')}"`)
  }
  if (vc.fields.bugType) {
    jsonLines.push(`  "bug_type": "exactly one of: ${BUG_TYPE_OPTIONS.join(' | ')}"`)
  }
  jsonLines.push(
    `  "body": "Full bug report body in markdown following the exact template. Body MUST include: ${bodySections.join(', ')}"`
  )
  jsonLines.push(
    `  "layer": "exactly one of: frontend | backend | unknown — frontend = UI rendering/layout/interaction issues; backend = API errors, wrong data, server/DB behavior; unknown = cannot be determined from the notes"`
  )

  return `You are a Senior QA Engineer specializing in the ${appName}.

Your task is to generate a structured, professional bug report from rough user notes.

## Domain Knowledge
${domainKnowledge || 'No domain knowledge available.'}

## Bug Report Format & Standards
${bugFormatGuide || 'Use standard bug report format with: title, summary, steps to reproduce, expected result, actual result, environment, priority, and bug type.'}

## Available Features / Modules
${featureList}

## Output Requirements

You MUST respond with ONLY a valid JSON object — no markdown fences, no explanation, just the JSON.

The JSON must have exactly these fields:
{
${jsonLines.join(',\n')}
}

## Rules
- The title MUST be a natural language sentence with normal capitalisation — NEVER kebab-case, snake_case, or all-lowercase-with-hyphens
- NEVER use vague titles like "X not working", "Bug in Y", "Error in Z"
- NEVER fabricate steps or data not mentioned in the user notes — infer only what is clearly contextual
- NEVER assign P1 unless there is real data integrity, classification, or access-control risk
- The "body" field must be valid markdown with all sections filled
- If the feature cannot be determined from the existing list, suggest a new short descriptive kebab-case name
- If the embedded Bug Report Format guide above shows sections that differ from these Output Requirements, the Output Requirements win — the body must contain exactly the listed sections above, nothing more and nothing less
- Respond with ONLY the JSON object, nothing else`
}

/** Max few-shot example files to embed in a test-case prompt. */
const MAX_EXAMPLES = 2

/**
 * Rank example filenames by token overlap with the target feature (and its
 * module), so the most relevant examples win when we cap the count. Falls back
 * to the first files when nothing shares a token — there's always a format anchor.
 */
function rankExamplesByRelevance(
  files: string[],
  featureName: string,
  featureModule: string | null
): string[] {
  const tokenize = (s: string) =>
    s.toLowerCase().replace(/-testcases\.md$/, '').split(/[^a-z0-9]+/).filter((t) => t.length > 2)
  const wanted = new Set([...tokenize(featureName), ...(featureModule ? tokenize(featureModule) : [])])
  const scored = files.map((f) => ({
    f,
    score: tokenize(f).reduce((n, t) => n + (wanted.has(t) ? 1 : 0), 0),
  }))
  // Stable sort: relevance first, then original order (preserved by index tiebreak).
  scored.sort((a, b) => b.score - a.score || files.indexOf(a.f) - files.indexOf(b.f))
  return scored.slice(0, MAX_EXAMPLES).map((s) => s.f)
}

// ─── Testcase System Prompt ───────────────────────────────────────────────────

interface PromptSettings {
  testerName?: string
  testcaseEnvironment?: string
  bugEnvironment?: string
}

function buildTestcaseSystemPrompt(
  appSlug: string,
  featureName: string,
  settings?: PromptSettings,
  existingTestcases?: string,
  approvedExamples?: Array<{ label: string; content: string }>,
  quickAdd: boolean = false,
  guidance?: string
): string {
  const dataRoot = getDataRoot()
  const featureDir = path.join(dataRoot, appSlug, 'features', featureName)

  const workflow = readFileIfExists(path.join(featureDir, 'workflow.md'))

  const featureModule = getFeatureModule(appSlug, featureName)
  const moduleManifest = featureModule ? getModule(appSlug, featureModule) : null
  const moduleName = moduleManifest?.name ?? featureModule ?? null

  // 3-tier knowledge (app → module → feature), front-matter typed and token-budgeted.
  // Falls back to inferred type/priority for files without front-matter, so the
  // existing knowledge base works unchanged; rules are never dropped.
  const ctx = buildContext(loadKnowledgeDocs(appSlug, featureModule, featureName))
  const appKnowledge = ctx.app
  const moduleKnowledge = ctx.module
  const featureKnowledge = ctx.feature
  if (ctx.dropped.length > 0) {
    console.warn(
      `[ai] testcase prompt: knowledge budget ${ctx.tokensUsed}/${ctx.budget} tok — dropped ${ctx.dropped.length} lower-priority doc(s): ${ctx.dropped.map((d) => path.basename(d.source)).join(', ')}`
    )
  }

  // Functional requirements
  const requirements = readFileIfExists(path.join(dataRoot, appSlug, 'requirements', 'FRs.md'))

  // Few-shot examples. Prefer human-approved examples (the learning-loop "gold"
  // pool) when present; otherwise fall back to the static data/{app}/examples/
  // files, ranked by relevance and capped so the prompt stays focused.
  let examples = ''
  if (approvedExamples && approvedExamples.length > 0) {
    examples = approvedExamples.map((e) => `### ${e.label}\n\n${e.content}`).join('\n\n---\n\n')
  } else {
    const exDir = path.join(dataRoot, appSlug, 'examples')
    if (fs.existsSync(exDir)) {
      const files = fs.readdirSync(exDir).filter((f) => f.endsWith('-testcases.md'))
      const ranked = rankExamplesByRelevance(files, featureName, featureModule)
      examples = ranked
        .map((f) => `### Example: ${f}\n\n${fs.readFileSync(path.join(exDir, f), 'utf-8')}`)
        .join('\n\n---\n\n')
      if (files.length > ranked.length) {
        console.warn(`[ai] testcase prompt: using ${ranked.length}/${files.length} examples (most relevant to "${featureName}")`)
      }
    }
  }

  const app = getApp(appSlug)
  const appName = app ? `${app.name} (${app.description})` : appSlug

  return `You are a Senior QA Engineer specializing in ${appName}.

Your task is to generate a complete, professional test case table for the feature described below.

## Feature Name
${featureName}

## Feature Workflow / Specification
${workflow || 'No workflow provided.'}

## Domain Knowledge (platform-wide rules, test case format)
${appKnowledge || 'No domain knowledge available.'}
${moduleKnowledge ? `\n## Module Context — ${moduleName} (shared across all ${moduleName} features)\n${moduleKnowledge}` : ''}
${featureKnowledge ? `\n## Feature-Specific Context (from linked user story)\n${featureKnowledge}` : ''}

## Functional Requirements (FRs.md — for Feature ID traceability)
${requirements || 'No requirements available.'}

## APPROVED Example Test Case Files — match their format EXACTLY
${examples || 'No examples available — follow the format rules from the Domain Knowledge section.'}

## Your Instructions

1. Read the workflow, domain knowledge, screenshots, and requirements carefully.
2. ${quickAdd
    ? 'This is a SCENARIO-DIRECTED request — generate ONLY what the scenario directive below asks for. Do NOT perform a broad coverage sweep.'
    : 'Generate a comprehensive set of test cases: happy paths, negative/invalid inputs, edge cases, error handling, access control, and lifecycle flows.'}
3. Output ONLY raw markdown — the H1 heading followed immediately by the table. No preamble, no explanation, no code fences, no metadata block.
4. First line is the H1 heading — the feature name only (no "Test Cases" suffix). Example: \`# Orders List\`
5. Table columns — EXACT order, EXACT names (note: "Enviroment" is intentionally misspelled):
   \`|Feature ID|TestCase ID|Tester|Validity|Test Cases Title / Objective|Enviroment|Pre-condition|Test Data|Steps|Expected Results|Status|Attachment|Type |\`
   \`|---|---|---|---|---|---|---|---|---|---|---|---|---|\`
6. Column rules:
   - **Feature ID**: FR ID from FRs.md (e.g. \`AM_FR_01\`). Use \`N/A\` if no FR applies. Multiple FRs space-separated.
   - **TestCase ID**: \`<PREFIX>_<NNN>\` — 3–4 letter feature abbreviation + 3-digit zero-padded number. Derive prefix from feature name (e.g. LST for Orders List, CRT for Order Create, LFE for Lifecycle, REL for Relationships, EVI for Evidence, LOG for Activity Log). Example: \`LST_001\`.
   - **Tester**: Always \`${settings?.testerName ?? 'QA Tester'}\`
   - **Validity**: \`Positive\` for valid/happy-path; \`Negative\` for errors, invalid inputs, edge cases, access-control denial.
   - **Test Cases Title / Objective**: Sentence starting with "Validate that…". One behaviour per test case.
   - **Enviroment**: \`${settings?.testcaseEnvironment ?? 'Browser: <browser + version> | OS: <OS> | Environment: Design only — not yet implemented | Role: <role>'}\`. Match role to the test scenario.
   - **Pre-condition**: Numbered inline steps (e.g. \`1. User is logged in as Admin. 2. Orders exist.\`). Use \`Not Applicable\` when none needed.
   - **Test Data**: Concrete values (field names, example names, codes). Use \`Not Applicable\` (never "N/A") when none needed.
   - **Steps**: Numbered inline action steps starting from 1.
   - **Expected Results**: One or more falsifiable statements.
   - **Status**: Always \`Under Testing\`
   - **Attachment**: Always leave empty.
   - **Type**: One of \`Functional\`, \`Negative\`, \`UI/UX\`, \`Access Control\`, \`Integration\`, \`Lifecycle\`. Include a trailing space: \`Functional \`.
7. ${quickAdd
    ? 'Generate ONLY the test case(s) required by the scenario directive below. Do NOT pad the output with additional coverage — there is no minimum count.'
    : 'Generate at minimum 15 test cases. Cover all significant flows, fields, validations, and states visible in the screenshots and workflow.'}
8. IMPORTANT: Match the approved example test case files above — their column names, format, and style are the gold standard.

Output ONLY the markdown — nothing else.${existingTestcases ? (() => {
    const rows = parseTestcaseRows(existingTestcases)
    const { prefix, lastNum } = getLastTestcaseId(existingTestcases)
    const nextId = prefix ? `${prefix}_${String(lastNum + 1).padStart(3, '0')}` : 'the next sequential ID'
    // Include a short step fingerprint, not just the objective, so the model can
    // tell apart cases with similar titles but different actions — and avoid
    // regenerating near-duplicates that only differ in wording.
    const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)
    const objectiveList = rows
      .map((r) => `- ${r.id}: ${r.objective}${r.steps ? ` — steps: ${truncate(r.steps, 140)}` : ''}`)
      .join('\n')
    return `

## EXISTING TEST CASES — COVERAGE ANALYSIS REQUIRED

The test cases below already exist for this feature. Your job is NOT to repeat them. Instead:

1. Analyze the objectives listed below to understand what has already been tested (which fields, flows, user roles, error paths, states, and validations are covered).
2. Identify coverage GAPS — aspects of the feature that are NOT yet tested:
   - Fields or validations not yet targeted
   - User roles not yet tested for certain scenarios
   - Error/rejection paths not covered
   - Boundary values and edge cases missing
   - Multi-step workflow combinations not addressed
   - State transitions not fully covered
3. Generate ONLY new test cases targeting those uncovered aspects.

### Existing Test Case Objectives
${objectiveList}

**Numbering rule**: The last existing ID is ${prefix}_${String(lastNum).padStart(3, '0')}. Start new IDs from ${nextId}. Do NOT reuse any ID listed above, and do NOT create a test case whose objective closely matches any listed above.${guidance?.trim() ? `

### User Direction for This Batch
The user wants the new cases to focus on: "${guidance.trim()}"

Prioritize coverage gaps related to this direction — generate those cases FIRST. Direction-related cases must still be genuine gaps (not rewordings of existing cases above). If the direction is narrow and fully covered by fewer cases, you may follow with other high-value uncovered gaps, but never at the expense of the requested focus.` : ''}`
  })() : ''}`
}

// ─── Screenshot Helper ────────────────────────────────────────────────────────

/** Anthropic accepts these image media types for base64 image blocks. */
type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

/** Provider-neutral screenshot loader: base64 data + media type per image. */
function getScreenshotData(
  appSlug: string,
  featureName: string
): Array<{ data: string; mimeType: ImageMimeType }> {
  const screenshotsDir = path.join(getDataRoot(), appSlug, 'features', featureName, 'screenshots')
  if (!fs.existsSync(screenshotsDir)) return []

  const SUPPORTED = /\.(png|jpg|jpeg|gif|webp)$/i
  const mimeMap: Record<string, ImageMimeType> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp',
  }

  return fs.readdirSync(screenshotsDir)
    .filter((f) => SUPPORTED.test(f))
    .map((file) => ({
      data: fs.readFileSync(path.join(screenshotsDir, file)).toString('base64'),
      mimeType: mimeMap[path.extname(file).toLowerCase()] ?? 'image/jpeg',
    }))
}

/** Gemini-shaped screenshot parts (inlineData), built on the neutral loader. */
function getScreenshotParts(
  appSlug: string,
  featureName: string
): Array<{ inlineData: { data: string; mimeType: string } }> {
  return getScreenshotData(appSlug, featureName).map((img) => ({
    inlineData: { data: img.data, mimeType: img.mimeType },
  }))
}

// ─── Provider Dispatch (text models) ─────────────────────────────────────────

/**
 * Default sampling temperature. Test-case tables, structured JSON, and coverage
 * analysis all want near-deterministic output, so we keep this low and consistent
 * across providers rather than relying on each SDK's (differing) default.
 */
const DEFAULT_TEMPERATURE = 0.2

export async function runModel(
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  opts: {
    json?: boolean
    maxTokens?: number
    temperature?: number
    /** Screenshots to attach (vision-capable providers only). */
    images?: Array<{ data: string; mimeType: ImageMimeType }>
  } = {}
): Promise<string> {
  const models = await getModelsWithStatusAsync()
  const model = models.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown model: ${modelId}`)
  if (!model.enabled) throw new Error(`Model "${model.name}" is disabled. ${model.disabledReason ?? ''}`)

  const maxTokens = opts.maxTokens ?? 8192
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE

  if (model.provider === 'google') {
    const apiKey = await getSetting('global', 'GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Add it in Settings or .env.local')
    const client = new GoogleGenerativeAI(apiKey)
    const gemini = client.getGenerativeModel({
      model: model.id,
      generationConfig: {
        temperature,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
    })
    const result = await withRetry(() => gemini.generateContent(`${systemPrompt}\n\n${userPrompt}`))
    return result.response.text()
  }

  if (model.provider === 'anthropic') {
    const apiKey = await getSetting('global', 'ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured. Add it in Settings or .env.local')
    const resolvedId = resolveAnthropicModelId(model.id)
    const client = new Anthropic({ apiKey })
    // Attach screenshots as image blocks when the model supports vision.
    const content: Anthropic.MessageParam['content'] =
      model.supportsVision && opts.images && opts.images.length > 0
        ? [
            ...opts.images.map(
              (img): Anthropic.ImageBlockParam => ({
                type: 'image',
                source: { type: 'base64', media_type: img.mimeType, data: img.data },
              })
            ),
            { type: 'text', text: userPrompt },
          ]
        : userPrompt
    const message = await withRetry(() =>
      client.messages.create({
        model: resolvedId,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
      })
    )
    return message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
  }

  if (model.provider === 'groq') {
    const apiKey = await getSetting('global', 'GROQ_API_KEY')
    if (!apiKey) throw new Error('GROQ_API_KEY is not configured. Add it in Settings or .env.local')
    const groq = new Groq({ apiKey })
    const completion = await withRetry(() =>
      groq.chat.completions.create({
        model: model.id,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        temperature,
      })
    )
    return completion.choices[0]?.message?.content ?? ''
  }

  // Custom (user-added) providers — any OpenAI-compatible chat-completions API.
  const { getCustomProviders } = await import('./ai-config')
  const customProvider = (await getCustomProviders()).find((p) => p.id === model.provider)
  if (customProvider) {
    const apiKey = await getSetting('global', model.requiredEnvKey)
    if (!apiKey) throw new Error(`${customProvider.label} API key is not configured. Add it in Settings → AI`)
    return runOpenAICompatible(customProvider, model, apiKey, systemPrompt, userPrompt, {
      json: opts.json,
      maxTokens,
      temperature,
      images: opts.images,
    })
  }

  throw new Error(`Provider "${model.provider}" is not implemented`)
}

/** OpenAI-compatible content parts: text plus data-URL images for vision models. */
type OpenAIContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>

async function runOpenAICompatible(
  provider: { id: string; label: string; baseUrl: string },
  model: AIModel,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { json?: boolean; maxTokens: number; temperature: number; images?: Array<{ data: string; mimeType: string }> }
): Promise<string> {
  const content: OpenAIContent =
    model.supportsVision && opts.images && opts.images.length > 0
      ? [
          ...opts.images.map((img) => ({
            type: 'image_url' as const,
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          })),
          { type: 'text' as const, text: userPrompt },
        ]
      : userPrompt

  const body = {
    model: model.id,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content },
    ],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  }

  // 60s timeout (vs. the 15s used for plain CRUD calls elsewhere) — model completions can
  // legitimately take a while. AbortSignal.timeout() rejects with a DOMException named
  // "TimeoutError" whose message contains "timeout", which isRetryableError() below matches,
  // so a timed-out call IS retried by withRetry. With the defaults (3 attempts) that's a
  // worst case of ~3x60s plus backoff (~186s) before giving up — acceptable, but do not raise
  // maxAttempts for this call without reconsidering that stacking.
  const result = await withRetry(async () => {
    const res = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`${provider.label} API error ${res.status}: ${detail.slice(0, 300)}`)
    }
    return res.json() as Promise<{ choices?: Array<{ message?: { content?: string } }> }>
  })
  return result.choices?.[0]?.message?.content ?? ''
}

/** Maps our internal Anthropic model ids to dated API ids where they differ. */
function resolveAnthropicModelId(modelId: string): string {
  const map: Record<string, string> = {
    'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6': 'claude-sonnet-4-6',
  }
  return map[modelId] ?? modelId
}

/** Parse a JSON object from model output, tolerating ```json fences. */
function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  return JSON.parse(cleaned) as T
}

function stripFences(text: string): string {
  return text.replace(/^```(?:markdown)?\n?/i, '').replace(/\n?```$/i, '').trim()
}

/**
 * Run a model expecting JSON, parse it, and optionally validate its shape.
 * On a parse/validation failure, re-prompts once with the error appended so the
 * model can self-correct — turning a hard user-facing failure into a silent retry.
 */
async function runModelJson<T>(
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { maxTokens?: number; temperature?: number; validate?: (v: unknown) => v is T } = {}
): Promise<T> {
  let lastError: unknown
  let correction = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = await runModel(modelId, systemPrompt + correction, userPrompt, {
      json: true,
      maxTokens: opts.maxTokens,
      temperature: opts.temperature,
    })
    try {
      const parsed = parseJsonResponse<T>(text)
      if (opts.validate && !opts.validate(parsed)) {
        throw new Error('Response did not match the required JSON shape')
      }
      return parsed
    } catch (err) {
      lastError = err
      const reason = err instanceof Error ? err.message : String(err)
      correction = `\n\n## CRITICAL — PREVIOUS RESPONSE REJECTED\nYour last response could not be used (${reason}). Respond with ONLY valid JSON in the exact required shape — no markdown fences, no commentary, no trailing text.`
    }
  }
  throw lastError
}

/** Body sections every bug report must contain, regardless of which toggles are enabled. */
const ALWAYS_ON_BUG_BODY_SECTIONS = [
  '**Steps to Reproduce:**',
  '**Expected Result:**',
  '**Actual Result:**',
] as const

/**
 * Build a validator for the given app's bug variant config. Only the always-on
 * sections plus the currently enabled toggles are required — extra sections
 * (e.g. a weaker model including Environment even when disabled) are tolerated
 * rather than hard-failing, since the goal is resilience, not strictness.
 */
function makeBugReportValidator(vc: BugVariantConfig): (v: unknown) => v is GeneratedBugReport {
  const requiredSections: string[] = [...ALWAYS_ON_BUG_BODY_SECTIONS]
  if (vc.fields.environment) requiredSections.push('**Environment:**')
  if (vc.fields.priority) requiredSections.push('**Priority:**')
  if (vc.fields.severity) requiredSections.push('**Severity:**')
  if (vc.fields.bugType) requiredSections.push('**Bug Type:**')

  return function isGeneratedBugReport(v: unknown): v is GeneratedBugReport {
    if (!v || typeof v !== 'object') return false
    const o = v as Record<string, unknown>
    const typed =
      typeof o.title === 'string' &&
      typeof o.feature === 'string' &&
      typeof o.body === 'string' &&
      (!vc.fields.priority || typeof o.priority === 'string') &&
      (!vc.fields.bugType || typeof o.bug_type === 'string') &&
      (!vc.fields.severity || typeof o.severity === 'string')
    if (!typed) return false
    // Weaker models tend to drift from the body template (renamed headings, missing
    // sections). Throwing a descriptive error here feeds runModelJson's
    // self-correction retry, so every provider converges on the same format.
    const missing = requiredSections.filter((s) => !(o.body as string).includes(s))
    if (missing.length > 0) {
      throw new Error(
        `The "body" field is missing required section heading(s): ${missing.join(', ')}. Reproduce the body template exactly, with each section heading in bold and separated by --- lines.`
      )
    }
    if (!/\s/.test(o.title as string)) {
      throw new Error('The "title" field must be a natural language sentence, not a kebab-case or single-word slug.')
    }
    return true
  }
}

// ─── Bug Report Generation ────────────────────────────────────────────────────

export async function generateBugReport(
  appSlug: string,
  roughNotes: string,
  modelId: string = 'gemini-2.5-flash',
  onPhase?: (event: PhaseEvent) => void,
  variant: BugVariant = 'epic'
): Promise<GeneratedBugReport> {
  const models = await getModelsWithStatusAsync()
  const model = models.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown model: ${modelId}`)
  if (!model.enabled) throw new Error(`Model "${model.name}" is disabled. ${model.disabledReason ?? ''}`)

  onPhase?.({ label: 'Building context', detail: 'Reading knowledge base and settings…', step: 1, total: 3 })
  const [bugEnvironment, format] = await Promise.all([
    getSetting(appSlug, 'bugEnvironment'),
    getBugFormat(appSlug),
  ])
  const vc = format[variant]
  const settings: PromptSettings = { bugEnvironment: bugEnvironment ?? undefined }
  const systemPrompt = buildBugSystemPrompt(appSlug, format, vc, settings)
  const userMessage = `## User's Rough Notes\n${roughNotes}`

  onPhase?.({ label: 'Calling AI model', detail: `Using ${model.name}…`, step: 2, total: 3 })
  // runModelJson handles provider dispatch, the JSON response mode where the
  // provider supports it, and a validate-and-retry pass on malformed output.
  const report = await runModelJson<GeneratedBugReport>(modelId, systemPrompt, userMessage, {
    maxTokens: 4096,
    validate: makeBugReportValidator(vc),
  })
  onPhase?.({ label: 'Parsing response', detail: 'Validating AI output…', step: 3, total: 3 })
  // Never fail generation over a bad/missing layer classification — coerce silently.
  report.layer = report.layer === 'frontend' || report.layer === 'backend' ? report.layer : 'unknown'
  report.severity = vc.fields.severity ? (report.severity ?? '') : ''
  return report
}

// ─── Test Case Generation ─────────────────────────────────────────────────────

export async function generateTestCases(
  appSlug: string,
  featureName: string,
  modelId: string = 'gemini-2.5-flash',
  onPhase?: (event: PhaseEvent) => void,
  existingTestcases?: string,
  guidance?: string
): Promise<GeneratedTestcases> {
  const models = await getModelsWithStatusAsync()
  const model = models.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown model: ${modelId}`)
  if (!model.enabled) throw new Error(`Model "${model.name}" is disabled. ${model.disabledReason ?? ''}`)

  // Google gets 3 phases here + 1 "Finalizing" from route = 4 total
  // Other providers get 2 phases here + 1 "Finalizing" from route = 3 total
  const isGoogle = model.provider === 'google'
  const total = isGoogle ? 4 : 3

  onPhase?.({ label: 'Loading feature data', detail: 'Reading workflow and settings…', step: 1, total })
  const [testerName, testcaseEnvironment] = await Promise.all([
    getSetting(appSlug, 'testerName'),
    getSetting(appSlug, 'testcaseEnvironment'),
  ])
  const tcSettings: PromptSettings = {
    testerName: testerName ?? undefined,
    testcaseEnvironment: testcaseEnvironment ?? undefined,
  }
  const approvedExamples = await getApprovedExamplesForPrompt(appSlug, featureName, getFeatureModule(appSlug, featureName))
  const systemPrompt = buildTestcaseSystemPrompt(appSlug, featureName, tcSettings, existingTestcases, approvedExamples, false, guidance)

  if (isGoogle) {
    const apiKey = await getSetting('global', 'GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Add it in Settings or .env.local')
    const client = new GoogleGenerativeAI(apiKey)
    const gemini = client.getGenerativeModel({
      model: model.id,
      generationConfig: { temperature: DEFAULT_TEMPERATURE },
    })
    const screenshotParts = getScreenshotParts(appSlug, featureName)
    onPhase?.({ label: 'Preparing screenshots', detail: `Encoding ${screenshotParts.length} screenshot(s)…`, step: 2, total })
    const contentParts: Array<string | { inlineData: { data: string; mimeType: string } }> = [
      systemPrompt,
      ...(screenshotParts.length > 0
        ? [
            `\n\n## Screenshots (${screenshotParts.length} image(s) attached)\nAnalyze these UI screenshots to identify all screens, fields, buttons, navigation flows, validation messages, and state transitions visible. Use this visual information to write accurate test steps and expected results.\n\n`,
            ...screenshotParts,
          ]
        : []),
    ]
    onPhase?.({ label: 'Calling AI model', detail: `Using ${model.name}…`, step: 3, total })
    const result = await withRetry(() => gemini.generateContent(contentParts))
    return stripFences(result.response.text())
  }

  // All other providers (Anthropic, Groq, custom) go through runModel, which
  // attaches screenshots for vision-capable models.
  const screenshots = model.supportsVision ? getScreenshotData(appSlug, featureName) : []
  const note =
    screenshots.length > 0
      ? `\n\n## Screenshots (${screenshots.length} image(s) attached)\nAnalyze these UI screenshots to identify all screens, fields, buttons, navigation flows, validation messages, and state transitions visible. Use this visual information to write accurate test steps and expected results.`
      : `\n\n## Note\nNo screenshots available for this model. Generate comprehensive test cases based on the workflow, domain knowledge, and functional requirements above.`
  const prompt = `${systemPrompt}${note}`
  onPhase?.({
    label: 'Calling AI model',
    detail: screenshots.length > 0 ? `Using ${model.name} with ${screenshots.length} screenshot(s)…` : `Using ${model.name}…`,
    step: 2,
    total,
  })
  const text = await runModel(modelId, '', prompt, { maxTokens: 8192, images: screenshots })
  return stripFences(text)
}

// ─── Quick Add: Scenario-Directed Test Case Generation ────────────────────────

function buildScenarioDirective(scenarios: string[]): string {
  const list = scenarios.map((s, i) => `${i + 1}. ${s}`).join('\n')
  const n = scenarios.length
  const maxCases = n * 2
  return `

## QUICK ADD — SCENARIO-DIRECTED GENERATION (OVERRIDES GENERAL INSTRUCTIONS)

The user has provided exactly ${n} raw scenario(s) below. This is your ONLY source of what to generate — there is no general coverage sweep and no minimum test case count.

Generate properly structured test cases ONLY for the scenarios listed below. Do NOT invent unrelated test cases.

Rules:
1. Produce exactly ONE test case per listed scenario by default. Only add a second, closely-related negative/edge variant (boundary, error message, retry, lockout) when the scenario text itself explicitly names more than one distinct behavior to test — and never add more than one extra variant per scenario. Do not add variants "for completeness."
2. HARD LIMIT: you were given ${n} scenario(s) — output NO MORE THAN ${maxCases} test case(s) total. If you find yourself generating more, you are over-covering; stop and consolidate.
3. Every emitted test case must map back to exactly one listed scenario. Use the workflow, domain knowledge, functional requirements (for Feature ID traceability), and approved examples above to fill in accurate steps, test data, pre-conditions, roles, environment, and expected results. Screenshots are NOT available — rely on workflow and domain knowledge.
4. Follow the EXACT same table format, column names (note "Enviroment" misspelling, "Type " trailing space), and column rules defined above.
5. Output ONLY raw markdown — the H1 heading followed immediately by the table. No preamble, no code fences.

### Raw Scenarios To Format Into Test Cases (${n} total)
${list}
`
}

export async function generateTestCasesFromScenarios(
  appSlug: string,
  featureName: string,
  scenarios: string[],
  modelId: string = 'gemini-2.5-flash',
  onPhase?: (event: PhaseEvent) => void,
  existingTestcases?: string
): Promise<GeneratedTestcases> {
  const models = await getModelsWithStatusAsync()
  const model = models.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown model: ${modelId}`)
  if (!model.enabled) throw new Error(`Model "${model.name}" is disabled. ${model.disabledReason ?? ''}`)

  const clean = scenarios.map((s) => s.trim()).filter(Boolean)
  if (clean.length === 0) throw new Error('At least one scenario is required.')

  const total = 3

  onPhase?.({ label: 'Loading context', detail: 'Reading workflow, knowledge, and requirements…', step: 1, total })

  const [testerName, testcaseEnvironment] = await Promise.all([
    getSetting(appSlug, 'testerName'),
    getSetting(appSlug, 'testcaseEnvironment'),
  ])
  const tcSettings: PromptSettings = {
    testerName: testerName ?? undefined,
    testcaseEnvironment: testcaseEnvironment ?? undefined,
  }

  const approvedExamples = await getApprovedExamplesForPrompt(appSlug, featureName, getFeatureModule(appSlug, featureName))
  const basePrompt = buildTestcaseSystemPrompt(appSlug, featureName, tcSettings, existingTestcases, approvedExamples, true)
  const systemPrompt = basePrompt + buildScenarioDirective(clean)

  onPhase?.({ label: 'Calling AI model', detail: `Using ${model.name}…`, step: 2, total })

  if (model.provider === 'google') {
    const apiKey = await getSetting('global', 'GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Add it in Settings or .env.local')
    const client = new GoogleGenerativeAI(apiKey)
    const gemini = client.getGenerativeModel({
      model: model.id,
      generationConfig: { temperature: DEFAULT_TEMPERATURE },
    })
    const result = await withRetry(() => gemini.generateContent(systemPrompt))
    return stripFences(result.response.text())
  }

  // All other providers (Anthropic, Groq, custom) go through runModel.
  const text = await runModel(modelId, '', systemPrompt, { maxTokens: 8192 })
  return stripFences(text)
}

// ─── Acceptance Criteria Helpers ──────────────────────────────────────────────

export async function extractAcceptanceCriteria(
  knowledgeMarkdown: string,
  modelId: string
): Promise<AcceptanceCriterion[]> {
  const systemPrompt = `You are a QA analyst extracting acceptance criteria from a knowledge document.
Extract all discrete, testable acceptance criteria. Look in "Acceptance Criteria Themes", business rules, validations, and workflow sections.
Return ONLY a JSON array — no markdown fences, no explanation. Each element must match exactly:
{"id": "AC-01", "text": "...", "manualCoverage": null, "aiCoveredBy": [], "aiAnalyzedAt": null}
Number them AC-01, AC-02, etc. Each criterion must be one concrete, testable statement. Target 5-15 criteria.`

  return runModelJson<AcceptanceCriterion[]>(modelId, systemPrompt, knowledgeMarkdown, {
    maxTokens: 2048,
    validate: (v): v is AcceptanceCriterion[] =>
      Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string'),
  })
}

// ─── Functional Requirement Splitting ─────────────────────────────────────────

export interface ProposedFR {
  id: string
  requirement: string
  module: string
  priority: string
}

/**
 * Split a user story into proposed functional-requirement rows for the
 * requirements table. Proposals follow the ID conventions of the existing
 * table and are grounded in module/app knowledge — the caller previews them
 * before persisting via addRequirementRows.
 */
export async function splitStoryIntoFRs(
  appSlug: string,
  story: { key: string; summary: string; description: string },
  modelId: string,
  opts: { moduleSlug?: string | null; existingFRs?: string; guidance?: string } = {}
): Promise<ProposedFR[]> {
  const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n…(truncated)` : s)
  const knowledge =
    loadModuleKnowledge(appSlug, opts.moduleSlug ?? null) || loadAppKnowledge(appSlug)
  const existing = (opts.existingFRs ?? '').trim()

  const systemPrompt = `You are a senior QA analyst decomposing a user story into functional requirements (FRs) for a requirements-traceability table.

Split the story into discrete, testable functional requirements. Each FR states exactly one verifiable capability, rule, or constraint.

## Existing Functional Requirements table
${existing || '(empty — this is the first story being split)'}

## ID conventions
- Follow the exact ID pattern of the existing table (e.g. AM_FR_CREATE_01 → PREFIX_FR_AREA_NN). Group related FRs under a shared AREA token and continue numbering after the highest existing number in that area.
- If the table is empty, derive a short uppercase prefix from the module or story and use PREFIX_FR_AREA_NN starting at 01.
- Never reuse an existing ID, and never restate a requirement the table already covers — propose only what this story adds.

## Other fields
- "module": the functional-area label — reuse the existing table's Module values where they fit; otherwise coin a concise new one.
- "priority": P1 (critical path) through P4 (cosmetic).

Return ONLY a JSON array — no markdown fences, no commentary:
[{"id": "…", "requirement": "…", "module": "…", "priority": "P2"}]
Target 3-10 FRs. Ground every FR in the story or its acceptance criteria — do NOT invent behavior.${knowledge ? `\n\n## Domain knowledge (for grounding — do not contradict)\n${truncate(knowledge, 24_000)}` : ''}`

  const userPrompt = `## User Story ${story.key} — ${story.summary}

${truncate(story.description || '(no description)', 24_000)}${opts.guidance?.trim() ? `\n\n## Additional guidance from the tester\n${opts.guidance.trim()}` : ''}`

  const proposals = await runModelJson<ProposedFR[]>(modelId, systemPrompt, userPrompt, {
    maxTokens: 4096,
    validate: (v): v is ProposedFR[] =>
      Array.isArray(v) &&
      v.length > 0 &&
      v.every(
        (x) =>
          x &&
          typeof x === 'object' &&
          typeof (x as { id?: unknown }).id === 'string' &&
          typeof (x as { requirement?: unknown }).requirement === 'string'
      ),
  })

  return proposals.map((p) => ({
    id: p.id.trim(),
    requirement: p.requirement.trim(),
    module: (p.module ?? '').trim(),
    priority: /^P[1-4]$/.test((p.priority ?? '').trim()) ? p.priority.trim() : 'P2',
  }))
}

export async function analyzeAcceptanceCoverage(
  acs: Array<{ id: string; text: string }>,
  testcaseMarkdown: string,
  modelId: string
): Promise<Array<{ id: string; coveredBy: string[] }>> {
  const rows = parseTestcaseRows(testcaseMarkdown)
  if (rows.length === 0) return acs.map(ac => ({ id: ac.id, coveredBy: [] }))

  const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)
  const tcList = rows.map(r => {
    const head = r.featureId && r.featureId !== 'N/A'
      ? `- ${r.id} [${r.featureId}]: ${r.objective}`
      : `- ${r.id}: ${r.objective}`
    // Steps disambiguate cases whose objective is terse but whose actions clearly
    // exercise the criterion — reduces false "not covered" verdicts.
    return r.steps ? `${head} — steps: ${truncate(r.steps, 120)}` : head
  }).join('\n')

  const systemPrompt = `You are a QA analyst. Determine which test cases cover each acceptance criterion.
Return ONLY a JSON array — no markdown fences, no explanation.
Format: [{"id": "AC-01", "coveredBy": ["LST_001", "LST_004"]}, ...]
An AC is covered if at least one test case objective clearly validates that criterion. Use an empty array when nothing covers it.
The bracketed token after the test case ID (e.g. [AM_FR_LIFECYCLE_03]) is the Functional Requirement ID — use it as a strong structural hint for which acceptance criterion cluster the test case maps to.
Only return test case IDs from the provided list — do not invent or guess IDs.`

  const userPrompt = `## Acceptance Criteria\n${acs.map(ac => `- ${ac.id}: ${ac.text}`).join('\n')}\n\n## Test Cases\n${tcList}`

  return runModelJson<Array<{ id: string; coveredBy: string[] }>>(modelId, systemPrompt, userPrompt, {
    maxTokens: 4096,
    validate: (v): v is Array<{ id: string; coveredBy: string[] }> =>
      Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string' && Array.isArray((x as { coveredBy?: unknown }).coveredBy)),
  })
}

export async function analyzeAcceptanceCoverageDeep(
  acs: Array<{ id: string; text: string }>,
  testcaseMarkdown: string,
  modelId: string
): Promise<Array<{ id: string; coveredBy: string[] }>> {
  const rows = parseTestcaseRows(testcaseMarkdown)
  if (rows.length === 0) return acs.map(ac => ({ id: ac.id, coveredBy: [] }))

  const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)
  const tcList = rows.map(r => {
    const head = r.featureId && r.featureId !== 'N/A'
      ? `- ${r.id} [${r.featureId}]: ${r.objective}`
      : `- ${r.id}: ${r.objective}`
    // Steps disambiguate cases whose objective is terse but whose actions clearly
    // exercise the criterion — reduces false "not covered" verdicts.
    return r.steps ? `${head} — steps: ${truncate(r.steps, 120)}` : head
  }).join('\n')

  const systemPrompt = `You are a QA analyst. Given ONE acceptance criterion and a list of test cases, return a JSON array of test case IDs that cover that criterion.
Return ONLY the array — no markdown fences, no explanation. Example: ["LST_001", "LST_004"]
A test case covers the criterion if its objective clearly validates it. Return an empty array [] when nothing applies.
Only return IDs from the provided list — do not invent or guess IDs.`

  const results = await Promise.all(
    acs.map(async ac => {
      const userPrompt = `## Acceptance Criterion\n${ac.id}: ${ac.text}\n\n## Test Cases\n${tcList}`
      const coveredBy = await runModelJson<string[]>(modelId, systemPrompt, userPrompt, {
        maxTokens: 1024,
        validate: (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string'),
      })
      return { id: ac.id, coveredBy: Array.isArray(coveredBy) ? coveredBy : [] }
    })
  )

  return results
}
