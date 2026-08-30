/**
 * Per-app configurable Jira story source — client-safe constants only.
 * Must NOT import settings/db/fs/typeorm: this module is imported by client
 * components (settings UI) and would otherwise pull the DB layer into the
 * browser bundle. See `jira-source-server.ts` for the persisted config.
 */

export type JiraSourceMode = 'global' | 'board' | 'project'

export interface JiraSourceConfig {
  mode: JiraSourceMode
  boardId: string | null
  projectKey: string | null
}

export const DEFAULT_JIRA_SOURCE: JiraSourceConfig = {
  mode: 'global',
  boardId: null,
  projectKey: null,
}

/** Coerce an unknown parsed JSON value into a valid JiraSourceConfig. */
export function normalizeJiraSourceConfig(raw: unknown): JiraSourceConfig {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_JIRA_SOURCE
  const obj = raw as Partial<JiraSourceConfig>
  const mode: JiraSourceMode = obj.mode === 'board' || obj.mode === 'project' ? obj.mode : 'global'

  const boardId = typeof obj.boardId === 'string' ? obj.boardId.trim() : ''
  const projectKey = typeof obj.projectKey === 'string' ? obj.projectKey.trim() : ''

  if (mode === 'board' && !boardId) return DEFAULT_JIRA_SOURCE
  if (mode === 'project' && !projectKey) return DEFAULT_JIRA_SOURCE

  return {
    mode,
    boardId: mode === 'board' ? boardId : null,
    projectKey: mode === 'project' ? projectKey : null,
  }
}
