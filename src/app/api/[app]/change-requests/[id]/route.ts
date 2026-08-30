import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/db'
import { ChangeRequestEntity, type IChangeRequest } from '@/lib/entities'
import { updateChangeRequest } from '@/lib/jira'
import { guardApp } from '@/lib/auth'
import type { CrParentType } from '@/lib/cr-format'

type Params = { params: Promise<{ app: string; id: string }> }

async function loadOwnedCr(app: string, idParam: string): Promise<IChangeRequest | null> {
  const id = Number(idParam)
  if (!Number.isFinite(id)) return null
  const ds = await getDataSource()
  const cr = await ds.getRepository(ChangeRequestEntity).findOne({ where: { id, appSlug: app } })
  return cr
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { app, id } = await params
  const guard = await guardApp(app, 'changerequests.edit')
  if (!guard.ok) return guard.response
  const userId = guard.access.user.id

  const cr = await loadOwnedCr(app, id)
  if (!cr) return NextResponse.json({ error: 'Change Request not found' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as {
    summary?: string
    description?: string
    changeType?: string
    priority?: string
  }
  if (!body.summary?.trim()) return NextResponse.json({ error: 'summary is required' }, { status: 400 })
  if (!body.description?.trim()) return NextResponse.json({ error: 'description is required' }, { status: 400 })
  if (!body.changeType?.trim()) return NextResponse.json({ error: 'changeType is required' }, { status: 400 })
  if (!body.priority?.trim()) return NextResponse.json({ error: 'priority is required' }, { status: 400 })

  const ds = await getDataSource()
  const repo = ds.getRepository(ChangeRequestEntity)

  if (cr.crKey) {
    try {
      await updateChangeRequest(app, {
        crKey: cr.crKey,
        summary: body.summary,
        description: body.description,
        changeType: body.changeType,
        priority: body.priority,
        parentType: cr.parentType as CrParentType,
      }, userId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Jira update failed'
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  const updated = await repo.save({
    ...cr,
    summary: body.summary,
    description: body.description,
    changeType: body.changeType,
    priority: body.priority,
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { app, id } = await params
  const guard = await guardApp(app, 'changerequests.delete')
  if (!guard.ok) return guard.response

  const cr = await loadOwnedCr(app, id)
  if (!cr) return NextResponse.json({ error: 'Change Request not found' }, { status: 404 })

  const ds = await getDataSource()
  // Local record only — the Jira issue (if any) is intentionally left intact.
  await ds.getRepository(ChangeRequestEntity).delete(cr.id)
  return NextResponse.json({ ok: true })
}
