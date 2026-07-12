import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getMyJiraIdentifier } from '@/lib/jira'

export const runtime = 'nodejs'

/**
 * GET /api/[app]/board/me — identifier of the Jira account configured in
 * Settings (accountId on Cloud, username on Server/DC). Drives the board's
 * "Reported by me" filter. Null when Jira is unconfigured or unreachable.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.view')
  if (!guard.ok) return guard.response

  const identifier = await getMyJiraIdentifier()
  return NextResponse.json({ identifier })
}
