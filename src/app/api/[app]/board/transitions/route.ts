import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getIssueTransitions } from '@/lib/jira'

export const runtime = 'nodejs'

/** GET /api/[app]/board/transitions?key=X — available Jira workflow transitions for an issue. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.view')
  if (!guard.ok) return guard.response

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

  try {
    const transitions = await getIssueTransitions(key, guard.access.user.id)
    return NextResponse.json({ transitions })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Jira request failed' }, { status: 502 })
  }
}
