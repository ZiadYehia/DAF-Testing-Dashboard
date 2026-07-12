import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getProjectStatuses } from '@/lib/jira'

export const runtime = 'nodejs'

/** GET /api/[app]/board/statuses — the Jira project's distinct workflow status names. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.view')
  if (!guard.ok) return guard.response

  try {
    const statuses = await getProjectStatuses()
    return NextResponse.json({ statuses })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Jira request failed' }, { status: 502 })
  }
}
