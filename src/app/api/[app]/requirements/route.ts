import { NextRequest, NextResponse } from 'next/server'
import { getRequirements, updateRequirement, addRequirementRows, deleteRequirementRow, type NewRequirementRow } from '@/lib/features'
import { setStoryLink } from '@/lib/requirements'
import { guardApp } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'requirements.view')
  if (!guard.ok) return guard.response
  const moduleParam = req.nextUrl.searchParams.get('module')
  const content = await getRequirements(app, moduleParam ?? null)
  return NextResponse.json({ content })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'requirements.edit')
  if (!guard.ok) return guard.response
  const body = await req.json() as { rowIndex: number; field: 'status' | 'priority'; value: string; module?: string | null }
  const { rowIndex, field, value, module } = body
  if (typeof rowIndex !== 'number' || !field || !value) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const ok = await updateRequirement(app, rowIndex, field, value, module ?? null)
  if (!ok) return NextResponse.json({ error: 'Row not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'requirements.edit')
  if (!guard.ok) return guard.response
  const body = await req.json() as { rows?: NewRequirementRow[]; module?: string | null; storyKey?: string }
  const rows = Array.isArray(body.rows) ? body.rows : []
  if (rows.length === 0 || rows.some((r) => !r?.id?.trim() || !r?.requirement?.trim())) {
    return NextResponse.json({ error: 'Each row needs an id and a requirement' }, { status: 400 })
  }
  const result = await addRequirementRows(app, rows, body.module ?? null)
  const storyKey = body.storyKey?.trim()
  if (storyKey) {
    for (const id of result.added) {
      await setStoryLink(app, id, storyKey)
    }
  }
  return NextResponse.json(result)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'requirements.edit')
  if (!guard.ok) return guard.response
  const body = await req.json() as { frId?: string; module?: string | null }
  const frId = body.frId?.trim()
  if (!frId) return NextResponse.json({ error: 'frId is required' }, { status: 400 })
  const ok = await deleteRequirementRow(app, frId, body.module ?? null)
  if (!ok) return NextResponse.json({ error: 'Requirement not found' }, { status: 404 })
  await setStoryLink(app, frId, '') // drop the story link so it doesn't dangle
  return NextResponse.json({ ok: true })
}
