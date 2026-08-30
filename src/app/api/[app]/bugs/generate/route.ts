import { NextRequest, NextResponse } from 'next/server'
import { generateBugReport } from '@/lib/ai'
import { guardApp } from '@/lib/auth'
import { appReadiness } from '@/lib/readiness'
import { variantForParentKey, type BugVariant } from '@/lib/bug-format'
import { sseResponse } from '@/lib/sse'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'bugs.create')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({})) as { notes: string; model?: string; variant?: BugVariant; parent_key?: string | null }
  if (!body.notes?.trim()) {
    return NextResponse.json({ error: 'notes is required' }, { status: 400 })
  }
  const variant: BugVariant = body.parent_key !== undefined ? variantForParentKey(body.parent_key) : (body.variant ?? 'epic')

  return sseResponse(async (emit) => {
    // Warn (don't block) on missing bug-report context.
    const missing = (await appReadiness(app)).capabilities.bugGen
    if (missing.length > 0) {
      emit('warning', { missing })
    }

    try {
      const report = await generateBugReport(app, guard.access.user.id, body.notes, body.model,
        (phase) => emit('phase', phase), variant)
      emit('complete', { data: report })
    } catch (err) {
      emit('error', { message: err instanceof Error ? err.message : 'AI generation failed' })
    }
  })
}
