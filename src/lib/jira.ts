import type { BugDetail } from './bugs'
import { getSetting } from './settings'
import { getBugFormat } from './bug-format-server'
import { getVariantConfig, jiraSummaryForBug, JIRA_SYNC_FIELDS } from './bug-format'

interface JiraConfig {
  baseUrl: string
  projectKey: string
  boardId: string | null
  /** Authorization header value — Bearer PAT (Server/DC) or Basic email:token (Cloud) */
  authHeader: string
}

/**
 * Build Jira config + auth header.
 * - Jira Server / Data Center: set JIRA_PAT (Personal Access Token) → Bearer auth.
 * - Jira Cloud: set JIRA_EMAIL + JIRA_API_TOKEN → Basic auth.
 */
export async function getConfig(): Promise<JiraConfig> {
  const [baseUrl, email, apiToken, pat, projectKey, boardId] = await Promise.all([
    getSetting('global', 'JIRA_BASE_URL'),
    getSetting('global', 'JIRA_EMAIL'),
    getSetting('global', 'JIRA_API_TOKEN'),
    getSetting('global', 'JIRA_PAT'),
    getSetting('global', 'JIRA_PROJECT_KEY'),
    getSetting('global', 'JIRA_BOARD_ID'),
  ])

  if (!baseUrl || !projectKey) {
    throw new Error(
      'Jira is not configured. Add JIRA_BASE_URL and JIRA_PROJECT_KEY in Settings or .env.local'
    )
  }

  let authHeader: string
  if (pat) {
    authHeader = `Bearer ${pat}`
  } else if (email && apiToken) {
    authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
  } else {
    throw new Error(
      'Jira auth is not configured. Add JIRA_PAT (Server/DC) or JIRA_EMAIL + JIRA_API_TOKEN (Cloud) in Settings or .env.local'
    )
  }

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
  fieldId: string
): Promise<JiraSelectOption[]> {
  const config = await getConfig()
  const issueType =
    variant === 'story'
      ? (await getSetting(app, 'jiraStoryBugIssueType')) ?? 'Dev Bug'
      : (await getSetting(app, 'jiraEpicBugIssueType')) ?? 'Bug'
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
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/`([^`]+)`/g, '{{$1}}')
    .replace(/^---+$/gm, '----')
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

export async function updateJiraIssue(app: string, jiraKey: string, bug: BugDetail, imageFileNames: string[] = [], videoFileNames: string[] = []): Promise<void> {
  const config = await getConfig()
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

export async function createJiraIssue(app: string, bug: BugDetail, imageFileNames: string[] = [], videoFileNames: string[] = [], extraLabels: string[] = []): Promise<string> {
  const config = await getConfig()

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

  if (config.boardId) {
    // Board placement is secondary to issue creation, which already succeeded —
    // warn rather than throw so a board-add hiccup can't fail the whole operation.
    const boardResponse = await jiraFetch(config, `/rest/agile/1.0/board/${config.boardId}/issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues: [issueKey] }),
    })
    if (!boardResponse.ok) {
      const errorBody = await boardResponse.text().catch(() => '')
      console.warn(`[jira] Failed to add ${issueKey} to board ${config.boardId}: ${boardResponse.status} ${errorBody}`)
    }
  }

  return issueKey
}

export type TestingPhase = 'testcase_design' | 'testcase_execution' | 'retesting'

const TESTING_PHASE_SUMMARIES: Record<TestingPhase, string> = {
  testcase_design: 'QA: Testcase Design',
  testcase_execution: 'QA: Testcase Execution',
  retesting: 'QA: Retesting',
}

export async function getMyJiraAssignee(): Promise<Record<string, string> | null> {
  try {
    const config = await getConfig()
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
  assignee?: Record<string, string>,
): Promise<string> {
  const config = await getConfig()
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
  opts: { skipExisting?: boolean } = {}
): Promise<string[]> {
  if (files.length === 0) return []
  const config = await getConfig()

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
export async function getProjectStatuses(): Promise<string[]> {
  const config = await getConfig()
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
export async function fetchIssueStatuses(jiraKeys: string[]): Promise<Map<string, IssueSyncInfo>> {
  const result = new Map<string, IssueSyncInfo>()
  if (jiraKeys.length === 0) return result
  const config = await getConfig()
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

/** Identifier of the Jira account configured in Settings (accountId on Cloud, username on Server/DC). */
export async function getMyJiraIdentifier(): Promise<string | null> {
  const me = await getMyJiraAssignee()
  return me?.accountId ?? me?.name ?? null
}

/** Available workflow transitions for an issue, with the status name each one leads to. */
export async function getIssueTransitions(
  jiraKey: string
): Promise<{ id: string; name: string; toStatus: string }[]> {
  const config = await getConfig()
  const response = await jiraFetchOrThrow(config, `/rest/api/2/issue/${jiraKey}/transitions`)
  const data = (await response.json()) as { transitions: { id: string; name: string; to?: { name: string } }[] }
  return (data.transitions ?? []).map((t) => ({ id: t.id, name: t.name, toStatus: t.to?.name ?? '' }))
}

/** Execute a workflow transition on an issue. Jira responds 204 on success. */
export async function transitionIssue(jiraKey: string, transitionId: string): Promise<void> {
  const config = await getConfig()
  await jiraFetchOrThrow(config, `/rest/api/2/issue/${jiraKey}/transitions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transition: { id: transitionId } }),
  })
}
