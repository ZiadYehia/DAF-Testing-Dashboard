import { NextRequest, NextResponse } from 'next/server'
import { collectKnowledgeGaps } from '@/lib/knowledge-gaps'
import { guardApp } from '@/lib/auth'

type Params = { params: Promise<{ app: string }> }

// Aggregated "Open Questions / Ambiguities" across the app's knowledge docs.
export async function GET(_req: NextRequest, { params }: Params) {
  const { app } = await params
  const guard = await guardApp(app, 'knowledge.view')
  if (!guard.ok) return guard.response

  const gaps = await collectKnowledgeGaps(app)
  const totalItems = gaps.reduce((n, g) => n + g.items.length, 0)
  return NextResponse.json({ gaps, totalItems })
}
