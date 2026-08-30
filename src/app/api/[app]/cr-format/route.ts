import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getCrFormat, saveCrFormat } from '@/lib/cr-format-server'
import { JIRA_SYNC_FIELDS, type JiraFieldSyncConfig } from '@/lib/bug-format'
import {
  DEFAULT_CR_VARIANT,
  DEFAULT_CHANGE_TYPES,
  type CrFormatConfig,
  type CrVariant,
} from '@/lib/cr-format'

export const runtime = 'nodejs'

/** GET /api/[app]/cr-format — per-app change-request format config (story/epic variants, change-type list). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'changerequests.view')
  if (!guard.ok) return guard.response

  const config = await getCrFormat(app)
  return NextResponse.json({ config })
}

function sanitizeLabels(raw: unknown): string[] {
  const input: unknown[] = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const l of input) {
    const trimmed = String(l).trim()
    if (!trimmed) continue
    if (/\s/.test(trimmed)) continue // Jira labels cannot contain spaces
    if (trimmed.toUpperCase() === 'CR') continue // base label is implicit
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

function sanitizeValueMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || !key.trim()) continue
    if (typeof value !== 'string' || !value.trim()) continue
    out[key] = value.trim()
  }
  return out
}

function sanitizeFieldSync(raw: unknown): JiraFieldSyncConfig {
  const src = (raw ?? {}) as any
  return {
    enabled: !!src.enabled,
    jiraFieldId: typeof src.jiraFieldId === 'string' ? src.jiraFieldId.trim() : '',
    valueMap: sanitizeValueMap(src.valueMap),
  }
}

function sanitizeFieldSyncs(raw: unknown): CrVariant['jiraFieldSyncs'] {
  const src = (raw ?? {}) as Record<string, unknown>
  const out: CrVariant['jiraFieldSyncs'] = {}
  for (const { key } of JIRA_SYNC_FIELDS) {
    if (src[key]) out[key] = sanitizeFieldSync(src[key])
  }
  return out
}

function sanitizeVariant(input: any): CrVariant {
  const src = input ?? {}
  const fields = src.fields ?? {}
  return {
    issueType: typeof src.issueType === 'string' ? src.issueType.trim() : DEFAULT_CR_VARIANT.issueType,
    fields: {
      changeType: fields.changeType ?? DEFAULT_CR_VARIANT.fields.changeType,
      priority: fields.priority ?? DEFAULT_CR_VARIANT.fields.priority,
    },
    jiraLabels: sanitizeLabels(src.jiraLabels),
    jiraFieldSyncs: sanitizeFieldSyncs(src.jiraFieldSyncs),
  }
}

function sanitizeOptions(raw: unknown, defaults: string[]): string[] {
  const input: unknown[] = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const o of input) {
    const trimmed = String(o).trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out.length > 0 ? out : defaults
}

/** PUT /api/[app]/cr-format — save the per-app change-request format config. Body: { config }. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'settings.edit')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const input = (body?.config ?? {}) as Record<string, any>

  const out: CrFormatConfig = {
    summaryPrefix: typeof input.summaryPrefix === 'string' && input.summaryPrefix.length > 0 ? input.summaryPrefix : 'CR: ',
    label: typeof input.label === 'string' && input.label.trim() ? input.label.trim() : 'CR',
    changeTypes: sanitizeOptions(input.changeTypes, DEFAULT_CHANGE_TYPES),
    story: sanitizeVariant(input.story),
    epic: sanitizeVariant(input.epic),
  }
  await saveCrFormat(app, out)
  return NextResponse.json({ ok: true })
}
