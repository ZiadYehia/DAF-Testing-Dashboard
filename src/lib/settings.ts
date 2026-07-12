import { getDataSource } from './db'
import { SettingEntity, ISetting } from './entities'

export const GLOBAL_KEYS = [
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GROQ_API_KEY',
  'JIRA_BASE_URL',
  'JIRA_PROJECT_KEY',
  'JIRA_BOARD_ID',
  'JIRA_EMAIL',
  'JIRA_API_TOKEN',
  'JIRA_PAT',
  // Automation Hub — regression schedule + team notifications
  'AUTOMATION_WEBHOOK_URL',
  'AUTOMATION_SCHEDULE_ENABLED',
  'AUTOMATION_SCHEDULE_TIME',
  'AUTOMATION_SCHEDULE_TAG',
  'AUTOMATION_SCHEDULE_LAST_RUN',
] as const

export const APP_DEFAULT_KEYS = [
  'testerName',
  'testcaseEnvironment',
  'bugEnvironment',
  // Jira issue-type names — vary per Jira project, so they are per-app settings
  'jiraSubtaskIssueType',
  'jiraStoryBugIssueType',
  'jiraEpicBugIssueType',
] as const

export const APP_DEFAULTS: Record<string, string> = {
  testerName: 'QA Tester',
  testcaseEnvironment: 'Browser: <browser + version> | OS: <OS> | Role: <role>',
  bugEnvironment: 'Browser: <browser + version> | OS: <OS>',
  jiraSubtaskIssueType: 'Sub-task',
  jiraStoryBugIssueType: 'Dev Bug',
  jiraEpicBugIssueType: 'Bug',
}

/** Setting keys whose values are secrets (API keys/tokens/PATs/passwords) and must be masked in API responses.
 * _API_KEY (not bare _KEY) so non-secrets like JIRA_PROJECT_KEY stay visible. */
const SECRET_KEY_RE = /(_API_KEY|_TOKEN|_PAT|_SECRET|PASSWORD)$/
const CUSTOM_PROVIDER_KEY_PREFIX = 'AI_PROVIDER_KEY_'

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_RE.test(key) || key.startsWith(CUSTOM_PROVIDER_KEY_PREFIX)
}

/** Prefix used for masked secret values returned to clients — never a valid raw value. */
export const MASK_PREFIX = '••••'

/** Masks a secret value for display: •••• + last 4 chars (or just •••• if too short or empty). */
export function maskSecretValue(value: string): string {
  if (!value) return ''
  return value.length > 8 ? `${MASK_PREFIX}${value.slice(-4)}` : MASK_PREFIX
}

export async function getSetting(scope: string, key: string): Promise<string | null> {
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(SettingEntity)
    const row = await repo.findOne({ where: { scope, key } })
    if (row !== null && row.value !== '') return row.value
    if (scope === 'global' && process.env[key]) return process.env[key]!
    if (key in APP_DEFAULTS) return APP_DEFAULTS[key]
    return null
  } catch {
    return process.env[key] ?? APP_DEFAULTS[key] ?? null
  }
}

export async function setSetting(scope: string, key: string, value: string): Promise<void> {
  const ds = await getDataSource()
  const repo = ds.getRepository(SettingEntity)
  const existing = await repo.findOne({ where: { scope, key } })
  if (existing) {
    existing.value = value
    existing.updatedAt = new Date()
    await repo.save(existing)
  } else {
    await repo.save({ scope, key, value, updatedAt: new Date() } as ISetting)
  }
}

/**
 * Returns all settings for a scope.
 * Baseline is env vars (for global) or hardcoded defaults (for app scopes).
 * DB rows overlay the baseline — so env.local values always appear even before
 * the table exists, and saved UI values override them once the table is created.
 */
export async function getSettingsForScope(scope: string): Promise<Record<string, string>> {
  // Build the baseline from env / hardcoded defaults
  const result: Record<string, string> = {}
  if (scope === 'global') {
    for (const key of GLOBAL_KEYS) {
      result[key] = process.env[key] ?? ''
    }
  } else {
    for (const key of APP_DEFAULT_KEYS) {
      result[key] = APP_DEFAULTS[key] ?? ''
    }
  }

  // Overlay with DB values (best-effort — table may not exist yet)
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(SettingEntity)
    const rows = await repo.find({ where: { scope } })
    for (const row of rows) {
      result[row.key] = row.value
    }
  } catch {
    // DB unavailable or table not yet created — baseline values are used
  }

  return result
}

/** Seed DB rows from env vars / defaults for any key that doesn't have a row yet. Best-effort. */
export async function seedGlobalSettings(): Promise<void> {
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(SettingEntity)
    for (const key of GLOBAL_KEYS) {
      const existing = await repo.findOne({ where: { scope: 'global', key } })
      if (!existing) {
        await repo.save({
          scope: 'global',
          key,
          value: process.env[key] ?? '',
          updatedAt: new Date(),
        } as ISetting)
      }
    }
  } catch {
    // Table not yet created — seeding deferred until DB_SYNC creates it
  }
}

export async function seedAppSettings(appSlug: string): Promise<void> {
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(SettingEntity)
    for (const key of APP_DEFAULT_KEYS) {
      const existing = await repo.findOne({ where: { scope: appSlug, key } })
      if (!existing) {
        await repo.save({
          scope: appSlug,
          key,
          value: APP_DEFAULTS[key] ?? '',
          updatedAt: new Date(),
        } as ISetting)
      }
    }
  } catch {
    // Table not yet created — seeding deferred
  }
}
