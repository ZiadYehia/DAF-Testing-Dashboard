import { NextRequest, NextResponse } from 'next/server'
import { listBugs, createBug } from '@/lib/bugs'
import { getSetting } from '@/lib/settings'
import { guardApp } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.view')
  if (!guard.ok) return guard.response
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.create')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({})) as {
    feature: string
    title: string
    priority: string
    bug_type: string
    body: string
    severity?: string
    layer?: string
    parent_key?: string | null
    module?: string | null
  }

  if (!body.feature || !body.title || !body.body) {
    return NextResponse.json({ error: 'feature, title, and body are required' }, { status: 400 })
  }

  const slug = await createBug(app, {
    feature: body.feature,
    title: body.title,
    body: body.body,
    priority: body.priority ?? '',
    bug_type: body.bug_type ?? '',
    severity: body.severity,
    layer: body.layer,
    parent_key: body.parent_key,
    module: body.module ?? null,
  })
  return NextResponse.json({ feature: body.feature, slug }, { status: 201 })
}
