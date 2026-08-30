/**
 * Server-side persistence for the per-app Jira source config. Persisted as a
 * `settings` row (no schema change): <app> JIRA_SOURCE : JiraSourceConfig.
 * Kept separate from `jira-source.ts` so typeorm never enters client bundles.
 */
import { getSetting, setSetting } from './settings'
import { DEFAULT_JIRA_SOURCE, normalizeJiraSourceConfig, type JiraSourceConfig } from './jira-source'

export async function getJiraSourceConfig(app: string): Promise<JiraSourceConfig> {
  const raw = await getSetting(app, 'JIRA_SOURCE').catch(() => null)
  if (!raw) return DEFAULT_JIRA_SOURCE
  try {
    return normalizeJiraSourceConfig(JSON.parse(raw))
  } catch {
    return DEFAULT_JIRA_SOURCE
  }
}

export async function saveJiraSourceConfig(app: string, cfg: JiraSourceConfig): Promise<void> {
  await setSetting(app, 'JIRA_SOURCE', JSON.stringify(cfg))
}
