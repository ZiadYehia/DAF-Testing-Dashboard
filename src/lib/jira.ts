import type { BugDetail } from './bugs'
import { getSetting } from './settings'
import { getBugFormat } from './bug-format-server'
import { getVariantConfig, jiraSummaryForBug, JIRA_SYNC_FIELDS, type JiraSyncFieldKey } from './bug-format'
import { getJiraSourceConfig } from './jira-source-server'
import { getCrFormat } from './cr-format-server'
import { getCrVariantConfig, type CrParentType, type CrVariant } from './cr-format'

interface JiraConfig {
  baseUrl: string
  projectKey: string
  boardId: string | null
  /** Authorization header value — Bearer PAT (Server/DC) or Basic email:token (Cloud) */
  authHeader: string
}

/**
 * Resolve the Authorization header value for a Jira request.
 * Every user must have their own Jira credentials — settings scope
 * `user:<id>`, keys JIRA_EMAIL + JIRA_API_TOKEN — and both must be set,
 * so a partial per-user config (e.g. email saved but no token yet) is
 * rejected rather than half-applied. There is no shared/global identity
 * to fall back to: reporting or syncing bugs to Jira as "whoever set up
 * the global credentials" is exactly the identity bug this removes.
 */
export async function getJiraAuth(userId: number): Promise<string> {
  const [userEmail, userApiToken] = await Promise.all([
    getSetting(`user:${userId}`, 'JIRA_EMAIL'),
    getSetting(`user:${userId}`, 'JIRA_API_TOKEN'),
  ])
  if (userEmail && userApiToken) {
    return `Basic ${Buffer.from(`${userEmail}:${userApiToken}`).toString('base64')}`
  }
  throw new Error(
    'Jira account not configured. Add your Jira email + API token in Settings → Credentials → My Jira Account.'
  )
}

/**
 * Build Jira config + auth header.
 * - `baseUrl`/`projectKey`/`boardId` are shared instance config (which Jira
 *   project bugs get filed to), read from the global Settings scope.
 * - `authHeader` is resolved from `userId`'s own Jira credentials (see
 *   getJiraAuth) — every caller must supply a real authenticated user id.
 */
export async function getConfig(userId: number): Promise<JiraConfig> {
  const [baseUrl, projectKey, boardId] = await Promise.all([
    getSetting('global', 'JIRA_BASE_URL'),
    getSetting('global', 'JIRA_PROJECT_KEY'),
    getSetting('global', 'JIRA_BOARD_ID'),
  ])

  if (!baseUrl || !projectKey) {
    throw new Error(
      'Jira is not configured. Add JIRA_BASE_URL and JIRA_PROJECT_KEY in Settings or .env.local'
    )
  }

  const authHeader = await getJiraAuth(userId)

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    projectKey,
    boardId: boardId ?? null,
    authHeader,
  }
}

/** Outbound requests to Jira get a hard timeout so a hung instance can't stall a request indefinitely. */
const JIRA_FETCH_TIMEOUT_MS = 15_000

/**
 * Shared fetch wrapper for all Jira REST calls: resolves the path against the
 * configured base URL and attaches the auth header + a request timeout. Callers
 * merge in method/body/extra headers via `init`; an explicit header in `init`
 * always wins over the default.
 */
async function jiraFetch(config: JiraConfig, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (!headers.has('Authorization')) headers.set('Authorization', config.authHeader)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  return fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(JIRA_FETCH_TIMEOUT_MS),
  })
}

/**
 * jiraFetch + throw on a non-OK response, using the "Jira API responded <status>: <body>"
 * message shape most existing call sites use. Pass `errorPrefix` for the handful of
 * endpoints with their own established message text (e.g. attachment uploads), so any
 * error-text handling downstream keeps matching exactly as before.
 */
async function jiraFetchOrThrow(
  config: JiraConfig,
  path: string,
  init: RequestInit = {},
  errorPrefix = 'Jira API responded'
): Promise<Response> {
  const response = await jiraFetch(config, path, init)
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`${errorPrefix} ${response.status}: ${errorBody}`)
  }
  return response
}

interface JiraSelectOption {
  id: string
  value: string
}

/** Strip a leading emoji/symbol prefix (e.g. "🟡 Moderate" -> "moderate"), lowercased. */
function normalizeOptionLabel(label: string): string {
  return label.replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase()
}

/** Our stored values look like "S3 – Moderate"; Jira's option is keyed on the trailing word ("Moderate"). */
function trailingKeyword(rawValue: string): string {
  const parts = rawValue.split(/[-–—]/)
  return normalizeOptionLabel(parts[parts.length - 1])
}

/** Match our value string to one of Jira's actual select options by trailing keyword, ignoring emoji/prefix differences. */
function matchOptionByKeyword(allowedValues: JiraSelectOption[], rawValue: string): JiraSelectOption | null {
  const keyword = trailingKeyword(rawValue)
  if (!keyword) return null
  const exact = allowedValues.find((v) => normalizeOptionLabel(v.value) === keyword)
  if (exact) return exact
  return (
    allowedValues.find((v) => {
      const cleaned = normalizeOptionLabel(v.value)
      return cleaned.includes(keyword) || keyword.includes(cleaned)
    }) ?? null
  )
}

async function getEditFieldAllowedValues(config: JiraConfig, jiraKey: string, fieldId: string): Promise<JiraSelectOption[]> {
  const response = await jiraFetchOrThrow(config, `/rest/api/2/issue/${jiraKey}/editmeta`)
  const data = (await response.json()) as { fields?: Record<string, { allowedValues?: JiraSelectOption[] }> }
  return data.fields?.[fieldId]?.allowedValues ?? []
}

async function getCreateFieldAllowedValues(
  config: JiraConfig,
  projectKey: string,
  issueType: string,
  fieldId: string
): Promise<JiraSelectOption[]> {
  const response = await jiraFetchOrThrow(
    config,
    `/rest/api/2/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&issuetypeNames=${encodeURIComponent(issueType)}&expand=projects.issuetypes.fields`
  )
  const data = (await response.json()) as {
    projects?: { issuetypes?: { fields?: Record<string, { allowedValues?: JiraSelectOption[] }> }[] }[]
  }
  return data.projects?.[0]?.issuetypes?.[0]?.fields?.[fieldId]?.allowedValues ?? []
}

/**
 * A custom field's real Jira options — e.g. "🟡 Moderate" for a Severity select list —
 * fetched via createmeta for the given app/variant's configured issue type.
 * Powers the Settings mapping UI (our option value -> Jira option id), for any synced field.
 */
export async function getJiraFieldOptions(
  app: string,
  variant: 'epic' | 'story',
  fieldId: string,
  userId: number
): Promise<JiraSelectOption[]> {
  const config = await getConfig(userId)
  const issueType =
    variant === 'story'
      ? (await getSetting(app, 'jiraStoryBugIssueType')) ?? 'Dev Bug'
      : (await getSetting(app, 'jiraEpicBugIssueType')) ?? 'Bug'
  return getCreateFieldAllowedValues(config, config.projectKey, issueType, fieldId)
}

/**
 * Same idea as `getJiraFieldOptions`, but for a Change Request's own issue types
 * (sub-task under a story, story under an epic) instead of the bug issue types —
 * a CR filed under a story is a different Jira issue type than a bug filed under
 * a story, so the two can't share one lookup.
 */
export async function getCrJiraFieldOptions(
  app: string,
  parentType: CrParentType,
  fieldId: string,
  userId: number
): Promise<JiraSelectOption[]> {
  const config = await getConfig(userId)
  const crFormat = await getCrFormat(app)
  const vc = getCrVariantConfig(crFormat, parentType)
  const issueType = await crIssueTypeFor(app, parentType, vc)
  return getCreateFieldAllowedValues(config, config.projectKey, issueType, fieldId)
}

/**
 * Resolve one of our bug field values (e.g. severity "S3 – Moderate") to whatever
 * shape Jira's custom field actually needs. Preferred path: `valueMap`, configured
 * once in Settings by fetching the field's real options and mapping each of our
 * values to a Jira option id — exact by construction, works for any field/wording.
 * If unmapped (legacy config, or admin hasn't set it up yet), falls back to
 * matching the field's live allowed values by trailing keyword, ignoring
 * emoji/prefix differences (e.g. Jira's "🟡 Moderate" vs our "S3 – Moderate").
 * Falls back to sending the raw string if the field has no allowed-values list
 * (e.g. a plain text custom field) or the lookup fails.
 */
async function resolveJiraFieldValue(
  config: JiraConfig,
  fieldId: string,
  rawValue: string,
  valueMap: Record<string, string>,
  source: { jiraKey: string } | { projectKey: string; issueType: string }
): Promise<Record<string, unknown>> {
  const mappedId = valueMap[rawValue]
  if (mappedId) return { id: mappedId }

  let allowedValues: JiraSelectOption[] = []
  try {
    allowedValues =
      'jiraKey' in source
        ? await getEditFieldAllowedValues(config, source.jiraKey, fieldId)
        : await getCreateFieldAllowedValues(config, source.projectKey, source.issueType, fieldId)
  } catch {
    return { value: rawValue }
  }
  if (allowedValues.length === 0) return { value: rawValue }
  const match = matchOptionByKeyword(allowedValues, rawValue)
  return match ? { id: match.id } : { value: rawValue }
}

/** Build the `{fieldId: value}` entries for every enabled Jira field sync on this variant. */
async function buildSyncedFields(
  config: JiraConfig,
  vc: ReturnType<typeof getVariantConfig>,
  bug: BugDetail,
  source: { jiraKey: string } | { projectKey: string; issueType: string }
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  for (const { key, bugField } of JIRA_SYNC_FIELDS) {
    const sync = vc.jiraFieldSyncs[key]
    const rawValue = bug[bugField]
    if (!sync?.enabled || !sync.jiraFieldId || !rawValue) continue
    out[sync.jiraFieldId] = await resolveJiraFieldValue(config, sync.jiraFieldId, rawValue, sync.valueMap, source)
  }
  return out
}

function priorityToJira(priority: string): string {
  if (priority.includes('P1')) return 'Highest'
  if (priority.includes('P2')) return 'High'
  if (priority.includes('P3')) return 'Medium'
  if (priority.includes('P4')) return 'Low'
  return 'Medium'
}

function markdownToJiraWiki(markdown: string): string {
  return markdown
    .replace(/^### (.+)$/gm, 'h3. $1')
    .replace(/^## (.+)$/gm, 'h2. $1')
    .replace(/^# (.+)$/gm, 'h1. $1')
    // Horizontal rule before list bullets so a `---` line isn't mistaken for one.
    .replace(/^---+$/gm, '----')
    // Checklist items (`- [ ]` / `- [x]`) → Jira bullet keeping the marker visible.
    .replace(/^(\s*)[-*]\s+\[([ xX])\]\s+/gm, '$1* [$2] ')
    // Plain bullet list (`- ` / `* `) → Jira `* `.
    .replace(/^(\s*)[-*]\s+/gm, '$1* ')
    // Ordered list (`1.`) → Jira `# `.
    .replace(/^(\s*)\d+\.\s+/gm, '$1# ')
    // Bold before code so `**x**` isn't clipped; italic `_x_` is already Jira syntax.
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/`([^`]+)`/g, '{{$1}}')
}

/** Compose the CR Jira description body: the CR description (which already
 *  contains a Definition of Done section), divided from a styled metadata
 *  footer carrying Change Type and Priority, so all of it lands in the single
 *  Jira description field. Values are wrapped in `code` so they read as tokens. */
function composeCrDescription(cr: { description: string; changeType: string; priority: string }): string {
  const body = cr.description.replace(/\s+$/, '')
  return `${body}\n\n---\n\n**Change Type:** \`${cr.changeType}\`\n**Priority:** \`${cr.priority}\``
}

/**
 * Build the Jira description from the bug body, embedding attachment references
 * inline right after the summary and before the first divider (the one preceding
 * "Steps to Reproduce"). Images use Jira wiki `!filename!` syntax to render inline;
 * videos can't render inline, so they get a `[^filename]` attachment link instead.
 * Both resolve against the issue's attachments — so the files must also be uploaded.
 */
function buildJiraDescription(
  bugBody: string,
  imageFileNames: string[],
  videoFileNames: string[] = []
): string {
  const wiki = markdownToJiraWiki(bugBody)
  if (imageFileNames.length === 0 && videoFileNames.length === 0) return wiki

  const sections: string[] = []
  if (imageFileNames.length > 0) {
    sections.push(['*Screenshots:*', ...imageFileNames.map((f) => `!${f}!`)].join('\n'))
  }
  if (videoFileNames.length > 0) {
    sections.push(['*Video:*', ...videoFileNames.map((f) => `[^${f}]`)].join('\n'))
  }
  const block = sections.join('\n\n')

  // Insert just before the first horizontal-rule divider (---- after conversion),
  // i.e. after the summary and before "Steps to Reproduce".
  const lines = wiki.split('\n')
  const dividerIdx = lines.findIndex((l) => l.trim() === '----')
  if (dividerIdx === -1) {
    // No divider in the body — append the screenshots at the end.
    return `${wiki.replace(/\s+$/, '')}\n\n${block}`
  }
  const before = lines.slice(0, dividerIdx).join('\n').replace(/\s+$/, '')
  const after = lines.slice(dividerIdx).join('\n')
  return `${before}\n\n${block}\n\n${after}`
}

export async function updateJiraIssue(app: string, jiraKey: string, bug: BugDetail, imageFileNames: string[] = [], videoFileNames: string[] = [], userId: number): Promise<void> {
  const config = await getConfig(userId)
  const description = buildJiraDescription(bug.body, imageFileNames, videoFileNames)
  const fmt = await getBugFormat(app)
  const vc = getVariantConfig(fmt, bug.parent_key)
  const fields: Record<string, unknown> = {
    summary: jiraSummaryForBug(bug.layer, bug.title),
    description,
  }
  if (vc.fields.priority) {
    fields.priority = { name: priorityToJira(bug.priority) }
  }
  Object.assign(fields, await buildSyncedFields(config, vc, bug, { jiraKey }))
  if (bug.parent_key) {
    fields.parent = { key: bug.parent_key }
  }
  await jiraFetchOrThrow(config, `/rest/api/2/issue/${jiraKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
}

export async function createJiraIssue(app: string, bug: BugDetail, imageFileNames: string[] = [], videoFileNames: string[] = [], extraLabels: string[] = [], userId: number): Promise<string> {
  const config = await getConfig(userId)

  const description = buildJiraDescription(bug.body, imageFileNames, videoFileNames)

  const labels = ['BUG', ...new Set(extraLabels.filter((l) => l && l !== 'BUG'))]

  const isStoryBug = Boolean(bug.parent_key)
  const issueType = isStoryBug
    ? (await getSetting(app, 'jiraStoryBugIssueType')) ?? 'Dev Bug'
    : (await getSetting(app, 'jiraEpicBugIssueType')) ?? 'Bug'

  const fmt = await getBugFormat(app)
  const vc = getVariantConfig(fmt, bug.parent_key)

  const fields: Record<string, unknown> = {
    project: { key: config.projectKey },
    summary: jiraSummaryForBug(bug.layer, bug.title),
    description,
    issuetype: { name: issueType },
    labels,
  }

  if (vc.fields.priority) {
    fields.priority = { name: priorityToJira(bug.priority) }
  }
  Object.assign(fields, await buildSyncedFields(config, vc, bug, { projectKey: config.projectKey, issueType }))

  if (isStoryBug) {
    fields.parent = { key: bug.parent_key }
  }

  const payload = { fields }

  const response = await jiraFetchOrThrow(config, '/rest/api/2/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = (await response.json()) as { key: string }
  const issueKey = data.key

  await addIssueToBoardBestEffort(config, config.boardId, issueKey)

  return issueKey
}

/**
 * Add a freshly created issue to a board. Board placement is secondary to issue
 * creation, which already succeeded by the time this runs — warn rather than
 * throw so a board-add hiccup can't fail the whole operation.
 */
async function addIssueToBoardBestEffort(config: JiraConfig, boardId: string | null, issueKey: string): Promise<void> {
  if (!boardId) return
  const boardResponse = await jiraFetch(config, `/rest/agile/1.0/board/${boardId}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issues: [issueKey] }),
  })
  if (!boardResponse.ok) {
    const errorBody = await boardResponse.text().catch(() => '')
    console.warn(`[jira] Failed to add ${issueKey} to board ${boardId}: ${boardResponse.status} ${errorBody}`)
  }
}

// ─── Change requests ──────────────────────────────────────────────────────────

/**
 * Resolve the project/board a Change Request should be filed against for this
 * app, honoring the per-app Jira source config (Settings → Retest Board) the
 * same way `fetchStories` does for reads — a 'project' source overrides the
 * project key, a 'board' source overrides the board id, and 'global' (or a
 * source with a missing field) falls back to the shared instance config.
 */
async function resolveCrTarget(app: string, config: JiraConfig): Promise<{ projectKey: string; boardId: string | null }> {
  const source = await getJiraSourceConfig(app)
  if (source.mode === 'project' && source.projectKey) {
    return { projectKey: source.projectKey, boardId: config.boardId }
  }
  if (source.mode === 'board' && source.boardId) {
    return { projectKey: config.projectKey, boardId: source.boardId }
  }
  return { projectKey: config.projectKey, boardId: config.boardId }
}

/**
 * Build the `{fieldId: value}` entries for every enabled Jira field sync on a
 * CR variant. Same `resolveJiraFieldValue` machinery `buildSyncedFields` uses
 * for bugs, but a CR has a single dynamic value worth syncing to a custom
 * field (the change type), rather than one bug field per sync key.
 */
async function buildCrSyncedFields(
  config: JiraConfig,
  vc: CrVariant,
  changeType: string,
  source: { jiraKey: string } | { projectKey: string; issueType: string }
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  if (!changeType) return out
  for (const key of Object.keys(vc.jiraFieldSyncs) as JiraSyncFieldKey[]) {
    const sync = vc.jiraFieldSyncs[key]
    if (!sync?.enabled || !sync.jiraFieldId) continue
    out[sync.jiraFieldId] = await resolveJiraFieldValue(config, sync.jiraFieldId, changeType, sync.valueMap, source)
  }
  return out
}

/** Resolve the CR issue type for a parent-type variant: per-app CR_FORMAT override, else the shared setting. */
async function crIssueTypeFor(app: string, parentType: CrParentType, vc: CrVariant): Promise<string> {
  if (vc.issueType) return vc.issueType
  const settingKey = parentType === 'story' ? 'jiraCrSubtaskIssueType' : 'jiraCrStoryIssueType'
  const fallback = parentType === 'story' ? 'Sub-task' : 'Story'
  return (await getSetting(app, settingKey)) ?? fallback
}

/**
 * Jira Server/DC returns `description` as plain text (api/2). Cloud may return
 * an Atlassian Document Format object — flatten it to text defensively.
 */
function descriptionToText(desc: unknown): string {
  if (!desc) return ''
  if (typeof desc === 'string') return desc
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

/**
 * Create a Change Request in Jira under a parent story or epic. The parent's
 * `issuetype.hierarchyLevel` decides the shape: a story parent (level 0) gets
 * a sub-task CR, an epic parent (level 1) gets a story CR; any other level
 * (e.g. a sub-task, level -1) is rejected since a CR can't be filed under it.
 */
export async function createChangeRequest(
  app: string,
  cr: { parentKey: string; summary: string; description: string; changeType: string; priority: string },
  userId: number
): Promise<{ key: string; parentType: CrParentType }> {
  const config = await getConfig(userId)

  const parentResponse = await jiraFetchOrThrow(config, `/rest/api/2/issue/${encodeURIComponent(cr.parentKey)}?fields=issuetype`)
  const parentData = (await parentResponse.json()) as { fields?: { issuetype?: { hierarchyLevel?: number } } }
  const hierarchyLevel = parentData.fields?.issuetype?.hierarchyLevel

  let parentType: CrParentType
  if (hierarchyLevel === 0) parentType = 'story'
  else if (hierarchyLevel === 1) parentType = 'epic'
  else {
    throw new Error(
      `A Change Request can only be filed against a story or an epic. "${cr.parentKey}" is neither (hierarchy level: ${hierarchyLevel ?? 'unknown'}).`
    )
  }

  const crFormat = await getCrFormat(app)
  const vc = getCrVariantConfig(crFormat, parentType)
  const issueType = await crIssueTypeFor(app, parentType, vc)
  const target = await resolveCrTarget(app, config)

  const labels = [...new Set([crFormat.label, ...vc.jiraLabels].filter(Boolean))]

  const fields: Record<string, unknown> = {
    project: { key: target.projectKey },
    parent: { key: cr.parentKey },
    issuetype: { name: issueType },
    summary: crFormat.summaryPrefix + cr.summary,
    description: markdownToJiraWiki(composeCrDescription(cr)),
    labels,
  }

  if (vc.fields.priority) {
    fields.priority = { name: priorityToJira(cr.priority) }
  }
  Object.assign(fields, await buildCrSyncedFields(config, vc, cr.changeType, { projectKey: target.projectKey, issueType }))

  const response = await jiraFetchOrThrow(config, '/rest/api/2/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })

  const data = (await response.json()) as { key: string }
  await addIssueToBoardBestEffort(config, target.boardId, data.key)

  return { key: data.key, parentType }
}

/**
 * Update a Change Request already pushed to Jira. Editmeta-gated like a real
 * edit screen: a field is only included in the PUT body if Jira reports it as
 * editable on this issue, so a workflow that has locked a field (or an issue
 * type that never had it) can't produce a rejected update.
 */
export async function updateChangeRequest(
  app: string,
  cr: { crKey: string; summary: string; description: string; changeType: string; priority: string; parentType: CrParentType },
  userId: number
): Promise<void> {
  const config = await getConfig(userId)
  const crFormat = await getCrFormat(app)
  const vc = getCrVariantConfig(crFormat, cr.parentType)

  const editResponse = await jiraFetchOrThrow(config, `/rest/api/2/issue/${encodeURIComponent(cr.crKey)}/editmeta`)
  const editData = (await editResponse.json()) as { fields?: Record<string, unknown> }
  const editableFields = new Set(Object.keys(editData.fields ?? {}))

  const fields: Record<string, unknown> = {}

  if (editableFields.has('summary')) {
    fields.summary = cr.summary.startsWith(crFormat.summaryPrefix) ? cr.summary : crFormat.summaryPrefix + cr.summary
  }
  if (editableFields.has('description')) {
    fields.description = markdownToJiraWiki(composeCrDescription(cr))
  }
  if (vc.fields.priority && editableFields.has('priority')) {
    fields.priority = { name: priorityToJira(cr.priority) }
  }
  Object.assign(fields, await buildCrSyncedFields(config, vc, cr.changeType, { jiraKey: cr.crKey }))

  if (Object.keys(fields).length === 0) return

  await jiraFetchOrThrow(config, `/rest/api/2/issue/${encodeURIComponent(cr.crKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
}

/**
 * Pull a Change Request's Jira-authoritative fields for a two-way sync —
 * status, assignee, labels, summary, and description. The caller writes
 * these onto the local record and stamps `syncedAt`.
 */
export async function pullChangeRequest(
  app: string,
  crKey: string,
  userId: number
): Promise<{ summary: string; description: string; status: string | null; assignee: string | null; labels: string[] }> {
  void app // app-scoped config isn't needed to read a single already-resolved issue key
  const config = await getConfig(userId)
  const response = await jiraFetchOrThrow(config, `/rest/api/2/issue/${encodeURIComponent(crKey)}?fields=summary,description,status,assignee,labels`)
  const data = (await response.json()) as {
    fields?: {
      summary?: string
      description?: unknown
      status?: { name?: string }
      assignee?: { displayName?: string; accountId?: string; name?: string }
      labels?: string[]
    }
  }
  const f = data.fields ?? {}
  return {
    summary: f.summary ?? '',
    description: descriptionToText(f.description),
    status: f.status?.name ?? null,
    assignee: f.assignee?.displayName ?? f.assignee?.accountId ?? f.assignee?.name ?? null,
    labels: f.labels ?? [],
  }
}

export type TestingPhase = 'testcase_design' | 'testcase_execution' | 'retesting'

const TESTING_PHASE_SUMMARIES: Record<TestingPhase, string> = {
  testcase_design: 'QA: Testcase Design',
  testcase_execution: 'QA: Testcase Execution',
  retesting: 'QA: Retesting',
}

export async function getMyJiraAssignee(userId: number): Promise<Record<string, string> | null> {
  try {
    const config = await getConfig(userId)
    const response = await jiraFetch(config, '/rest/api/2/myself')
    if (!response.ok) return null
    const data = (await response.json()) as { accountId?: string; name?: string }
    if (data.accountId) return { accountId: data.accountId }
    if (data.name) return { name: data.name }
    return null
  } catch {
    return null
  }
}

export async function createTestingSubtask(
  app: string,
  parentKey: string,
  phase: TestingPhase,
  assignee: Record<string, string> | undefined,
  userId: number,
): Promise<string> {
  const config = await getConfig(userId)
  const subtaskType = (await getSetting(app, 'jiraSubtaskIssueType')) ?? 'Sub-task'

  const fields: Record<string, unknown> = {
    project: { key: config.projectKey },
    summary: TESTING_PHASE_SUMMARIES[phase],
    issuetype: { name: subtaskType },
    parent: { key: parentKey },
    labels: ['QA'],
    ...(assignee ? { assignee } : {}),
  }

  const response = await jiraFetchOrThrow(config, '/rest/api/2/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })

  const data = (await response.json()) as { key: string }
  return data.key
}

/**
 * Upload files as attachments to a Jira issue.
 * Uses multipart/form-data with the mandatory `X-Atlassian-Token: no-check` header.
 * The multipart field name must be `file` (Jira requirement).
 * @param skipExisting when true, first reads the issue's existing attachment
 *   filenames and uploads only files not already present (prevents duplicates on re-sync).
 * @returns the filenames that were uploaded.
 */
export async function uploadJiraAttachments(
  jiraKey: string,
  files: { fileName: string; mimeType: string; data: Buffer }[],
  opts: { skipExisting?: boolean; userId: number }
): Promise<string[]> {
  if (files.length === 0) return []
  const config = await getConfig(opts.userId)

  let toUpload = files
  if (opts.skipExisting) {
    const existing = new Set<string>()
    try {
      const res = await jiraFetch(config, `/rest/api/2/issue/${jiraKey}?fields=attachment`)
      if (res.ok) {
        const data = (await res.json()) as { fields?: { attachment?: { filename: string }[] } }
        for (const a of data.fields?.attachment ?? []) existing.add(a.filename)
      }
    } catch {
      // If we can't read existing attachments, fall back to uploading everything
    }
    toUpload = files.filter((f) => !existing.has(f.fileName))
  }

  const uploaded: string[] = []
  for (const file of toUpload) {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(file.data)], { type: file.mimeType }), file.fileName)
    await jiraFetchOrThrow(
      config,
      `/rest/api/2/issue/${jiraKey}/attachments`,
      {
        method: 'POST',
        headers: { 'X-Atlassian-Token': 'no-check' },
        // NB: do NOT set Content-Type — fetch sets the multipart boundary automatically
        body: form,
      },
      'Jira attachment upload responded'
    )
    uploaded.push(file.fileName)
  }
  return uploaded
}

export async function getJiraIssueUrl(jiraKey: string): Promise<string> {
  const baseUrl = ((await getSetting('global', 'JIRA_BASE_URL')) ?? '').replace(/\/$/, '')
  return `${baseUrl}/browse/${jiraKey}`
}

/** All distinct workflow status names configured for the project, across every issue type, first-seen order. */
export async function getProjectStatuses(userId: number): Promise<string[]> {
  const config = await getConfig(userId)
  const response = await jiraFetchOrThrow(config, `/rest/api/2/project/${config.projectKey}/statuses`)
  const data = (await response.json()) as { statuses: { name: string }[] }[]
  const seen = new Set<string>()
  const out: string[] = []
  for (const issueType of data) {
    for (const status of issueType.statuses ?? []) {
      if (!seen.has(status.name)) {
        seen.add(status.name)
        out.push(status.name)
      }
    }
  }
  return out
}

interface SearchedIssue {
  key: string
  fields: {
    status?: { name: string }
    reporter?: { accountId?: string; name?: string }
    parent?: { key: string }
  }
}

async function searchIssuesByKeys(config: JiraConfig, keys: string[]): Promise<SearchedIssue[]> {
  const jql = `key in (${keys.join(',')})`
  // /rest/api/2/search was removed by Atlassian (CHANGE-2046, HTTP 410) — /search/jql is its replacement
  const response = await jiraFetchOrThrow(config, '/rest/api/3/search/jql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql, fields: ['status', 'reporter', 'parent'], maxResults: 100 }),
  })
  const data = (await response.json()) as { issues: SearchedIssue[] }
  return data.issues ?? []
}

/** Reporter identifier: accountId on Jira Cloud, username on Server/DC. */
function reporterIdOf(issue: SearchedIssue): string | null {
  return issue.fields?.reporter?.accountId ?? issue.fields?.reporter?.name ?? null
}

export interface IssueSyncInfo {
  status: string
  reporter: string | null
  parentKey: string | null
}

/**
 * Fetch current statuses for a set of Jira keys, batched at 100 per JQL request
 * (Jira's practical `key in (...)` limit). If a batch fails — typically because
 * one or more keys no longer exist — falls back to querying that batch's keys
 * individually, skipping any that still fail, so one deleted issue can't
 * blank out an entire sync.
 */
export async function fetchIssueStatuses(jiraKeys: string[], userId: number): Promise<Map<string, IssueSyncInfo>> {
  const result = new Map<string, IssueSyncInfo>()
  if (jiraKeys.length === 0) return result
  const config = await getConfig(userId)
  const BATCH_SIZE = 100
  for (let i = 0; i < jiraKeys.length; i += BATCH_SIZE) {
    const batch = jiraKeys.slice(i, i + BATCH_SIZE)
    try {
      const issues = await searchIssuesByKeys(config, batch)
      for (const issue of issues) {
        if (issue.fields?.status?.name) result.set(issue.key, { status: issue.fields.status.name, reporter: reporterIdOf(issue), parentKey: issue.fields.parent?.key ?? null })
      }
    } catch {
      for (const key of batch) {
        try {
          const issues = await searchIssuesByKeys(config, [key])
          const issue = issues[0]
          if (issue?.fields?.status?.name) result.set(issue.key, { status: issue.fields.status.name, reporter: reporterIdOf(issue), parentKey: issue.fields.parent?.key ?? null })
        } catch {
          // Skip: issue deleted or inaccessible.
        }
      }
    }
  }
  return result
}

/**
 * Identifier of the Jira account resolved for this request (accountId on Cloud,
 * username on Server/DC), resolved against `userId`'s own Jira credentials.
 */
export async function getMyJiraIdentifier(userId: number): Promise<string | null> {
  const me = await getMyJiraAssignee(userId)
  return me?.accountId ?? me?.name ?? null
}

/** Available workflow transitions for an issue, with the status name each one leads to. */
export async function getIssueTransitions(
  jiraKey: string,
  userId: number
): Promise<{ id: string; name: string; toStatus: string }[]> {
  const config = await getConfig(userId)
  const response = await jiraFetchOrThrow(config, `/rest/api/2/issue/${jiraKey}/transitions`)
  const data = (await response.json()) as { transitions: { id: string; name: string; to?: { name: string } }[] }
  return (data.transitions ?? []).map((t) => ({ id: t.id, name: t.name, toStatus: t.to?.name ?? '' }))
}

/** Execute a workflow transition on an issue. Jira responds 204 on success. */
export async function transitionIssue(jiraKey: string, transitionId: string, userId: number): Promise<void> {
  const config = await getConfig(userId)
  await jiraFetchOrThrow(config, `/rest/api/2/issue/${jiraKey}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: { id: transitionId } }),
  })
}
