import { NextRequest, NextResponse } from 'next/server'
import { readKnowledgeFile, writeKnowledgeFile } from '@/lib/knowledge'
import { guardApp } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string; filename: string }> }
) {
  const { app, filename } = await params
  const guard = await guardApp(app, 'knowledge.view')
  if (!guard.ok) return guard.response

  try {
    const moduleParam = _req.nextUrl.searchParams.get('module')
    const content = readKnowledgeFile(app, filename, moduleParam ?? null)
    return NextResponse.json({ filename, content })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Not found'
    return NextResponse.json({ error: message }, { status: 404 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ app: string; filename: string }> }
) {
  const { app, filename } = await params
  const guard = await guardApp(app, 'knowledge.edit')
  if (!guard.ok) return guard.response

  const body = await req.json() as { content: string }
  if (typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  try {
    const moduleParam = req.nextUrl.searchParams.get('module')
    writeKnowledgeFile(app, filename, body.content, { module: moduleParam ?? null })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Write failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
