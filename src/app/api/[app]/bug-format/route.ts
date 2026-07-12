import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getBugFormat, saveBugFormat } from '@/lib/bug-format-server'
import {
  DEFAULT_BUG_VARIANT,
  DEFAULT_PRIORITY_OPTIONS,
  DEFAULT_SEVERITY_OPTIONS,
  JIRA_SYNC_FIELDS,
  type BugFormatConfig,
  type BugVariantConfig,
  type JiraFieldSyncConfig,
} from '@/lib/bug-format'

export const runtime = 'nodejs'

/** GET /api/[app]/bug-format — per-app bug format config (epic/story variants, option lists). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.view')
  if (!guard.ok) return guard.response

  const config = await getBugFormat(app)
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
    if (trimmed.toUpperCase() === 'BUG') continue // base label is implicit
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

function sanitizeFieldSyncs(raw: unknown): BugVariantConfig['jiraFieldSyncs'] {
  const src = (raw ?? {}) as Record<string, unknown>
  const out: BugVariantConfig['jiraFieldSyncs'] = {}
  for (const { key } of JIRA_SYNC_FIELDS) {
    if (src[key]) out[key] = sanitizeFieldSync(src[key])
  }
  return out
}

function sanitizeVariant(input: any): BugVariantConfig {
  const src = input ?? {}
  const fields = src.fields ?? {}
  return {
    fields: {
      environment: fields.environment ?? DEFAULT_BUG_VARIANT.fields.environment,
      priority: fields.priority ?? DEFAULT_BUG_VARIANT.fields.priority,
      bugType: fields.bugType ?? DEFAULT_BUG_VARIANT.fields.bugType,
      severity: fields.severity ?? DEFAULT_BUG_VARIANT.fields.severity,
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

/** PUT /api/[app]/bug-format — save the per-app bug format config. Body: { config }. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'settings.edit')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const input = (body?.config ?? {}) as Record<string, any>

  const out: BugFormatConfig = {
    epic: sanitizeVariant(input.epic),
    story: sanitizeVariant(input.story),
    priorityOptions: sanitizeOptions(input.priorityOptions, DEFAULT_PRIORITY_OPTIONS),
    severityOptions: sanitizeOptions(input.severityOptions, DEFAULT_SEVERITY_OPTIONS),
  }
  await saveBugFormat(app, out)
  return NextResponse.json({ ok: true })
}
