import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getAiFeatures, saveAiFeatures, AI_FEATURES, type AiFeatureMap } from '@/lib/ai-config'

export const runtime = 'nodejs'

/** GET /api/[app]/ai-features — per-app feature gating + the feature catalog. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'features.view')
  if (!guard.ok) return guard.response

  const features = await getAiFeatures(app)
  return NextResponse.json({ features, catalog: AI_FEATURES })
}

/** PUT /api/[app]/ai-features — save the per-app feature config. Body: { features }. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const guard = await guardApp(app, 'settings.edit')
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => ({}))
  const input = (body?.features ?? {}) as Record<string, any>
  const out: AiFeatureMap = {}
  for (const f of AI_FEATURES) {
    const s = input[f.key] ?? {}
    out[f.key] = {
      enabled: s.enabled ?? true,
      defaultModel: s.defaultModel ?? null,
      allowedModels: Array.isArray(s.allowedModels) ? s.allowedModels.map(String) : [],
    }
  }
  await saveAiFeatures(app, out)
  return NextResponse.json({ ok: true })
}
