import { NextRequest, NextResponse } from 'next/server'
import { getFeature, saveTestcaseVersion, saveTestcaseAdditions, mergeTestcaseMarkdown, parseTestcaseRows, recordLastAddition } from '@/lib/features'
import { generateTestCases } from '@/lib/ai'
import { guardApp } from '@/lib/auth'
import { featureReadiness } from '@/lib/readiness'
import { sseResponse } from '@/lib/sse'

type Params = { params: Promise<{ app: string; name: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'testcases.generate')
  if (!guard.ok) return guard.response

  const feature = await getFeature(app, name)
  if (!feature) {
    return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
  }

  if (!feature.workflow?.trim()) {
    return NextResponse.json(
      { error: 'Workflow is required before generating test cases. Please define the feature workflow first.' },
      { status: 400 }
    )
  }

  if (feature.screenshots.length === 0) {
    return NextResponse.json(
      { error: 'At least one screenshot is required before generating test cases. Please upload screenshots first.' },
      { status: 400 }
    )
  }

  const body = await req.json().catch(() => ({})) as { model?: string; mode?: string; guidance?: string }
  const addMore = body.mode === 'add-more'
  const guidance = typeof body.guidance === 'string' ? body.guidance.trim() : ''

  return sseResponse(async (emit) => {
    let lastStep = 0
    let lastTotal = 3

    // Warn (don't block) on missing test-case-gen context — the hard 400s above
    // (workflow/screenshots) still apply; this just surfaces knowledge gaps.
    const missing = (await featureReadiness(app, name)).capabilities.testcaseGen
    if (missing.length > 0) {
      emit('warning', { missing })
    }

    try {
      const additions = await generateTestCases(app, guard.access.user.id, name, body.model, (phase) => {
        lastStep = phase.step
        lastTotal = phase.total
        emit('phase', phase)
      }, addMore ? (feature.testcases ?? '') : undefined, addMore && guidance ? guidance : undefined)

      if (addMore) {
        // Additive: merge into the LATEST version in place — no new version, and
        // existing execution statuses (keyed by testcase ID) are untouched.
        const existing = feature.testcases ?? ''
        const finalContent = mergeTestcaseMarkdown(existing, additions)
        emit('phase', { label: 'Finalizing', detail: 'Merging into latest version…', step: lastTotal, total: lastTotal })
        const version = await saveTestcaseAdditions(app, name, finalContent)
        const existingIds = new Set(parseTestcaseRows(existing).map((r) => r.id))
        const addedIds = parseTestcaseRows(finalContent).map((r) => r.id).filter((id) => !existingIds.has(id))
        await recordLastAddition(app, name, addedIds, version)
        emit('complete', { data: { testcases: finalContent, version, added: addedIds.length } })
      } else {
        emit('phase', { label: 'Finalizing', detail: 'Saving test case version…', step: lastTotal, total: lastTotal })
        const version = await saveTestcaseVersion(app, name, additions, { clearExecution: true })
        emit('complete', { data: { testcases: additions, version } })
      }
    } catch (err) {
      emit('error', { message: err instanceof Error ? err.message : 'AI generation failed' })
    }
  })
}
