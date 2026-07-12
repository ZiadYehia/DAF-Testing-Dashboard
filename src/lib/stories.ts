import fs from 'fs'
import path from 'path'
import { getConfig } from './jira'
import { runModel } from './ai'
import { getDataSource } from './db'
import { IUserStory, UserStoryEntity } from './entities'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Story {
  key: string
  summary: string
  description: string
  status: string
  labels: string[]
  components: string[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDataRoot(): string {
  return process.env.DATA_ROOT ?? path.join(process.cwd(), 'data')
}

/**
 * Jira Server/DC returns description as plain text (api/2). Cloud may return an
 * Atlassian Document Format object — flatten it to text defensively.
 */
function descriptionToText(desc: unknown): string {
  if (!desc) return ''
  if (typeof desc === 'string') return desc
  // ADF: walk the doc tree collecting text nodes
  const parts: string[] = []
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const n = node as { text?: string; content?: unknown[] }
    if (typeof n.text === 'string') parts.push(n.text)
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(desc)
  return parts.join(' ')
}

function safeJsonArray(raw: string): string[] {
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

function loadStoriesFromFs(
  appSlug: string,
  opts: { module?: string; keys?: string[] } = {}
): Story[] {
  const dir = path.join(getDataRoot(), appSlug, 'stories')
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir).filter(
    (f) => f.endsWith('.md') && f.toLowerCase() !== 'index.md'
  )

  const keySet = opts.keys && opts.keys.length > 0 ? new Set(opts.keys) : null
  const moduleNeedle = opts.module?.trim().toLowerCase()

  const stories: Story[] = []
  for (const f of files) {
    const key = f.replace(/\.md$/i, '')
    if (keySet && !keySet.has(key)) continue

    const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
    const firstHeading = raw.match(/^#+\s+(.+)$/m)?.[1]?.trim()
    const firstLine = raw.split('\n').find((l) => l.trim().length > 0)?.trim() ?? ''
    const summary = firstHeading || firstLine.replace(/^\*+|\*+$/g, '')
    const description = raw

    if (moduleNeedle) {
      const haystack = (key + ' ' + summary + ' ' + raw).toLowerCase()
      if (!haystack.includes(moduleNeedle)) continue
    }

    stories.push({ key, summary, description, status: '', labels: [], components: [] })
  }

  return stories.sort((a, b) => a.key.localeCompare(b.key))
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Read user stories — DB-first, FS fallback.
 *
 * DB path: queries `user_stories` for `appSlug`, applies key/module filters in memory.
 * FS fallback: reads `data/<appSlug>/stories/*.md`.
 * `INDEX.md` is skipped. Files matching `keys`, or whose content contains `module`
 * (case-insensitive), are returned.
 */
export async function loadLocalStories(
  appSlug: string,
  opts: { module?: string; keys?: string[] } = {}
): Promise<Story[]> {
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository<IUserStory>(UserStoryEntity)
    const rows = await repo.findBy({ appSlug })
    if (rows.length > 0) {
      const keySet = opts.keys && opts.keys.length > 0 ? new Set(opts.keys) : null
      const moduleNeedle = opts.module?.trim().toLowerCase()

      let stories = rows.map((row) => ({
        key: row.storyKey,
        summary: row.summary,
        description: row.description,
        status: row.status,
        labels: safeJsonArray(row.labels),
        components: safeJsonArray(row.components),
      }))

      if (keySet) stories = stories.filter((s) => keySet.has(s.key))
      if (moduleNeedle) {
        stories = stories.filter((s) => {
          const haystack = (s.key + ' ' + s.summary + ' ' + s.description).toLowerCase()
          return haystack.includes(moduleNeedle)
        })
      }

      return stories.sort((a, b) => a.key.localeCompare(b.key))
    }
  } catch { /* fall through to FS */ }

  return loadStoriesFromFs(appSlug, opts)
}

/**
 * Fetch user stories from the configured Jira board/project.
 * Optionally scope to a module (Jira component) or pass a raw JQL override.
 */
type SearchedStoryIssue = {
  key: string
  fields: {
    summary?: string
    description?: unknown
    status?: { name?: string }
    labels?: string[]
    components?: Array<{ name?: string }>
  }
}

/**
 * Fetch user stories from the configured Jira board/project.
 * Optionally scope to a module (Jira component) or pass a raw JQL override.
 *
 * Uses POST /rest/api/3/search/jql — Jira Cloud removed GET /rest/api/2/search
 * (CHANGE-2046, HTTP 410); this is the same replacement endpoint jira.ts's
 * searchIssuesByKeys already migrated to. That endpoint paginates via
 * `nextPageToken` rather than `startAt`, so this loops pages until either
 * `opts.max` results are collected or the API reports no further page.
 */
export async function fetchStories(
  opts: { module?: string; jql?: string; max?: number } = {}
): Promise<Story[]> {
  const config = await getConfig()

  let jql = opts.jql
  if (!jql) {
    const clauses = [`project = "${config.projectKey}"`, 'issuetype in (Story)']
    if (opts.module) clauses.push(`component = "${opts.module.replace(/"/g, '\\"')}"`)
    jql = `${clauses.join(' AND ')} ORDER BY updated DESC`
  }

  const max = opts.max ?? 50
  const fields = ['summary', 'description', 'status', 'labels', 'components']

  const issues: SearchedStoryIssue[] = []
  let nextPageToken: string | undefined
  do {
    const response = await fetch(`${config.baseUrl}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: config.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jql,
        fields,
        maxResults: Math.min(max - issues.length, 100),
        ...(nextPageToken ? { nextPageToken } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Jira search responded ${response.status}: ${errorBody}`)
    }

    const data = (await response.json()) as {
      issues?: SearchedStoryIssue[]
      nextPageToken?: string
    }

    issues.push(...(data.issues ?? []))
    nextPageToken = data.nextPageToken
  } while (nextPageToken && issues.length < max)

  return issues.map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary ?? '',
    description: descriptionToText(issue.fields.description),
    status: issue.fields.status?.name ?? '',
    labels: issue.fields.labels ?? [],
    components: (issue.fields.components ?? []).map((c) => c.name ?? '').filter(Boolean),
  }))
}

/**
 * Fetch a single Jira story by its issue key (e.g. "DT-2840").
 * Uses the single-issue REST endpoint rather than a JQL search.
 * Returns null on any error so callers can treat it as fire-and-forget.
 */
export async function fetchStoryByKey(key: string): Promise<Story | null> {
  try {
    const config = await getConfig()
    const url = `${config.baseUrl}/rest/api/2/issue/${encodeURIComponent(key)}?fields=summary,description,status,labels,components`
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: config.authHeader, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return null
    const issue = (await response.json()) as {
      key: string
      fields: {
        summary?: string
        description?: unknown
        status?: { name?: string }
        labels?: string[]
        components?: Array<{ name?: string }>
      }
    }
    return {
      key: issue.key,
      summary: issue.fields.summary ?? '',
      description: descriptionToText(issue.fields.description),
      status: issue.fields.status?.name ?? '',
      labels: issue.fields.labels ?? [],
      components: (issue.fields.components ?? []).map((c) => c.name ?? '').filter(Boolean),
    }
  } catch {
    return null
  }
}

/**
 * Persist a story — FS write first, then DB upsert.
 * FS format matches what the FS fallback in loadLocalStories expects.
 */
export async function saveLocalStory(appSlug: string, story: Story): Promise<void> {
  // FS write-first (non-fatal)
  try {
    const dir = path.join(getDataRoot(), appSlug, 'stories')
    fs.mkdirSync(dir, { recursive: true })
    const content = `# ${story.summary}\n\n${story.description}`
    fs.writeFileSync(path.join(dir, `${story.key}.md`), content, 'utf-8')
  } catch { /* non-fatal */ }

  // DB upsert (non-fatal)
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository<IUserStory>(UserStoryEntity)
    await repo.upsert(
      {
        appSlug,
        storyKey: story.key,
        summary: story.summary,
        description: story.description,
        status: story.status,
        labels: JSON.stringify(story.labels ?? []),
        components: JSON.stringify(story.components ?? []),
      },
      ['appSlug', 'storyKey']
    )
  } catch { /* non-fatal */ }
}

/** Read the app's existing domain knowledge to ground the synthesis. */
function loadExistingKnowledge(appSlug: string): string {
  const dir = path.join(getDataRoot(), appSlug, 'knowledge')
  if (!fs.existsSync(dir)) return ''
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
    .join('\n\n---\n\n')
}

/**
 * Synthesize a module-knowledge markdown document from the given board stories,
 * grounded in the app's existing domain knowledge.
 */
export async function synthesizeKnowledge(
  appSlug: string,
  module: string,
  stories: Story[],
  modelId: string,
  /** When provided, refine this existing document instead of writing from scratch. */
  priorDoc?: string
): Promise<string> {
  const existingKnowledge = loadExistingKnowledge(appSlug)

  const storiesBlock = stories
    .map(
      (s) =>
        `### ${s.key} — ${s.summary}\nStatus: ${s.status}` +
        `${s.components.length ? ` · Components: ${s.components.join(', ')}` : ''}` +
        `${s.labels.length ? ` · Labels: ${s.labels.join(', ')}` : ''}\n\n${s.description || '(no description)'}`
    )
    .join('\n\n')

  const systemPrompt = `You are a Senior QA Engineer building domain knowledge for the "${module}" module so that an AI can write better test cases and bug reports for it.

You are given user stories from the team's Jira board plus the existing platform domain knowledge. Synthesize a single, well-structured markdown knowledge document for the "${module}" module.

## Existing Platform Domain Knowledge (for grounding — do not contradict)
${existingKnowledge || 'None available.'}
${priorDoc ? `\n## Current Knowledge Document To UPDATE\nThe document below already exists for this module and may contain manual edits. Your job is to REFINE it with the stories — preserve any content the stories don't contradict (especially hand-written clarifications and Open Questions), integrate new detail the stories provide, and correct anything the stories supersede. Do not discard sections or drop manual additions.\n\n${priorDoc}\n` : ''}
## Output Requirements
Produce ONLY markdown (no code fences around the whole document). Structure it as:
- A top-level heading: "# ${module} — Module Knowledge (from board stories)"
- **Overview** — what this module does and why it exists
- **Roles & Actors** — who uses it
- **Key Workflows** — the main user flows implied by the stories (numbered steps)
- **Business Rules & Validations** — rules, constraints, and edge cases the stories imply
- **Fields / Data** — relevant fields, enums, and identifiers
- **Acceptance Criteria Themes** — recurring acceptance criteria across stories
- **Open Questions / Ambiguities** — anything underspecified that a tester should clarify
- **Source Stories** — bullet list of the story keys used

Rules:
- Ground every statement in the provided stories or existing knowledge — do NOT invent features.
- Be concrete and testable; prefer exact field names, enum values, and rule statements.
- Where stories are vague, say so under Open Questions rather than guessing.`

  const userPrompt = `## Module
${module}

## Jira Stories (${stories.length})
${storiesBlock || '(no stories returned)'}`

  return runModel(modelId, systemPrompt, userPrompt, { maxTokens: 8192 })
}
