import { NextRequest, NextResponse } from 'next/server'
import { generateChangeRequest, type CrParentContext, type CrGenerateOptions, type CrCandidate } from '@/lib/ai'
import { guardApp } from '@/lib/auth'
import { getAiFeatures } from '@/lib/ai-config'
import { sseResponse } from '@/lib/sse'
import type { CrParentType } from '@/lib/cr-format'

/** Defensive cap on how many candidates we'll ever forward into the prompt. */
const MAX_CANDIDATES = 100

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  const { app } = await params
  const guard = await guardApp(app, 'changerequests.create')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({})) as {
    notes: string
    model?: string
    parentKey?: string
    parentType?: CrParentType
    parentSummary?: string
    module?: string
    candidates?: Array<{ key: string; summary: string; type?: string }>
  }

  if (!body.notes?.trim()) {
    return NextResponse.json({ error: 'notes is required' }, { status: 400 })
  }

  // CONTEXT mode when a parentKey is given (current behavior); otherwise
  // SUGGEST mode using the candidate list — a parent is never required up
  // front, the create step is what actually enforces one.
  const parentKey = body.parentKey?.trim()
  const opts: CrGenerateOptions = parentKey
    ? {
        parentContext: {
          parentKey,
          parentType: body.parentType,
          parentSummary: body.parentSummary,
        } satisfies CrParentContext,
      }
    : {
        candidates: (body.candidates ?? []).slice(0, MAX_CANDIDATES).map((c): CrCandidate => ({
          key: c.key,
          summary: c.summary,
          type: c.type === 'epic' ? 'epic' : c.type === 'story' ? 'story' : undefined,
        })),
      }

  return sseResponse(async (emit) => {
    try {
      const model = body.model || (await getAiFeatures(app)).changeRequest?.defaultModel || undefined
      const draft = await generateChangeRequest(app, guard.access.user.id, body.notes, model,
        (phase) => emit('phase', phase), opts)
      emit('complete', { data: draft })
    } catch (err) {
      emit('error', { message: err instanceof Error ? err.message : 'AI generation failed' })
    }
  })
}
