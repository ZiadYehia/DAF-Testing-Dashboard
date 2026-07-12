#!/usr/bin/env node
/**
 * Reproduces the EXACT system prompt that test-case generation sends to the model
 * for a given feature, so you can see what the AI actually receives end-to-end.
 *
 * Mirrors src/lib/context.ts (buildContext) and the buildTestcaseSystemPrompt
 * template in src/lib/ai.ts. DB-backed inputs (approved examples, Settings) are
 * not read here — it uses the same fallbacks the template uses when they're absent.
 *
 * Usage:
 *   node scripts/show-assembled-prompt.js <appSlug> <featureName>
 *
 * Prints a section-by-section size breakdown and writes the full prompt to
 * scripts/.assembled-prompt-<feature>.txt
 */
const fs = require('fs')
const path = require('path')
const matter = require('gray-matter')

const appSlug = process.argv[2]
const featureName = process.argv[3]
if (!appSlug || !featureName) {
  console.error('Usage: node scripts/show-assembled-prompt.js <appSlug> <featureName>')
  process.exit(1)
}

const DATA_ROOT = process.env.DATA_ROOT ?? path.join(process.cwd(), 'data')

// App registry — name + description from data/apps.json, used in the prompt header
const APPS = {}
try {
  for (const a of JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'apps.json'), 'utf8'))) {
    APPS[a.slug] = a.description ? `${a.name} (${a.description})` : a.name
  }
} catch { /* registry missing — fall back to the raw slug */ }

// ── context.ts replica ───────────────────────────────────────────────────────
const estimateTokens = (t) => Math.ceil(t.length / 4)
function inferType(filename, tier) {
  const f = filename.toLowerCase()
  if (/rule|format|writing|generation-process|standard/.test(f)) return 'rules'
  if (/glossary|terminolog/.test(f)) return 'glossary'
  if (/\bui\b|screen|layout|mockup/.test(f)) return 'ui'
  if (tier === 'feature') return 'story-synth'
  return 'domain'
}
function defaultPriority(type, tier) {
  if (type === 'rules') return 10
  if (type === 'story-synth') return 9
  if (type === 'glossary') return 4
  if (type === 'ui') return 6
  if (tier === 'feature') return 8
  if (tier === 'module') return 7
  return 6
}
function parseDoc(source, tier, raw) {
  let data = {}, body = raw
  try { const p = matter(raw); data = p.data ?? {}; body = p.content } catch { body = raw }
  const type = typeof data.type === 'string' ? data.type : inferType(path.basename(source), tier)
  const priority = (typeof data.priority === 'number' && data.priority >= 0 && data.priority <= 10) ? data.priority : defaultPriority(type, tier)
  const content = body.trim()
  return { source, tier, type, priority, content, tokens: estimateTokens(content) }
}
function readMarkdownDir(dir, tier) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
    .map((f) => parseDoc(path.join(dir, f), tier, fs.readFileSync(path.join(dir, f), 'utf-8')))
    .filter((d) => d.content.length > 0)
}
function moduleKnowledgeDir(app, mod) {
  const canonical = path.join(DATA_ROOT, app, 'modules', mod, 'knowledge')
  if (fs.existsSync(canonical)) return canonical
  if (mod === 'framework') { const legacy = path.join(DATA_ROOT, app, 'knowledge-framework'); if (fs.existsSync(legacy)) return legacy }
  return canonical
}
function loadKnowledgeDocs(app, mod, feature) {
  const docs = []
  docs.push(...readMarkdownDir(path.join(DATA_ROOT, app, 'knowledge'), 'app'))
  if (mod) docs.push(...readMarkdownDir(moduleKnowledgeDir(app, mod), 'module'))
  if (feature) {
    const f = path.join(DATA_ROOT, app, 'features', feature, 'knowledge.md')
    if (fs.existsSync(f)) { const d = parseDoc(f, 'feature', fs.readFileSync(f, 'utf-8')); if (d.content.length) docs.push(d) }
  }
  return docs
}
function buildContext(docs, budget = 40000) {
  const tierRank = { feature: 0, module: 1, app: 2 }
  const sorted = [...docs].sort((a, b) => b.priority - a.priority || tierRank[a.tier] - tierRank[b.tier])
  const included = [], dropped = []
  let used = 0
  for (const d of sorted) {
    if (d.priority >= 10 || used + d.tokens <= budget) { included.push(d); used += d.tokens } else dropped.push(d)
  }
  const join = (tier) => included.filter((d) => d.tier === tier).map((d) => d.content).join('\n\n---\n\n')
  return { app: join('app'), module: join('module'), feature: join('feature'), included, dropped, tokensUsed: used, budget }
}

// rankExamplesByRelevance replica (ai.ts)
function rankExamples(files, featureName, mod) {
  const tok = (s) => s.toLowerCase().replace(/-testcases\.md$/, '').split(/[^a-z0-9]+/).filter((t) => t.length > 2)
  const wanted = new Set([...tok(featureName), ...(mod ? tok(mod) : [])])
  return files.map((f) => ({ f, score: tok(f).reduce((n, t) => n + (wanted.has(t) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score || files.indexOf(a.f) - files.indexOf(b.f))
    .slice(0, 2).map((s) => s.f)
}

// ── gather inputs ────────────────────────────────────────────────────────────
const featureDir = path.join(DATA_ROOT, appSlug, 'features', featureName)
const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '')
const workflow = readIf(path.join(featureDir, 'workflow.md'))
let featureModule = null
try { featureModule = (JSON.parse(readIf(path.join(featureDir, 'metadata.json')) || '{}').module) ?? null } catch {}
let moduleName = featureModule
try { if (featureModule) moduleName = JSON.parse(readIf(path.join(DATA_ROOT, appSlug, 'modules', featureModule, 'module.json')) || '{}').name ?? featureModule } catch {}

const ctx = buildContext(loadKnowledgeDocs(appSlug, featureModule, featureName))
const appKnowledge = ctx.app, moduleKnowledge = ctx.module, featureKnowledge = ctx.feature
const requirements = readIf(path.join(DATA_ROOT, appSlug, 'requirements', 'FRs.md'))

let examples = ''
const exDir = path.join(DATA_ROOT, appSlug, 'examples')
if (fs.existsSync(exDir)) {
  const files = fs.readdirSync(exDir).filter((f) => f.endsWith('-testcases.md'))
  examples = rankExamples(files, featureName, featureModule)
    .map((f) => `### Example: ${f}\n\n${fs.readFileSync(path.join(exDir, f), 'utf-8')}`).join('\n\n---\n\n')
}

const testerName = 'Ziad Yehia'
const testcaseEnvironment = 'Browser: Microsoft Edge Version 143.0.3650.96 — Windows 11 Pro 10.0.26200 | Environment: Design only — not yet implemented | Role: <Admin|Auditor|Asset Owner|Viewer>'
const appName = APPS[appSlug] || appSlug

// ── template (verbatim from buildTestcaseSystemPrompt, base case) ──────────────
const prompt = `You are a Senior QA Engineer specializing in ${appName}.

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
2. Generate a comprehensive set of test cases: happy paths, negative/invalid inputs, edge cases, error handling, access control, and lifecycle flows.
3. Output ONLY raw markdown — the H1 heading followed immediately by the table. No preamble, no explanation, no code fences, no metadata block.
4. First line is the H1 heading — the feature name only (no "Test Cases" suffix). Example: \`# Assets List\`
5. Table columns — EXACT order, EXACT names (note: "Enviroment" is intentionally misspelled):
   \`|Feature ID|TestCase ID|Tester|Validity|Test Cases Title / Objective|Enviroment|Pre-condition|Test Data|Steps|Expected Results|Status|Attachment|Type |\`
   \`|---|---|---|---|---|---|---|---|---|---|---|---|---|\`
6. Column rules:
   - **Feature ID**: FR ID from FRs.md (e.g. \`AM_FR_01\`). Use \`N/A\` if no FR applies. Multiple FRs space-separated.
   - **TestCase ID**: \`<PREFIX>_<NNN>\` — 3–4 letter feature abbreviation + 3-digit zero-padded number. Derive prefix from feature name (e.g. LST for Assets List, CRT for Asset Create, LFE for Lifecycle, REL for Relationships, EVI for Evidence, LOG for Activity Log). Example: \`LST_001\`.
   - **Tester**: Always \`${testerName}\`
   - **Validity**: \`Positive\` for valid/happy-path; \`Negative\` for errors, invalid inputs, edge cases, access-control denial.
   - **Test Cases Title / Objective**: Sentence starting with "Validate that…". One behaviour per test case.
   - **Enviroment**: \`${testcaseEnvironment}\`. Match role to the test scenario.
   - **Pre-condition**: Numbered inline steps (e.g. \`1. User is logged in as Admin. 2. Assets exist.\`). Use \`Not Applicable\` when none needed.
   - **Test Data**: Concrete values (field names, example names, codes). Use \`Not Applicable\` (never "N/A") when none needed.
   - **Steps**: Numbered inline action steps starting from 1.
   - **Expected Results**: One or more falsifiable statements.
   - **Status**: Always \`Under Testing\`
   - **Attachment**: Always leave empty.
   - **Type**: One of \`Functional\`, \`Negative\`, \`UI/UX\`, \`Access Control\`, \`Integration\`, \`Lifecycle\`. Include a trailing space: \`Functional \`.
7. Generate at minimum 15 test cases. Cover all significant flows, fields, validations, and states visible in the screenshots and workflow.
8. IMPORTANT: Match the approved example test case files above — their column names, format, and style are the gold standard.

Output ONLY the markdown — nothing else.`

// ── output ─────────────────────────────────────────────────────────────────
const sections = [
  ['Header + task', `You are a Senior QA Engineer…`.length],
  ['Feature workflow', workflow.length],
  ['App-tier knowledge (FORMAT+METHOD+DOMAIN)', appKnowledge.length],
  ['Module knowledge' + (moduleName ? ` (${moduleName})` : ''), moduleKnowledge.length],
  ['Feature knowledge', featureKnowledge.length],
  ['Functional requirements', requirements.length],
  ['Example test cases', examples.length],
  ['Instructions block (the orchestration)', 1600],
]
console.log(`\nAssembled test-case prompt — ${appSlug} / ${featureName}`)
console.log(`Module: ${moduleName ?? '(none)'}   Total prompt: ${prompt.length.toLocaleString()} chars (~${estimateTokens(prompt).toLocaleString()} tokens)`)
console.log(`Knowledge budget: ${ctx.tokensUsed.toLocaleString()}/${ctx.budget.toLocaleString()} tok used` + (ctx.dropped.length ? `, dropped ${ctx.dropped.length}` : ', nothing dropped'))
console.log(`\nKnowledge docs included (priority order):`)
for (const d of ctx.included) console.log(`  [${d.tier}] ${path.basename(d.source)}  type=${d.type} priority=${d.priority} (~${d.tokens} tok)`)
console.log(`\nSection sizes (chars):`)
for (const [name, len] of sections) console.log(`  ${String(len).padStart(7)}  ${name}`)

const out = path.join('scripts', `.assembled-prompt-${featureName}.txt`)
fs.writeFileSync(out, prompt, 'utf-8')
console.log(`\nFull assembled prompt written to: ${out}`)
console.log(`(Plus, at runtime: a user message with the request, and — for vision models — the feature screenshots.)`)
