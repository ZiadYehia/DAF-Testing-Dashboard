import { NextRequest, NextResponse } from 'next/server'
import { restoreFeature } from '@/lib/features'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.delete')
  if (!guard.ok) return guard.response
  const ok = await restoreFeature(app, name)
  if (!ok) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
