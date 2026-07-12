import { NextRequest, NextResponse } from 'next/server'
import { listApprovedExamples, approveExample, deleteApprovedExample } from '@/lib/approved-examples'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

// List approved examples for a feature.
export async function GET(_req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.view')
  if (!guard.ok) return guard.response
  return NextResponse.json({ examples: await listApprovedExamples(app, name) })
}

// Approve a test-case table as a few-shot "gold" example.
export async function POST(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'testcases.generate')
  if (!guard.ok) return guard.response

  const body = (await req.json().catch(() => ({}))) as { content?: string; sourceVersion?: number | null }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  try {
    const id = await approveExample(app, name, body.content, body.sourceVersion ?? null)
    if (id == null) {
      return NextResponse.json({ error: 'Database unavailable — could not save approved example' }, { status: 503 })
    }
    return NextResponse.json({ id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to approve example'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// Remove an approved example by id (?id=123).
export async function DELETE(req: NextRequest, { params }: Params) {
  const { app } = await params
  const guard = await guardApp(app, 'testcases.generate')
  if (!guard.ok) return guard.response

  const id = parseInt(req.nextUrl.searchParams.get('id') ?? '', 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Valid id is required' }, { status: 400 })
  const ok = await deleteApprovedExample(app, id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
