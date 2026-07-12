import { NextRequest, NextResponse } from 'next/server'
import { getAppStats } from '@/lib/features'
import { getBugStats } from '@/lib/bugs'
import { guardApp } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'dashboard.view')
  if (!guard.ok) return guard.response
  const [featureStats, bugStats] = await Promise.all([getAppStats(app), getBugStats(app)])
  return NextResponse.json({ ...featureStats, ...bugStats })
}
