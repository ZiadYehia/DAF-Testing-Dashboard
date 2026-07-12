/**
 * Server-side persistence for the per-app bug format config. Persisted as a
 * `settings` row (no schema change): <app> BUG_FORMAT : BugFormatConfig.
 * Kept separate from `bug-format.ts` so typeorm never enters client bundles.
 */
import { getSetting, setSetting } from './settings'
import {
  DEFAULT_BUG_FORMAT,
  DEFAULT_BUG_VARIANT,
  DEFAULT_JIRA_FIELD_SYNC,
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_SEVERITY_OPTIONS,
  JIRA_SYNC_FIELDS,
  type BugFormatConfig,
  type BugVariantConfig,
  type JiraFieldSyncConfig,
} from './bug-format'

function normalizeFieldSync(v: any): JiraFieldSyncConfig {
  const src = v ?? {}
  return {
    enabled: !!src.enabled,
    jiraFieldId: typeof src.jiraFieldId === 'string' ? src.jiraFieldId : DEFAULT_JIRA_FIELD_SYNC.jiraFieldId,
    valueMap: src.valueMap && typeof src.valueMap === 'object' ? src.valueMap : DEFAULT_JIRA_FIELD_SYNC.valueMap,
  }
}

function normalizeFieldSyncs(v: any, legacy: any): BugVariantConfig['jiraFieldSyncs'] {
  const src = v ?? {}
  const out: BugVariantConfig['jiraFieldSyncs'] = {}
  for (const { key } of JIRA_SYNC_FIELDS) {
    if (src[key]) out[key] = normalizeFieldSync(src[key])
  }
  // Migrate the old severity-only shape (sendSeverityToJira/jiraSeverityFieldId/jiraSeverityValueMap
  // at the variant's top level) into jiraFieldSyncs.severity, so already-configured apps (e.g. an existing app's
  // customfield_10415) keep working after this generalization.
  if (!out.severity && (legacy?.sendSeverityToJira || legacy?.jiraSeverityFieldId)) {
    out.severity = {
      enabled: !!legacy.sendSeverityToJira,
      jiraFieldId: typeof legacy.jiraSeverityFieldId === 'string' ? legacy.jiraSeverityFieldId : '',
      valueMap:
        legacy.jiraSeverityValueMap && typeof legacy.jiraSeverityValueMap === 'object' ? legacy.jiraSeverityValueMap : {},
    }
  }
  return out
}

function normalizeVariant(v: any): BugVariantConfig {
  const src = v ?? {}
  const fields = src.fields ?? {}
  return {
    fields: {
      environment: fields.environment ?? DEFAULT_BUG_VARIANT.fields.environment,
      priority: fields.priority ?? DEFAULT_BUG_VARIANT.fields.priority,
      bugType: fields.bugType ?? DEFAULT_BUG_VARIANT.fields.bugType,
      severity: fields.severity ?? DEFAULT_BUG_VARIANT.fields.severity,
    },
    jiraLabels: Array.isArray(src.jiraLabels) ? src.jiraLabels : DEFAULT_BUG_VARIANT.jiraLabels,
    jiraFieldSyncs: normalizeFieldSyncs(src.jiraFieldSyncs, src),
  }
}

function normalizeOptions(v: any, defaults: string[]): string[] {
  if (!Array.isArray(v)) return defaults
  const out = v.map(String).map((s) => s.trim()).filter(Boolean)
  return out.length > 0 ? out : defaults
}

export async function getBugFormat(app: string): Promise<BugFormatConfig> {
  const raw = await getSetting(app, 'BUG_FORMAT').catch(() => null)
  if (!raw) return DEFAULT_BUG_FORMAT
  try {
    const p = JSON.parse(raw)
    // Migrate the old flat shape ({fields, jiraLabels, ...} at top level, no
    // epic/story keys): apply the saved settings to BOTH variants.
    const isFlat = !p.epic && !p.story && (p.fields || p.jiraLabels)
    const epicSrc = isFlat ? p : p.epic
    const storySrc = isFlat ? p : p.story
    return {
      epic: normalizeVariant(epicSrc),
      story: normalizeVariant(storySrc),
      priorityOptions: normalizeOptions(p.priorityOptions, DEFAULT_PRIORITY_OPTIONS),
      severityOptions: normalizeOptions(p.severityOptions, DEFAULT_SEVERITY_OPTIONS),
    }
  } catch {
    return DEFAULT_BUG_FORMAT
  }
}

export async function saveBugFormat(app: string, cfg: BugFormatConfig): Promise<void> {
  await setSetting(app, 'BUG_FORMAT', JSON.stringify(cfg))
}
