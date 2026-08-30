import { NextRequest, NextResponse } from 'next/server'
import { appReadiness, moduleReadiness, featureReadiness } from '@/lib/readiness'
import { guardApp } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  const guard = await guardApp(app, 'dashboard.view')
  if (!guard.ok) return guard.response

  const moduleParam = req.nextUrl.searchParams.get('module')
  const featureParam = req.nextUrl.searchParams.get('feature')

  const readiness = featureParam
    ? await featureReadiness(app, featureParam)
    : moduleParam
    ? await moduleReadiness(app, moduleParam)
    : await appReadiness(app)

  return NextResponse.json(readiness)
}
