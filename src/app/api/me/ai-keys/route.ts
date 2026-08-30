import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getSetting, setSetting, maskSecretValue, MASK_PREFIX } from '@/lib/settings'
import {
  PROVIDER_ENV_KEY,
  BUILTIN_OPENAI_COMPAT,
  PROVIDER_CREATE_KEY_URL,
  getCustomProviders,
  customProviderKeyName,
} from '@/lib/ai-config'

export const runtime = 'nodejs'

/**
 * Per-user AI provider keys (settings scope `user:<id>`). Mirrors the personal
 * Jira credentials pattern in /api/me/jira-credentials — every user has their
 * own key per provider (built-in + any registered custom providers), no shared
 * team key. See PROVIDER_ENV_KEY / getCustomProviders / customProviderKeyName
 * in src/lib/ai-config.ts for the provider catalog and key-naming rules.
 */

const BUILTIN_LABELS: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  groq: 'Groq',
  moonshot: 'Moonshot (Kimi)',
}

interface KeySlot {
  provider: string
  label: string
  keyName: string
  custom: boolean
  baseUrl: string | null
}

async function knownKeySlots(): Promise<KeySlot[]> {
  const builtins: KeySlot[] = Object.entries(PROVIDER_ENV_KEY).map(([provider, keyName]) => ({
    provider,
    label: BUILTIN_LABELS[provider] ?? provider,
    keyName,
    custom: false,
    baseUrl: null,
  }))
  // Built-in OpenAI-compatible providers not already covered by PROVIDER_ENV_KEY
  // (e.g. openrouter, cerebras) — moonshot is skipped here since it's already
  // listed above via PROVIDER_ENV_KEY.
  const compatBuiltins: KeySlot[] = Object.values(BUILTIN_OPENAI_COMPAT)
    .filter((p) => !(p.id in PROVIDER_ENV_KEY))
    .map((p) => ({
      provider: p.id,
      label: p.label,
      keyName: customProviderKeyName(p.id),
      custom: false,
      baseUrl: p.baseUrl,
    }))
  const customProviders = await getCustomProviders()
  const custom: KeySlot[] = customProviders.map((p) => ({
    provider: p.id,
    label: p.label,
    keyName: customProviderKeyName(p.id),
    custom: true,
    baseUrl: p.baseUrl,
  }))
  return [...builtins, ...compatBuiltins, ...custom]
}

export async function GET() {
  let userId: number
  try {
    userId = (await requireAuth()).id
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: 'Not authenticated' }, { status })
  }

  const scope = `user:${userId}`
  const slots = await knownKeySlots()
  const values = await Promise.all(slots.map((s) => getSetting(scope, s.keyName)))

  const keys = slots.map((s, i) => {
    const raw = values[i] ?? ''
    return {
      provider: s.provider,
      label: s.label,
      keyName: s.keyName,
      custom: s.custom,
      baseUrl: s.baseUrl,
      value: maskSecretValue(raw),
      configured: Boolean(raw),
      createKeyUrl: PROVIDER_CREATE_KEY_URL[s.provider] ?? null,
    }
  })

  return NextResponse.json({ keys })
}

export async function PUT(req: NextRequest) {
  let userId: number
  try {
    userId = (await requireAuth()).id
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: 'Not authenticated' }, { status })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { keyName?: string; value?: string }
    const keyName = typeof body.keyName === 'string' ? body.keyName : ''
    const value = typeof body.value === 'string' ? body.value : ''

    const slots = await knownKeySlots()
    const known = slots.some((s) => s.keyName === keyName)
    if (!known) {
      return NextResponse.json({ error: `Unknown key: ${keyName}` }, { status: 400 })
    }

    // A masked value (from a GET response) must never be written back over the real one.
    if (value.startsWith(MASK_PREFIX)) {
      return NextResponse.json(
        { error: 'Masked value — enter the full key to update' },
        { status: 400 }
      )
    }

    await setSetting(`user:${userId}`, keyName, value)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
