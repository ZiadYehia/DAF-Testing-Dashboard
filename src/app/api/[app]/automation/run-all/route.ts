import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { runRegression, isRegressionRunning } from '@/lib/automation-regression'

export const runtime = 'nodejs'
// Sequential replays: allow up to 10 minutes before the platform cuts us off.
export const maxDuration = 600

/**
 * POST /api/[app]/automation/run-all — server-side regression over this app's
 * projects. Body: { tag? }. Syncs linked test cases and notifies the team webhook.
 * (The UI's "Run all" button keeps its client loop for live progress; this route
 * serves the scheduler's manual counterpart, CI triggers, and scripting.)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'automation.run')
  if (!guard.ok) return guard.response
  if (isRegressionRunning()) {
    return NextResponse.json({ error: 'A regression run is already in progress' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const tag = typeof body?.tag === 'string' && body.tag.trim() ? body.tag.trim() : undefined

  try {
    const summary = await runRegression({ trigger: 'api', app, tag })
    return NextResponse.json(summary)
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Regression failed' }, { status: 500 })
  }
}
