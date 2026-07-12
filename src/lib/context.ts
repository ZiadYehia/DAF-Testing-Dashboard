import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { getDataRoot } from './paths'

/**
 * Knowledge context assembler.
 *
 * Replaces the previous "read a folder, concatenate every .md wholesale" approach
 * with a typed, priority-ordered, token-budgeted assembly. It is fully additive:
 * files without front-matter still load, with their type and priority inferred from
 * tier and filename, so existing knowledge bases keep working unchanged.
 *
 * Front-matter recognised (all optional):
 *   ---
 *   type: rules | domain | glossary | ui | examples | story-synth | other
 *   scope: app | module | feature
 *   priority: 1-10        # higher wins under budget pressure; >=10 never dropped
 *   lastReviewed: 2026-06-27
 *   ---
 */

export type KnowledgeType = 'rules' | 'domain' | 'glossary' | 'ui' | 'examples' | 'story-synth' | 'other'
export type KnowledgeTier = 'app' | 'module' | 'feature'

export interface KnowledgeDoc {
  /** File path or synthetic label, for logging. */
  source: string
  tier: KnowledgeTier
  type: KnowledgeType
  /** 1-10; higher is more important. >= 10 is never dropped. */
  priority: number
  content: string
  /** Rough token estimate (~4 chars/token). */
  tokens: number
}

export interface AssembledContext {
  /** Included app-tier docs, concatenated. */
  app: string
  /** Included module-tier docs, concatenated. */
  module: string
  /** Included feature-tier docs, concatenated. */
  feature: string
  /** Docs excluded because the token budget was exhausted. */
  dropped: Array<{ source: string; tokens: number; priority: number }>
  tokensUsed: number
  budget: number
}

/** Rough token estimate. Deliberately cheap — no tokenizer dependency. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

const DEFAULT_BUDGET = 40_000

function knowledgeBudget(): number {
  const raw = process.env.KNOWLEDGE_TOKEN_BUDGET
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BUDGET
}

function inferType(filename: string, tier: KnowledgeTier): KnowledgeType {
  const f = filename.toLowerCase()
  if (/rule|format|writing|generation-process|standard/.test(f)) return 'rules'
  if (/glossary|terminolog/.test(f)) return 'glossary'
  if (/\bui\b|screen|layout|mockup/.test(f)) return 'ui'
  // A feature's knowledge.md is synthesized from its linked user story.
  if (tier === 'feature') return 'story-synth'
  return 'domain'
}

function defaultPriority(type: KnowledgeType, tier: KnowledgeTier): number {
  if (type === 'rules') return 10 // format/writing rules are essential — never drop
  if (type === 'story-synth') return 9 // feature-specific, highly relevant
  if (type === 'glossary') return 4
  if (type === 'ui') return 6
  // domain / other: more specific tiers are more relevant
  if (tier === 'feature') return 8
  if (tier === 'module') return 7
  return 6 // app
}

function parseDoc(source: string, tier: KnowledgeTier, raw: string): KnowledgeDoc {
  let data: Record<string, unknown> = {}
  let body = raw
  try {
    const parsed = matter(raw)
    data = parsed.data ?? {}
    body = parsed.content
  } catch {
    // Malformed front-matter — treat the whole file as body.
    body = raw
  }
  const filename = path.basename(source)
  const type = (typeof data.type === 'string' ? data.type : inferType(filename, tier)) as KnowledgeType
  const priority =
    typeof data.priority === 'number' && data.priority >= 0 && data.priority <= 10
      ? data.priority
      : defaultPriority(type, tier)
  const content = body.trim()
  return { source, tier, type, priority, content, tokens: estimateTokens(content) }
}

function readMarkdownDir(dir: string, tier: KnowledgeTier): KnowledgeDoc[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const full = path.join(dir, f)
      return parseDoc(full, tier, fs.readFileSync(full, 'utf-8'))
    })
    .filter((d) => d.content.length > 0)
}

/** Resolve a module's knowledge directory (canonical, with the legacy framework fallback). */
function moduleKnowledgeDir(appSlug: string, module: string): string {
  const canonical = path.join(getDataRoot(), appSlug, 'modules', module, 'knowledge')
  if (fs.existsSync(canonical)) return canonical
  if (module === 'framework') {
    const legacy = path.join(getDataRoot(), appSlug, 'knowledge-framework')
    if (fs.existsSync(legacy)) return legacy
  }
  return canonical
}

/** Collect every candidate knowledge doc across the app → module → feature tiers. */
export function loadKnowledgeDocs(
  appSlug: string,
  module: string | null,
  featureName?: string | null
): KnowledgeDoc[] {
  const docs: KnowledgeDoc[] = []

  docs.push(...readMarkdownDir(path.join(getDataRoot(), appSlug, 'knowledge'), 'app'))

  if (module) {
    docs.push(...readMarkdownDir(moduleKnowledgeDir(appSlug, module), 'module'))
  }

  if (featureName) {
    const featureKnowledge = path.join(getDataRoot(), appSlug, 'features', featureName, 'knowledge.md')
    if (fs.existsSync(featureKnowledge)) {
      const raw = fs.readFileSync(featureKnowledge, 'utf-8')
      const doc = parseDoc(featureKnowledge, 'feature', raw)
      if (doc.content.length > 0) docs.push(doc)
    }
  }

  return docs
}

/**
 * Select docs to fit a token budget. Rules (priority >= 10) are always kept;
 * the rest are added greedily by priority (then tier specificity). Anything that
 * doesn't fit is reported in `dropped` so callers can log the truncation.
 */
export function buildContext(
  docs: KnowledgeDoc[],
  opts: { budgetTokens?: number } = {}
): AssembledContext {
  const budget = opts.budgetTokens ?? knowledgeBudget()

  const tierRank: Record<KnowledgeTier, number> = { feature: 0, module: 1, app: 2 }
  const sorted = [...docs].sort(
    (a, b) => b.priority - a.priority || tierRank[a.tier] - tierRank[b.tier]
  )

  const included: KnowledgeDoc[] = []
  const dropped: AssembledContext['dropped'] = []
  let used = 0
  for (const doc of sorted) {
    const essential = doc.priority >= 10
    if (essential || used + doc.tokens <= budget) {
      included.push(doc)
      used += doc.tokens
    } else {
      dropped.push({ source: doc.source, tokens: doc.tokens, priority: doc.priority })
    }
  }

  const join = (tier: KnowledgeTier) =>
    included
      .filter((d) => d.tier === tier)
      .map((d) => d.content)
      .join('\n\n---\n\n')

  return {
    app: join('app'),
    module: join('module'),
    feature: join('feature'),
    dropped,
    tokensUsed: used,
    budget,
  }
}
