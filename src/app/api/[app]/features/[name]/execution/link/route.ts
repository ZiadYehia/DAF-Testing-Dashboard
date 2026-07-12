import { NextRequest, NextResponse } from 'next/server'
import { setExecutionBug } from '@/lib/execution'
import { getBug } from '@/lib/bugs'
import { getJiraIssueUrl } from '@/lib/jira'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

// Records the test case → bug link raised from the execution tab (one bug per
// case, latest wins). The bug itself is created via the existing bugs API; this
// only stores the pointer used by the execution view and the export.
export async function POST(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'testcases.execute')
  if (!guard.ok) return guard.response

  const { testcaseId, bugSlug, version } = (await req.json()) as { testcaseId: string; bugSlug: string; version?: string }
  if (!testcaseId || !bugSlug) {
    return NextResponse.json({ error: 'testcaseId and bugSlug required' }, { status: 400 })
  }

  const bug = await getBug(app, name, bugSlug)
  if (!bug) return NextResponse.json({ error: 'Bug not found' }, { status: 404 })

  const result = await setExecutionBug(app, name, testcaseId, bugSlug, version)
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Failed to link bug' }, { status: 400 })

  return NextResponse.json({
    success: true,
    bug: {
      slug: bugSlug,
      jiraKey: bug.jira_key,
      jiraUrl: bug.jira_key ? await getJiraIssueUrl(bug.jira_key) : null,
      status: bug.status,
    },
  })
}
