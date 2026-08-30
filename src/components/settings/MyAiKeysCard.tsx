'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Save, Beaker, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { fetchWithRetry } from '@/components/settings/fetchWithRetry'

interface AiKeySlot {
  provider: string
  label: string
  keyName: string
  custom: boolean
  baseUrl: string | null
  value: string
  configured: boolean
  createKeyUrl?: string | null
}

/**
 * Personal AI provider keys — every user has their own, mirroring MyJiraCard.
 * There is no shared/team AI key: each request uses the calling user's own key
 * (settings scope `user:<id>`, see /api/me/ai-keys and src/lib/ai-config.ts for
 * the provider catalog).
 */
export function MyAiKeysCard() {
  const [slots, setSlots] = useState<AiKeySlot[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [tests, setTests] = useState<Record<string, { testing?: boolean; valid?: boolean; error?: string }>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetchWithRetry('/api/me/ai-keys')
      if (!res.ok) throw new Error('Failed to load your AI keys')
      const data: { keys: AiKeySlot[] } = await res.json()
      setSlots(data.keys ?? [])
      setValues(Object.fromEntries((data.keys ?? []).map((k) => [k.keyName, k.value ?? ''])))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load your AI keys')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Load-on-mount pattern matches every sibling settings tab (Profile, Defaults,
    // Board, Branding, AI) — all trip this same warning; disabled here only to stay
    // under the repo's lint warning ratchet (package.json "lint": max-warnings).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function save(slot: AiKeySlot) {
    const value = values[slot.keyName] ?? ''
    // Field still holds the masked value from GET (untouched) — nothing to save.
    if (value.startsWith('••••')) return
    setSaving(slot.keyName)
    try {
      const res = await fetch('/api/me/ai-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: slot.keyName, value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data?.error ?? 'Failed to save')
      }
      toast.success('Saved')
      await load()
      if (value !== '') await testKey(slot)
      else setTests((t) => { const { [slot.provider]: _gone, ...rest } = t; return rest })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  async function testKey(slot: AiKeySlot) {
    setTests((t) => ({ ...t, [slot.provider]: { testing: true } }))
    try {
      const res = await fetch('/api/settings/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: slot.provider }),
      })
      const data = await res.json()
      setTests((t) => ({ ...t, [slot.provider]: { valid: data.valid, error: data.error } }))
    } catch {
      setTests((t) => ({ ...t, [slot.provider]: { valid: false, error: 'Request failed' } }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          My AI Keys
        </CardTitle>
        <CardDescription>
          Your own API keys for AI-powered features — used only for your requests, never shared with
          other users. At least one key is required to use AI features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
          </div>
        ) : (
          slots.map((slot) => {
            const t = tests[slot.provider] ?? {}
            const value = values[slot.keyName] ?? ''
            return (
              <div key={slot.keyName} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{slot.label}</label>
                    {slot.custom && <Badge variant="outline" className="text-[10px]">custom</Badge>}
                    {slot.baseUrl && (
                      <span className="hidden truncate font-mono text-[11px] text-muted-foreground sm:inline">
                        {slot.baseUrl}
                      </span>
                    )}
                  </div>
                  {t.valid === true && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Valid
                    </Badge>
                  )}
                  {t.valid === false && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                    >
                      <XCircle className="h-3 w-3" /> {t.error ?? 'Invalid'}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    type={revealed[slot.keyName] ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => setValues((v) => ({ ...v, [slot.keyName]: e.target.value }))}
                    placeholder="••••••••••••••••"
                    className="h-9 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setRevealed((r) => ({ ...r, [slot.keyName]: !r[slot.keyName] }))}
                  >
                    {revealed[slot.keyName] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    onClick={() => save(slot)}
                    disabled={saving === slot.keyName}
                  >
                    {saving === slot.keyName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving === slot.keyName ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    onClick={() => testKey(slot)}
                    disabled={t.testing}
                  >
                    {t.testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Beaker className="h-4 w-4" />} Test
                  </Button>
                </div>
                {slot.createKeyUrl && (
                  <a
                    href={slot.createKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-primary hover:underline"
                  >
                    Create an API key →
                  </a>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
