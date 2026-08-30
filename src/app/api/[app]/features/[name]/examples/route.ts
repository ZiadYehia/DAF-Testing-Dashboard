import { NextRequest, NextResponse } from 'next/server'
import { listExamples } from '@/lib/features'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string; name: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { app } = await params
  const guard = await guardApp(app, 'features.view')
  if (!guard.ok) return guard.response
  return NextResponse.json(await listExamples(app))
}
