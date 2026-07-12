import { NextRequest, NextResponse } from 'next/server'
import { getBug, saveBug, changeBugFeature } from '@/lib/bugs'
import { getJiraIssueUrl } from '@/lib/jira'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; feature: string; slug: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { app, feature, slug } = await params
  const guard = await guardApp(app, 'bugs.view')
  if (!guard.ok) return guard.response
  const bug = await getBug(app, feature, slug)
  if (!bug) return NextResponse.json({ error: 'Bug not found' }, { status: 404 })
  const jira_url = bug.jira_key ? await getJiraIssueUrl(bug.jira_key) : null
  return NextResponse.json({ ...bug, jira_url })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { app, feature, slug } = await params
  const guard = await guardApp(app, 'bugs.edit')
  if (!guard.ok) return guard.response
  const { body, priority, bug_type, parent_key, severity, layer } = await req.json().catch(() => ({})) as {
    body: string
    priority?: string
    bug_type?: string
    parent_key?: string | null
    severity?: string
    layer?: string
  }
  await saveBug(app, feature, slug, body, { priority, bug_type, parent_key, severity, layer })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { app, feature, slug } = await params
  const guard = await guardApp(app, 'bugs.edit')
  if (!guard.ok) return guard.response
  const { feature: newFeature } = await req.json().catch(() => ({})) as { feature: string }
  if (!newFeature?.trim()) return NextResponse.json({ error: 'feature is required' }, { status: 400 })
  await changeBugFeature(app, feature, slug, newFeature.trim())
  return NextResponse.json({ feature: newFeature.trim(), slug })
}
