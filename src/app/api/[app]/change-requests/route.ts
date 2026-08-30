import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/db'
import { ChangeRequestEntity, type IChangeRequest } from '@/lib/entities'
import { createChangeRequest } from '@/lib/jira'
import { getCrFormat } from '@/lib/cr-format-server'
import { getSetting } from '@/lib/settings'
import { guardApp } from '@/lib/auth'
import type { CrParentType } from '@/lib/cr-format'

type Params = { params: Promise<{ app: string }> }

// Per-(app, parentKey, summary) in-process lock. Guards the check-then-act race
// between inserting the local draft row and pushing it to Jira — a double-submit
// could otherwise create two Jira issues for the same change request.
// Pattern precedent: bugs/[feature]/[slug]/report/route.ts's `reporting` Set.
const creating = new Set<string>()

export async function POST(req: NextRequest, { params }: Params) {
  const { app } = await params
  const guard = await guardApp(app, 'changerequests.create')
  if (!guard.ok) return guard.response
  const userId = guard.access.user.id

  const body = await req.json().catch(() => ({})) as {
    parentKey?: string
    summary?: string
    description?: string
    changeType?: string
    priority?: string
    parentType?: CrParentType
    module?: string | null
  }
  if (!body.parentKey?.trim()) return NextResponse.json({ error: 'parentKey is required' }, { status: 400 })
  if (!body.summary?.trim()) return NextResponse.json({ error: 'summary is required' }, { status: 400 })
  if (!body.description?.trim()) return NextResponse.json({ error: 'description is required' }, { status: 400 })
  if (!body.changeType?.trim()) return NextResponse.json({ error: 'changeType is required' }, { status: 400 })
  if (!body.priority?.trim()) return NextResponse.json({ error: 'priority is required' }, { status: 400 })

  const lockKey = `${app}::${body.parentKey}::${body.summary}`
  if (creating.has(lockKey)) {
    return NextResponse.json({ error: 'Create already in progress' }, { status: 409 })
  }
  creating.add(lockKey)
  try {
    const ds = await getDataSource()
    const repo = ds.getRepository(ChangeRequestEntity)
    const format = await getCrFormat(app)

    // Insert the local draft first so it survives a Jira failure and can be
    // retried/edited later — the local row is the durable source of truth,
    // the Jira issue is best-effort on top of it. parentType is provisional
    // (whatever the caller already knows, e.g. from the stories/epics view)
    // until createChangeRequest resolves it authoritatively via Jira's
    // issuetype.hierarchyLevel below.
    const draft: Partial<IChangeRequest> = {
      appSlug: app,
      parentKey: body.parentKey,
      parentType: body.parentType ?? 'story',
      crKey: null,
      summary: body.summary,
      description: body.description,
      changeType: body.changeType,
      priority: body.priority,
      label: format.label,
      jiraStatus: null,
      assignee: null,
      createdByUserId: userId,
      syncedAt: null,
      module: body.module ?? null,
    }
    let cr = await repo.save(draft)

    try {
      const { key, parentType } = await createChangeRequest(app, {
        parentKey: body.parentKey,
        summary: body.summary,
        description: body.description,
        changeType: body.changeType,
        priority: body.priority,
      }, userId)

      const update: Partial<IChangeRequest> = { crKey: key, parentType, syncedAt: new Date() }
      cr = await repo.save({ ...cr, ...update })

      return NextResponse.json(cr)
    } catch (err) {
      // Jira push failed — the local row still exists (crKey stays null) so the
      // change request isn't lost and can be retried/edited from the CR list.
      const message = err instanceof Error ? err.message : 'Jira create failed'
      console.error('[change-requests] Jira create failed:', err)
      return NextResponse.json({ error: message, changeRequest: cr }, { status: 502 })
    }
  } finally {
    creating.delete(lockKey)
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { app } = await params
  const guard = await guardApp(app, 'changerequests.view')
  if (!guard.ok) return guard.response

  // Unlike bugs' listBugs (where a missing ?module means "unscoped" rows, i.e.
  // module IS NULL), change requests have no unscoped/module-less concept for
  // the app-level list: no ?module param returns every CR for the app, and a
  // present ?module filters down to an exact module match.
  const moduleParam = req.nextUrl.searchParams.get('module')
  const ds = await getDataSource()
  const crs = await ds.getRepository(ChangeRequestEntity).find({
    where: moduleParam === null ? { appSlug: app } : { appSlug: app, module: moduleParam },
    order: { createdAt: 'DESC' },
  })
  // Read the Jira base URL once instead of once per row — same URL shape as
  // jira.ts's getJiraIssueUrl / the bugs list route.
  const jiraBaseUrl = ((await getSetting('global', 'JIRA_BASE_URL')) ?? '').replace(/\/$/, '')
  const withUrls = crs.map((cr) => ({
    ...cr,
    jira_url: cr.crKey ? `${jiraBaseUrl}/browse/${cr.crKey}` : null,
    parent_url: cr.parentKey ? `${jiraBaseUrl}/browse/${cr.parentKey}` : null,
  }))
  return NextResponse.json(withUrls)
}
