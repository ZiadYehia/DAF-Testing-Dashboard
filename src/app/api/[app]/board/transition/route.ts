import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getBug, saveBug } from '@/lib/bugs'
import { getIssueTransitions, transitionIssue, getJiraIssueUrl } from '@/lib/jira'

export const runtime = 'nodejs'

/** POST /api/[app]/board/transition — move a bug's Jira issue through a workflow transition. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.edit')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({})) as {
    feature?: string
    slug?: string
    transitionId?: string
  }
  const { feature, slug, transitionId } = body
  if (!feature || !slug || !transitionId) {
    return NextResponse.json({ error: 'feature, slug, and transitionId are required' }, { status: 400 })
  }

  const bug = await getBug(app, feature, slug)
  if (!bug || !bug.jira_key) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const transitions = await getIssueTransitions(bug.jira_key, guard.access.user.id)
    const target = transitions.find((t) => t.id === transitionId)
    if (!target) {
      return NextResponse.json({ error: 'transitionId is not available for this issue' }, { status: 400 })
    }
    await transitionIssue(bug.jira_key, transitionId, guard.access.user.id)
    await saveBug(app, feature, slug, bug.body, { jira_status: target.toStatus })
    const updated = await getBug(app, feature, slug)
    const { body: _omit, ...summary } = updated ?? { ...bug, jira_status: target.toStatus }
    return NextResponse.json({ bug: { ...summary, jira_url: await getJiraIssueUrl(bug.jira_key) } })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Jira request failed' }, { status: 502 })
  }
}
