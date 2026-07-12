import { NextRequest, NextResponse } from 'next/server'
import { getStoryLinks, setStoryLink } from '@/lib/requirements'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { app } = await params
  const guard = await guardApp(app, 'requirements.view')
  if (!guard.ok) return guard.response
  return NextResponse.json({ links: await getStoryLinks(app) })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { app } = await params
  const guard = await guardApp(app, 'requirements.edit')
  if (!guard.ok) return guard.response
  const body = await req.json() as { frId?: string; storyKey?: string }
  if (typeof body.frId !== 'string' || !body.frId.trim()) {
    return NextResponse.json({ error: 'frId is required' }, { status: 400 })
  }
  const links = await setStoryLink(app, body.frId.trim(), (body.storyKey ?? '').trim())
  return NextResponse.json({ ok: true, links })
}
