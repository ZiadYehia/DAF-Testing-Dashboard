import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getBoardConfig, saveBoardConfig } from '@/lib/board-config-server'
import { normalizeBoardConfig } from '@/lib/board-config'

export const runtime = 'nodejs'

/** GET /api/[app]/board-config — per-app retest board config (columns, retest status). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.view')
  if (!guard.ok) return guard.response

  const config = await getBoardConfig(app)
  return NextResponse.json({ config })
}

/** PUT /api/[app]/board-config — save the per-app retest board config. Body: { config }. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'settings.edit')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const config = normalizeBoardConfig(body?.config)
  await saveBoardConfig(app, config)
  return NextResponse.json({ config })
}
