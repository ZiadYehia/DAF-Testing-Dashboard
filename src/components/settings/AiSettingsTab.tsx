'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Eye, EyeOff, CheckCircle2, XCircle, Loader2, Plus, Trash2, Bot, Beaker,
} from 'lucide-react'
import { cn, slugify } from '@/lib/utils'

interface AIModel {
  id: string; name: string; provider: string
  enabled: boolean; disabledReason?: string; supportsVision?: boolean; description?: string
}
interface Registry { disabled: string[]; custom: AIModel[] }
interface FeatureCfg { enabled: boolean; defaultModel: string | null; allowedModels: string[] }
interface CatalogItem { key: string; label: string; detail: string }
interface CustomProvider { id: string; label: string; baseUrl: string; keyName: string }

const BUILTIN_PROVIDERS = [
  { provider: 'anthropic', label: 'Anthropic (Claude)', key: 'ANTHROPIC_API_KEY' },
  { provider: 'google', label: 'Google (Gemini)', key: 'GEMINI_API_KEY' },
  { provider: 'groq', label: 'Groq', key: 'GROQ_API_KEY' },
]

/** Small on/off pill toggle (no Switch component in the design system). */
function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        on ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
      aria-pressed={on}
    >
      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

export function AiSettingsTab({ app }: { app: string }) {
  // Keys
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [tests, setTests] = useState<Record<string, { testing?: boolean; valid?: boolean; error?: string }>>({})
  // Providers
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([])
  const [newProvider, setNewProvider] = useState({ label: '', baseUrl: '' })
  const [providerError, setProviderError] = useState<string | null>(null)
  // Models
  const [models, setModels] = useState<AIModel[]>([])
  const [registry, setRegistry] = useState<Registry>({ disabled: [], custom: [] })
  const [newModel, setNewModel] = useState({ id: '', name: '', provider: 'anthropic', supportsVision: true })
  // Features
  const [features, setFeatures] = useState<Record<string, FeatureCfg>>({})
  const [catalog, setCatalog] = useState<CatalogItem[]>([])

  const loadKeys = useCallback(async () => {
    const r = await fetch('/api/settings'); if (r.ok) setKeys(await r.json())
  }, [])
  const loadProviders = useCallback(async () => {
    const r = await fetch('/api/settings/providers')
    if (r.ok) { const d = await r.json(); setCustomProviders(d.providers) }
  }, [])
  const loadModels = useCallback(async () => {
    const r = await fetch('/api/settings/models')
    if (r.ok) { const d = await r.json(); setModels(d.models); setRegistry(d.registry) }
  }, [])
  const loadFeatures = useCallback(async () => {
    const r = await fetch(`/api/${app}/ai-features`)
    if (r.ok) { const d = await r.json(); setFeatures(d.features); setCatalog(d.catalog) }
  }, [app])

  useEffect(() => { loadKeys(); loadProviders(); loadModels(); loadFeatures() }, [loadKeys, loadProviders, loadModels, loadFeatures])

  async function saveKey(provider: string, key: string) {
    // Field still holds the masked value from GET (untouched) — nothing to save.
    if ((keys[key] ?? '').startsWith('••••')) return
    setSavingKey(key)
    try {
      const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: keys[key] ?? '' }) })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setTests((t) => ({ ...t, [provider]: { valid: false, error: d.error ?? `Save failed (HTTP ${r.status})` } }))
        return
      }
      await loadModels()
      // Immediately validate the freshly saved key so a bad paste is visible.
      if ((keys[key] ?? '') !== '') await testKey(provider)
      else setTests((t) => { const { [provider]: _gone, ...rest } = t; return rest })
    } catch {
      setTests((t) => ({ ...t, [provider]: { valid: false, error: 'Save failed — network error' } }))
    } finally { setSavingKey(null) }
  }
  async function testKey(provider: string) {
    setTests((t) => ({ ...t, [provider]: { testing: true } }))
    try {
      const r = await fetch('/api/settings/test-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) })
      const d = await r.json()
      setTests((t) => ({ ...t, [provider]: { valid: d.valid, error: d.error } }))
    } catch {
      setTests((t) => ({ ...t, [provider]: { valid: false, error: 'Request failed' } }))
    }
  }
  async function saveProviders(next: Omit<CustomProvider, 'keyName'>[]) {
    setProviderError(null)
    const r = await fetch('/api/settings/providers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providers: next }) })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      setProviderError(d.error ?? `Save failed (HTTP ${r.status})`)
      return false
    }
    await Promise.all([loadProviders(), loadModels()])
    return true
  }
  async function addProvider() {
    const label = newProvider.label.trim()
    const baseUrl = newProvider.baseUrl.trim()
    const id = slugify(label)
    if (!id || !baseUrl) return
    if (await saveProviders([...customProviders, { id, label, baseUrl }])) {
      setNewProvider({ label: '', baseUrl: '' })
    }
  }
  async function removeProvider(id: string) {
    await saveProviders(customProviders.filter((p) => p.id !== id))
  }
  async function saveRegistry(next: Registry) {
    setRegistry(next)
    await fetch('/api/settings/models', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
    await loadModels()
  }
  function toggleModel(id: string) {
    const disabled = registry.disabled.includes(id)
      ? registry.disabled.filter((x) => x !== id)
      : [...registry.disabled, id]
    saveRegistry({ ...registry, disabled })
  }
  function addCustomModel() {
    if (!newModel.id.trim() || !newModel.name.trim()) return
    saveRegistry({ ...registry, custom: [...registry.custom, { ...newModel, id: newModel.id.trim(), name: newModel.name.trim() } as any] })
    setNewModel({ id: '', name: '', provider: 'anthropic', supportsVision: true })
  }
  function removeCustomModel(id: string) {
    saveRegistry({ disabled: registry.disabled.filter((x) => x !== id), custom: registry.custom.filter((m) => m.id !== id) })
  }
  async function saveFeatures(next: Record<string, FeatureCfg>) {
    setFeatures(next)
    await fetch(`/api/${app}/ai-features`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features: next }) })
  }
  const customIds = new Set(registry.custom.map((m) => m.id))
  const enabledModels = models.filter((m) => m.enabled)

  return (
    <div className="space-y-6">
      {/* ── Providers & API keys ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Providers & API keys</CardTitle>
          <CardDescription>
            Shared across all apps. Saving a key here overrides any value in <code>.env.local</code> — the key is
            tested automatically after saving. Add any OpenAI-compatible provider (OpenAI, OpenRouter, Mistral,
            Together, xAI, DeepSeek, Ollama…) with its base URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            ...BUILTIN_PROVIDERS.map((p) => ({ ...p, baseUrl: null as string | null, custom: false })),
            ...customProviders.map((p) => ({ provider: p.id, label: p.label, key: p.keyName, baseUrl: p.baseUrl, custom: true })),
          ].map((p) => {
            const t = tests[p.provider] ?? {}
            return (
              <div key={p.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">{p.label}</label>
                    {p.custom && <Badge variant="outline" className="text-[10px]">custom</Badge>}
                    {p.baseUrl && <span className="hidden truncate font-mono text-[11px] text-muted-foreground sm:inline">{p.baseUrl}</span>}
                  </div>
                  {t.valid === true && <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Valid</Badge>}
                  {t.valid === false && <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"><XCircle className="h-3 w-3" /> {t.error ?? 'Invalid'}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Input
                    type={revealed[p.key] ? 'text' : 'password'}
                    value={keys[p.key] ?? ''}
                    onChange={(e) => setKeys((k) => ({ ...k, [p.key]: e.target.value }))}
                    placeholder="••••••••••••••••"
                    className="h-9 font-mono text-sm"
                  />
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setRevealed((r) => ({ ...r, [p.key]: !r[p.key] }))}>
                    {revealed[p.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => saveKey(p.provider, p.key)} disabled={savingKey === p.key}>
                    {savingKey === p.key ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                  <Button size="sm" className="h-9 shrink-0 gap-1.5" onClick={() => testKey(p.provider)} disabled={t.testing}>
                    {t.testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Beaker className="h-4 w-4" />} Test
                  </Button>
                  {p.custom && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeProvider(p.provider)} title="Remove provider (and its models)">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Add custom provider */}
          <div className="space-y-1.5 rounded-md border border-dashed p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={newProvider.label} onChange={(e) => setNewProvider((p) => ({ ...p, label: e.target.value }))} placeholder="provider name (e.g. OpenRouter)" className="h-8 flex-1 min-w-[150px] text-xs" />
              <Input value={newProvider.baseUrl} onChange={(e) => setNewProvider((p) => ({ ...p, baseUrl: e.target.value }))} placeholder="base URL (e.g. https://openrouter.ai/api/v1)" className="h-8 flex-[2] min-w-[230px] font-mono text-xs" />
              <Button size="sm" className="h-8 gap-1.5" onClick={addProvider} disabled={!slugify(newProvider.label) || !newProvider.baseUrl.trim()}>
                <Plus className="h-3.5 w-3.5" /> Add provider
              </Button>
            </div>
            {providerError && <p className="text-xs text-destructive">{providerError}</p>}
            <p className="text-[11px] text-muted-foreground">Must speak the OpenAI chat-completions API. After adding, paste its API key above and add its models below.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Models ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Models</CardTitle>
          <CardDescription>Enable/disable models or add custom model IDs. A model is usable only when its provider key is set and it’s enabled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {models.map((m) => {
            const manuallyOff = registry.disabled.includes(m.id)
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-md border border-border/60 p-2.5">
                <Toggle on={!manuallyOff} onClick={() => toggleModel(m.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.name}</span>
                    <Badge variant="secondary" className="text-[10px] capitalize">{m.provider}</Badge>
                    {customIds.has(m.id) && <Badge variant="outline" className="text-[10px]">custom</Badge>}
                  </div>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{m.id}</p>
                </div>
                {m.enabled
                  ? <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Available</Badge>
                  : <Badge variant="outline" className="text-muted-foreground">{manuallyOff ? 'Off' : 'No key'}</Badge>}
                {customIds.has(m.id) && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeCustomModel(m.id)} title="Remove custom model">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )
          })}

          {/* Add custom model */}
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2.5">
            <Input value={newModel.id} onChange={(e) => setNewModel((m) => ({ ...m, id: e.target.value }))} placeholder="model id (e.g. claude-opus-4-8)" className="h-8 flex-1 min-w-[180px] font-mono text-xs" />
            <Input value={newModel.name} onChange={(e) => setNewModel((m) => ({ ...m, name: e.target.value }))} placeholder="display name" className="h-8 flex-1 min-w-[140px] text-xs" />
            <Select value={newModel.provider} onValueChange={(v) => v && setNewModel((m) => ({ ...m, provider: v }))}>
              <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent align="start" side="bottom" sideOffset={6} alignItemWithTrigger={false}>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
                {customProviders.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Toggle on={newModel.supportsVision} onClick={() => setNewModel((m) => ({ ...m, supportsVision: !m.supportsVision }))} /> Vision
            </label>
            <Button size="sm" className="h-8 gap-1.5" onClick={addCustomModel} disabled={!newModel.id.trim() || !newModel.name.trim()}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Feature gating (per app) ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI features · this app</CardTitle>
          <CardDescription>Turn AI on or off per feature for this app, and pick the model each uses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {catalog.map((f) => {
            const cfg = features[f.key] ?? { enabled: true, defaultModel: null, allowedModels: [] }
            return (
              <div key={f.key} className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 p-2.5">
                <Toggle on={cfg.enabled} onClick={() => saveFeatures({ ...features, [f.key]: { ...cfg, enabled: !cfg.enabled } })} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {f.key === 'automationHub' ? <Bot className="h-3.5 w-3.5 text-primary" /> : <Beaker className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-sm font-medium">{f.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.detail}</p>
                </div>
                <Select
                  value={cfg.defaultModel ?? ''}
                  onValueChange={(v) => saveFeatures({ ...features, [f.key]: { ...cfg, defaultModel: v || null } })}
                >
                  <SelectTrigger size="sm" className="w-48" disabled={!cfg.enabled}>
                    <SelectValue>{cfg.defaultModel ? (enabledModels.find((m) => m.id === cfg.defaultModel)?.name ?? cfg.defaultModel) : <span className="text-muted-foreground">Default model</span>}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start" side="bottom" sideOffset={6} alignItemWithTrigger={false}>
                    {enabledModels.length === 0 && <SelectItem value="" disabled>No enabled models</SelectItem>}
                    {enabledModels.map((m) => <SelectItem key={m.id} value={m.id} label={m.name}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
