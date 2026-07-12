import { NextRequest, NextResponse } from 'next/server'
import { getFeature, parseTestcaseRows } from '@/lib/features'
import { getExecutions, getExecutionBugs, setExecutionStatus, DEFAULT_EXECUTION_STATUS } from '@/lib/execution'
import { getBug } from '@/lib/bugs'
import { getJiraIssueUrl } from '@/lib/jira'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.view')
  if (!guard.ok) return guard.response
  const feature = await getFeature(app, name)
  if (!feature) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })

  // Which version's test cases to show. Defaults to the latest. A `version`
  // query param selects an older version so the execution tab mirrors the Test
  // Cases tab's version selector. Execution status/bug-links are scoped per
  // version (see src/lib/execution.ts) — resolve "latest" to its concrete
  // version number so reads target that version's own file rather than an
  // ambiguous "current" file.
  const versionParam = req.nextUrl.searchParams.get('version')
  let content = feature.testcases
  let effectiveVersion = versionParam ?? undefined
  if (versionParam) {
    const match = feature.testcaseVersions.find((v) => v.filename === `${name}-testcases-v${versionParam}.md`)
    if (match) content = match.content
  } else if (feature.testcaseVersions.length > 0) {
    const latest = feature.testcaseVersions[feature.testcaseVersions.length - 1]
    effectiveVersion = latest.filename.match(/-v(\d+)\.md$/)?.[1]
  }

  const rows = parseTestcaseRows(content)
  const statuses = await getExecutions(app, name, effectiveVersion)
  const bugLinks = await getExecutionBugs(app, name, effectiveVersion)

  // Resolve each linked bug slug once (only the few that have links).
  const linkedSlugs = [...new Set(Object.values(bugLinks))]
  const bugBySlug = new Map<string, { slug: string; jiraKey: string | null; jiraUrl: string | null; status: string } | null>()
  await Promise.all(
    linkedSlugs.map(async (slug) => {
      const bug = await getBug(app, name, slug)
      if (!bug) { bugBySlug.set(slug, null); return }
      bugBySlug.set(slug, {
        slug,
        jiraKey: bug.jira_key,
        jiraUrl: bug.jira_key ? await getJiraIssueUrl(bug.jira_key) : null,
        status: bug.status,
      })
    }),
  )

  const testcases = rows.map((r) => ({
    id: r.id,
    objective: r.objective,
    steps: r.steps,
    status: statuses[r.id] ?? DEFAULT_EXECUTION_STATUS,
    bug: bugLinks[r.id] ? bugBySlug.get(bugLinks[r.id]) ?? null : null,
  }))
  return NextResponse.json({ testcases })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'testcases.execute')
  if (!guard.ok) return guard.response
  const { testcaseId, status, version } = (await req.json()) as { testcaseId: string; status: string; version?: string }
  if (!testcaseId || !status) {
    return NextResponse.json({ error: 'testcaseId and status required' }, { status: 400 })
  }
  const result = await setExecutionStatus(app, name, testcaseId, status, version)
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'Failed to update status' }, { status: 400 })
  return NextResponse.json({ success: true })
}
