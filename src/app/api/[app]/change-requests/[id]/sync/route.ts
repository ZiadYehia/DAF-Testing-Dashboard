import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/db'
import { ChangeRequestEntity } from '@/lib/entities'
import { pullChangeRequest } from '@/lib/jira'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { app, id: idParam } = await params
  const guard = await guardApp(app, 'changerequests.view')
  if (!guard.ok) return guard.response
  const userId = guard.access.user.id

  const id = Number(idParam)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Change Request not found' }, { status: 404 })

  const ds = await getDataSource()
  const repo = ds.getRepository(ChangeRequestEntity)
  const cr = await repo.findOne({ where: { id, appSlug: app } })
  if (!cr) return NextResponse.json({ error: 'Change Request not found' }, { status: 404 })
  if (!cr.crKey) return NextResponse.json({ error: 'Change Request has no Jira key' }, { status: 400 })

  try {
    // Jira-authoritative pull: status/assignee/summary/description always win over
    // whatever's stored locally (last-write-wins on overlapping content).
    const pulled = await pullChangeRequest(app, cr.crKey, userId)
    const updated = await repo.save({
      ...cr,
      summary: pulled.summary,
      description: pulled.description,
      jiraStatus: pulled.status,
      assignee: pulled.assignee,
      syncedAt: new Date(),
    })
    return NextResponse.json(updated)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Jira sync failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
