import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getJiraSourceConfig, saveJiraSourceConfig } from '@/lib/jira-source-server'
import { normalizeJiraSourceConfig } from '@/lib/jira-source'

export const runtime = 'nodejs'

/** GET /api/[app]/jira-source — per-app Jira story source config (global/board/project). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'knowledge.view')
  if (!guard.ok) return guard.response

  const config = await getJiraSourceConfig(app)
  return NextResponse.json({ config })
}

/** PUT /api/[app]/jira-source — save the per-app Jira source config. Body: { config }. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'settings.edit')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const config = normalizeJiraSourceConfig(body?.config)
  await saveJiraSourceConfig(app, config)
  return NextResponse.json({ config })
}
