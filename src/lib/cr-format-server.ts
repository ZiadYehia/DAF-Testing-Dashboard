/**
 * Server-side persistence for the per-app change-request (CR) format config.
 * Persisted as a `settings` row (no schema change): <app> CR_FORMAT : CrFormatConfig.
 * Kept separate from `cr-format.ts` so typeorm never enters client bundles.
 */
import { getSetting, setSetting } from './settings'
import { DEFAULT_JIRA_FIELD_SYNC, JIRA_SYNC_FIELDS, type JiraFieldSyncConfig } from './bug-format'
import {
  DEFAULT_CR_FORMAT,
  DEFAULT_CR_VARIANT,
  DEFAULT_CHANGE_TYPES,
  type CrFormatConfig,
  type CrVariant,
} from './cr-format'

function normalizeFieldSync(v: any): JiraFieldSyncConfig {
  const src = v ?? {}
  return {
    enabled: !!src.enabled,
    jiraFieldId: typeof src.jiraFieldId === 'string' ? src.jiraFieldId : DEFAULT_JIRA_FIELD_SYNC.jiraFieldId,
    valueMap: src.valueMap && typeof src.valueMap === 'object' ? src.valueMap : DEFAULT_JIRA_FIELD_SYNC.valueMap,
  }
}

function normalizeFieldSyncs(v: any): CrVariant['jiraFieldSyncs'] {
  const src = v ?? {}
  const out: CrVariant['jiraFieldSyncs'] = {}
  for (const { key } of JIRA_SYNC_FIELDS) {
    if (src[key]) out[key] = normalizeFieldSync(src[key])
  }
  return out
}

function normalizeVariant(v: any): CrVariant {
  const src = v ?? {}
  const fields = src.fields ?? {}
  return {
    issueType: typeof src.issueType === 'string' ? src.issueType : DEFAULT_CR_VARIANT.issueType,
    fields: {
      changeType: fields.changeType ?? DEFAULT_CR_VARIANT.fields.changeType,
      priority: fields.priority ?? DEFAULT_CR_VARIANT.fields.priority,
    },
    jiraLabels: Array.isArray(src.jiraLabels) ? src.jiraLabels : DEFAULT_CR_VARIANT.jiraLabels,
    jiraFieldSyncs: normalizeFieldSyncs(src.jiraFieldSyncs),
  }
}

function normalizeOptions(v: any, defaults: string[]): string[] {
  if (!Array.isArray(v)) return defaults
  const out = v.map(String).map((s) => s.trim()).filter(Boolean)
  return out.length > 0 ? out : defaults
}

export async function getCrFormat(app: string): Promise<CrFormatConfig> {
  const raw = await getSetting(app, 'CR_FORMAT').catch(() => null)
  if (!raw) return DEFAULT_CR_FORMAT
  try {
    const p = JSON.parse(raw)
    return {
      summaryPrefix: typeof p.summaryPrefix === 'string' ? p.summaryPrefix : DEFAULT_CR_FORMAT.summaryPrefix,
      label: typeof p.label === 'string' ? p.label : DEFAULT_CR_FORMAT.label,
      changeTypes: normalizeOptions(p.changeTypes, DEFAULT_CHANGE_TYPES),
      story: normalizeVariant(p.story),
      epic: normalizeVariant(p.epic),
    }
  } catch {
    return DEFAULT_CR_FORMAT
  }
}

export async function saveCrFormat(app: string, cfg: CrFormatConfig): Promise<void> {
  await setSetting(app, 'CR_FORMAT', JSON.stringify(cfg))
}
