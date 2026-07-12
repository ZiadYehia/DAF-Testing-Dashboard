import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { requireAuth } from '@/lib/auth'
import { getSetting } from '@/lib/settings'
import {
  PROVIDER_ENV_KEY,
  getCustomProviders,
  customProviderKeyName,
  type BuiltinProvider,
} from '@/lib/ai-config'

export const runtime = 'nodejs'

/**
 * POST /api/settings/test-key — validate a provider's stored key with a tiny live
 * call (no generation where avoidable). Body: { provider }. Returns { valid, error? }.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
  } catch (err: any) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: err.status ?? 401 })
  }

  const body = await req.json().catch(() => ({}))
  const provider = String(body?.provider ?? '')
  const custom = provider in PROVIDER_ENV_KEY
    ? undefined
    : (await getCustomProviders()).find((p) => p.id === provider)
  if (!provider || (!(provider in PROVIDER_ENV_KEY) && !custom)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const keyName = custom ? customProviderKeyName(custom.id) : PROVIDER_ENV_KEY[provider as BuiltinProvider]
  const apiKey = await getSetting('global', keyName)
  if (!apiKey) return NextResponse.json({ valid: false, error: 'No key configured' })

  try {
    if (custom) {
      // OpenAI-compatible: GET /models validates the key without generating.
      const r = await fetch(`${custom.baseUrl.replace(/\/+$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    } else if (provider === 'anthropic') {
      await new Anthropic({ apiKey }).models.list({ limit: 1 })
    } else if (provider === 'groq') {
      await new Groq({ apiKey }).models.list()
    } else {
      // Google: list models via REST (validates the key without generating).
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    }
    return NextResponse.json({ valid: true })
  } catch (err: any) {
    const msg = err?.status === 401 || /401|invalid|unauthor/i.test(String(err?.message))
      ? 'Invalid API key'
      : (err?.message ?? 'Validation failed')
    return NextResponse.json({ valid: false, error: msg })
  }
}
