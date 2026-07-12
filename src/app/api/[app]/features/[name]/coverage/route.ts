import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { analyzeAcceptanceCoverage, analyzeAcceptanceCoverageDeep, AcceptanceCriterion } from '@/lib/ai'
import { getAcs, saveAcs } from '@/lib/acceptance-criteria'
import { parseTestcaseRows } from '@/lib/features'
import { guardApp } from '@/lib/auth'
import { getDataRoot } from '@/lib/paths'

type Params = { params: Promise<{ app: string; name: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.view')
  if (!guard.ok) return guard.response
  return NextResponse.json(await getAcs(app, name))
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'features.edit')
  if (!guard.ok) return guard.response
  const { acs } = await req.json() as { acs: AcceptanceCriterion[] }
  await saveAcs(app, name, acs)
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { app, name } = await params
  const guard = await guardApp(app, 'testcases.generate')
  if (!guard.ok) return guard.response

  const { modelId, mode } = await req.json() as { modelId: string; mode?: string }

  const acs = await getAcs(app, name)
  if (acs.length === 0) return NextResponse.json({ error: 'No acceptance criteria defined' }, { status: 400 })

  if (mode === 'reset') {
    const reset = acs.map(ac => ({ ...ac, aiCoveredBy: [], aiAnalyzedAt: null }))
    await saveAcs(app, name, reset)
    return NextResponse.json({ acs: reset })
  }

  const dataRoot = getDataRoot()
  const featureDir = path.join(dataRoot, app, 'features', name)
  const tcFile = path.join(featureDir, `${name}-testcases.md`)
  if (!fs.existsSync(tcFile)) {
    return NextResponse.json({ error: 'No test cases found for this feature' }, { status: 400 })
  }
  const testcases = fs.readFileSync(tcFile, 'utf-8')
  if (!testcases.trim()) {
    return NextResponse.json({ error: 'Test cases file is empty' }, { status: 400 })
  }

  try {
    const parentIds = new Set(acs.map(a => a.parentId).filter(Boolean) as string[])
    const leaves = acs.filter(ac => !parentIds.has(ac.id))

    const knownIds = new Set(parseTestcaseRows(testcases).map(r => r.id))

    const analyze = mode === 'deep' ? analyzeAcceptanceCoverageDeep : analyzeAcceptanceCoverage
    const result = await analyze(
      leaves.map(ac => ({ id: ac.id, text: ac.text })),
      testcases,
      modelId
    )

    const now = new Date().toISOString()
    const updated: AcceptanceCriterion[] = acs.map(ac => {
      if (parentIds.has(ac.id)) return ac
      const match = result.find(r => r.id === ac.id)
      const merged = [
        ...ac.aiCoveredBy.filter(id => knownIds.has(id)),
        ...(match?.coveredBy ?? []).filter(id => knownIds.has(id)),
      ]
      return { ...ac, aiCoveredBy: [...new Set(merged)], aiAnalyzedAt: now }
    })

    await saveAcs(app, name, updated)
    return NextResponse.json({ acs: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
