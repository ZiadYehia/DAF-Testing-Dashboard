import { getConfig } from './jira'
import { runModel } from './ai'
import { getDataSource } from './db'
import { IUserStory, UserStoryEntity } from './entities'
import { loadAppKnowledge } from './knowledge'
import { getJiraSourceConfig } from './jira-source-server'

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

/** A single token shaped like a Jira issue key, e.g. "DT-1234". */
const JIRA_KEY_RE = /^[A-Za-z][A-Za-z0-9]*-\d+$/

/**
 * If `text` is a comma/whitespace-separated list of Jira-key-shaped tokens,
 * return them uppercased; otherwise null (treat as free-text search).
 */
function parseKeyList(text: string): string[] | null {
  const tokens = text.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean)
  if (tokens.length === 0 || !tokens.every((t) => JIRA_KEY_RE.test(t))) return null
  return tokens.map((t) => t.toUpperCase())
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Read user stories — DB-only (the import migration covers `user_stories`
 * fully, so there is no FS fallback here anymore).
 *
 * Queries `user_stories` for `appSlug` and applies key/module filters in memory.
 */
export async function loadLocalStories(
  appSlug: string,
  opts: { module?: string; keys?: string[]; search?: string } = {}
): Promise<Story[]> {
  const ds = await getDataSource()
  const repo = ds.getRepository<IUserStory>(UserStoryEntity)
  const rows = await repo.findBy({ appSlug })

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
  if (opts.search?.trim()) {
    // Same key-vs-text detection as fetchStories: pasted key(s) → exact match, else substring.
    const searchKeys = parseKeyList(opts.search)
    if (searchKeys) {
      const searchKeySet = new Set(searchKeys)
      stories = stories.filter((s) => searchKeySet.has(s.key.toUpperCase()))
    } else {
      const needle = opts.search.trim().toLowerCase()
      stories = stories.filter((s) => {
        const haystack = (s.key + ' ' + s.summary + ' ' + s.description).toLowerCase()
        return haystack.includes(needle)
      })
    }
  }

  return stories.sort((a, b) => a.key.localeCompare(b.key))
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

/** Shared issue → Story mapping used by every fetch path (project search, board search, single-issue lookup). */
function normalizeStoryIssue(issue: SearchedStoryIssue): Story {
  return {
    key: issue.key,
    summary: issue.fields.summary ?? '',
    description: descriptionToText(issue.fields.description),
    status: issue.fields.status?.name ?? '',
    labels: issue.fields.labels ?? [],
    components: (issue.fields.components ?? []).map((c) => c.name ?? '').filter(Boolean),
  }
}

type JiraConfig = Awaited<ReturnType<typeof getConfig>>

/**
 * Project/global-mode search — POST /rest/api/3/search/jql. Jira Cloud removed
 * GET /rest/api/2/search (CHANGE-2046, HTTP 410); this is the same replacement
 * endpoint jira.ts's searchIssuesByKeys already migrated to. That endpoint
 * paginates via `nextPageToken` rather than `startAt`, so this loops pages
 * until either `max` results are collected or the API reports no further page.
 */
async function fetchProjectIssues(
  config: JiraConfig,
  jql: string,
  fields: string[],
  max: number
): Promise<SearchedStoryIssue[]> {
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

  return issues
}

/**
 * Board-mode search — GET /rest/agile/1.0/board/{boardId}/issue. Used when an
 * app's Jira source is scoped to a board id rather than a project key (e.g.
 * GRC and DT share Jira project "DT" but sit on different boards). This
 * endpoint paginates via `startAt`/`maxResults` rather than `nextPageToken`.
 */
async function fetchBoardIssues(
  config: JiraConfig,
  boardId: string,
  jql: string,
  fields: string[],
  max: number
): Promise<SearchedStoryIssue[]> {
  const issues: SearchedStoryIssue[] = []
  let startAt = 0
  for (;;) {
    const url = `${config.baseUrl}/rest/agile/1.0/board/${boardId}/issue?jql=${encodeURIComponent(jql)}&fields=${fields.join(',')}&startAt=${startAt}&maxResults=50`
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: config.authHeader, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Jira board search responded ${response.status}: ${errorBody}`)
    }

    const data = (await response.json()) as { issues?: SearchedStoryIssue[]; total?: number }
    const page = data.issues ?? []
    issues.push(...page)
    startAt += page.length
    const target = Math.min(data.total ?? max, max)
    if (page.length === 0 || issues.length >= target) break
  }
  return issues
}

/**
 * Fetch user stories from the configured Jira board/project.
 * Optionally scope to a module (Jira component), pass a raw JQL override, or
 * free-text/key search. When `appSlug` is given, the app's per-app Jira source
 * config (Settings → Retest Board) picks the effective project key or board id
 * — see `jira-source.ts`. Without `appSlug` (or with source mode "global"),
 * behavior is unchanged: the global JIRA_PROJECT_KEY.
 */
export async function fetchStories(
  opts: { module?: string; jql?: string; max?: number; appSlug?: string; search?: string },
  userId: number
): Promise<Story[]> {
  const config = await getConfig(userId)

  let effectiveProjectKey = config.projectKey
  let boardId: string | null = null
  if (opts.appSlug) {
    const source = await getJiraSourceConfig(opts.appSlug)
    if (source.mode === 'project' && source.projectKey) effectiveProjectKey = source.projectKey
    if (source.mode === 'board') boardId = source.boardId
  }

  const max = opts.max ?? 50
  const fields = ['summary', 'description', 'status', 'labels', 'components']

  let jql = opts.jql
  if (!jql) {
    // Pasted Jira key(s) always resolve directly, regardless of module/text search.
    const keys = opts.search ? parseKeyList(opts.search) : null
    const clauses: string[] = []
    if (!boardId) clauses.push(`project = "${effectiveProjectKey}"`)
    if (keys) {
      clauses.push(`key in (${keys.join(', ')})`)
    } else {
      clauses.push('issuetype in (Story)')
      if (opts.module) clauses.push(`component = "${opts.module.replace(/"/g, '\\"')}"`)
      if (opts.search) {
        const esc = opts.search.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        clauses.push(`(summary ~ "${esc}*" OR text ~ "${esc}")`)
      }
    }
    jql = clauses.join(' AND ')
    if (!boardId) jql += ' ORDER BY updated DESC'
  }

  const issues = boardId
    ? await fetchBoardIssues(config, boardId, jql, fields, max)
    : await fetchProjectIssues(config, jql, fields, max)

  return issues.map(normalizeStoryIssue)
}

/**
 * Fetch a single Jira story by its issue key (e.g. "ABC-123").
 * Uses the single-issue REST endpoint rather than a JQL search.
 * Returns null on any error so callers can treat it as fire-and-forget.
 */
export async function fetchStoryByKey(key: string, userId: number): Promise<Story | null> {
  try {
    const config = await getConfig(userId)
    const url = `${config.baseUrl}/rest/api/2/issue/${encodeURIComponent(key)}?fields=summary,description,status,labels,components`
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: config.authHeader, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return null
    const issue = (await response.json()) as SearchedStoryIssue
    return normalizeStoryIssue(issue)
  } catch {
    return null
  }
}

/**
 * Persist a story — DB upsert only (the `user_stories` table is the source of
 * truth; a write failure propagates so callers know the save did not happen).
 */
export async function saveLocalStory(appSlug: string, story: Story): Promise<void> {
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
  userId: number,
  /** When provided, refine this existing document instead of writing from scratch. */
  priorDoc?: string
): Promise<string> {
  const existingKnowledge = await loadAppKnowledge(appSlug)

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

  return runModel(modelId, systemPrompt, userPrompt, { maxTokens: 8192 }, userId)
}
