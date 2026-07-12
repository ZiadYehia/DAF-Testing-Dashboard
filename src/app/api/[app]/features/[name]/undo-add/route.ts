import { NextRequest, NextResponse } from 'next/server'
import { getFeature, undoLastAddition } from '@/lib/features'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

/** Undoes the most recent AI-appended batch of test cases: strips those rows
 *  from the latest version (in place) and removes their execution entries. */
export async function POST(_req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.create')
  if (!guard.ok) return guard.response

  const feature = await getFeature(app, name)
  if (!feature) {
    return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
  }

  const result = await undoLastAddition(app, name)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result)
}
