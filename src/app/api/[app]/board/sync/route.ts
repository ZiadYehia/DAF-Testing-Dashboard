import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { listBugs } from '@/lib/bugs'
import { getSetting } from '@/lib/settings'
import { syncJiraStatuses } from '@/lib/jira-status'

export const runtime = 'nodejs'

/** POST /api/[app]/board/sync — refresh cached Jira statuses, then return the bug list. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.view')
  if (!guard.ok) return guard.response

  try {
    await syncJiraStatuses(app)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Jira sync failed' }, { status: 502 })
  }

  const moduleParam = req.nextUrl.searchParams.get('module')
  const module = moduleParam ?? null
  const bugs = await listBugs(app, module)
  // Read the Jira base URL once instead of once per bug (was an N+1 DB lookup via
  // getJiraIssueUrl inside the loop). Same URL shape as jira.ts's getJiraIssueUrl.
  const jiraBaseUrl = ((await getSetting('global', 'JIRA_BASE_URL')) ?? '').replace(/\/$/, '')
  const bugsWithUrls = bugs.map((b) => ({
    ...b,
    jira_url: b.jira_key ? `${jiraBaseUrl}/browse/${b.jira_key}` : null,
  }))
  return NextResponse.json(bugsWithUrls)
}
