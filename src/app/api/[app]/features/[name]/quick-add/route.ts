import { NextRequest, NextResponse } from 'next/server'
import { getFeature, saveTestcaseAdditions, mergeTestcaseMarkdown, parseTestcaseRows, recordLastAddition } from '@/lib/features'
import { generateTestCasesFromScenarios } from '@/lib/ai'
import { guardApp } from '@/lib/auth'
import { sseResponse } from '@/lib/sse'

type Params = { params: Promise<{ app: string; name: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.create')
  if (!guard.ok) return guard.response

  const feature = await getFeature(app, name)
  if (!feature) {
    return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as { model?: string; scenarios?: string[] }
  const scenarios = Array.isArray(body.scenarios)
    ? body.scenarios.map((s) => String(s).trim()).filter(Boolean)
    : []
  if (scenarios.length === 0) {
    return NextResponse.json({ error: 'At least one scenario is required.' }, { status: 400 })
  }

  return sseResponse(async (emit) => {
    let lastTotal = 3

    try {
      const existing = feature.testcases?.trim() ?? ''
      const additions = await generateTestCasesFromScenarios(
        app, name, scenarios, body.model,
        (phase) => { lastTotal = phase.total; emit('phase', phase) },
        existing ? feature.testcases : undefined
      )
      const finalContent = existing
        ? mergeTestcaseMarkdown(existing, additions)
        : additions

      // Additive: saved into the LATEST version in place — no new version, and
      // existing execution statuses are untouched. Undo-able via last-addition.
      emit('phase', { label: 'Finalizing', detail: existing ? 'Merging into latest version…' : 'Saving test cases…', step: lastTotal, total: lastTotal })
      const version = await saveTestcaseAdditions(app, name, finalContent)
      const existingIds = new Set(parseTestcaseRows(existing).map((r) => r.id))
      const addedIds = parseTestcaseRows(finalContent).map((r) => r.id).filter((id) => !existingIds.has(id))
      recordLastAddition(app, name, addedIds, version)
      emit('complete', { data: { testcases: finalContent, version, added: addedIds.length } })
    } catch (err) {
      emit('error', { message: err instanceof Error ? err.message : 'AI generation failed' })
    }
  })
}
