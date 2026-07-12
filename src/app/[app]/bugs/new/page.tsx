'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Sparkles, Save, Eye, Pencil } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AIModel, GeneratedBugReport } from '@/lib/ai'
import { useStreamingGenerate } from '@/hooks/useStreamingGenerate'
import { AIProgressBar } from '@/components/shared/AIProgressBar'
import { AppSelect } from '@/components/shared/AppSelect'
import { ContextWarningBanner } from '@/components/shared/ContextWarningBanner'
import { useBugFormat } from '@/hooks/useBugFormat'
import { useModels } from '@/hooks/useModels'
import { BUG_TYPE_OPTIONS, LAYER_OPTIONS, type BugLayer } from '@/lib/bug-format'

// AI-generated report, extended with the fields the generate route now returns
// (layer classification + optional severity) — kept as a local intersection so
// this file compiles regardless of exactly when ai.ts picks up the new fields.
type GeneratedBugReportExt = GeneratedBugReport & { layer?: string; severity?: string }

/** Keep the bug's current value selectable even if it's since fallen out of the configured option list. */
function withCurrentValue(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options
}

export default function NewBugPage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const app = params?.app as string
  const parts = pathname?.split('/') ?? []
  const appIdx = parts.indexOf(app)
  const bugsIdx = parts.indexOf('bugs', appIdx)
  const moduleSlug = bugsIdx > appIdx + 1 ? parts[appIdx + 1] : null
  const bugsBase = moduleSlug ? `/${app}/${moduleSlug}/bugs` : `/${app}/bugs`

  const { models, selectedModel, setSelectedModel } = useModels()
  const [features, setFeatures] = useState<string[]>([])

  const activeModels = models.length === 0
    ? [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' as const, requiredEnvKey: 'GEMINI_API_KEY', supportsVision: true, description: 'Best quality — supports screenshots', enabled: true },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' as const, requiredEnvKey: 'GEMINI_API_KEY', supportsVision: true, description: 'Highest quality — supports screenshots', enabled: true },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic' as const, requiredEnvKey: 'ANTHROPIC_API_KEY', supportsVision: false, description: 'Fast & lightweight', enabled: false },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' as const, requiredEnvKey: 'ANTHROPIC_API_KEY', supportsVision: false, description: 'High quality reasoning', enabled: false },
      ] as AIModel[]
    : models
  const [notes, setNotes] = useState('')
  const { generate, generating, phase, warning, dismissWarning } = useStreamingGenerate<GeneratedBugReportExt>()
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)

  // Generated / editable fields
  const [generated, setGenerated] = useState(false)
  const [title, setTitle] = useState('')
  const [feature, setFeature] = useState('')
  const [priority, setPriority] = useState('P3 – Medium')
  const [bugType, setBugType] = useState('Functional')
  const [severity, setSeverity] = useState('')
  const [layer, setLayer] = useState<BugLayer>('unknown')
  const [bugScope, setBugScope] = useState<'epic' | 'story'>('epic')
  const [parentKey, setParentKey] = useState('')
  const [body, setBody] = useState('')

  // Which fields to show/require follows the scope currently chosen — 'epic' and
  // 'story' line up 1:1 with the config's variant keys.
  const { config } = useBugFormat(app)
  const variantConfig = config[bugScope]

  // Load features
  useEffect(() => {
    const featuresUrl = moduleSlug ? `/api/${app}/features?module=${moduleSlug}` : `/api/${app}/features`
    fetch(featuresUrl)
      .then((r) => r.json())
      .then((data: { name: string }[]) => setFeatures(data.map((f) => f.name)))
  }, [app, moduleSlug])

  const handleGenerate = async () => {
    if (!notes.trim()) {
      toast.error('Please describe the bug first')
      return
    }
    try {
      const data = await generate(`/api/${app}/bugs/generate`, { notes, model: selectedModel, variant: bugScope })
      if (!data) return
      setTitle(data.title ?? '')
      const aiFeature = data.feature ?? ''
      setFeature(features.includes(aiFeature) ? aiFeature : (features[0] ?? ''))
      setPriority(data.priority ?? 'P3 – Medium')
      setBugType(data.bug_type ?? 'Functional')
      setBody(data.body ?? '')
      setSeverity(data.severity ?? '')
      setLayer((data.layer as BugLayer) ?? 'unknown')
      setGenerated(true)
      toast.success('Bug report generated!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !feature || !body.trim()) {
      toast.error('Title, feature, and body are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/${app}/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, feature, priority, bug_type: bugType, severity, layer, body,
          parent_key: bugScope === 'story' && parentKey.trim() ? parentKey.trim() : null,
          module: moduleSlug,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast.success('Bug report saved!')
      router.push(`${bugsBase}/${data.feature}/${data.slug}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={bugsBase}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Bug Report</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Describe the bug, generate a structured report, then save it</p>
        </div>
      </div>

      {/* Step 1 — Describe & Generate */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Step 1 — Describe the Bug</CardTitle>
            {/* Model selector */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">AI Model:</span>
              <AppSelect
                options={activeModels.map((m) => ({
                  value: m.id,
                  label: m.name,
                  description: m.enabled ? m.description : m.description + ' — key required',
                  disabled: !m.enabled,
                }))}
                value={selectedModel}
                onChange={setSelectedModel}
                size="sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Describe the bug in your own words — rough notes are fine.&#10;&#10;Example: When I scan a barcode in the incident module, the product shows up briefly and then disappears from the list. This happens with controlled drugs only. I'm logged in as pharmacist."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[140px] resize-y font-mono text-sm"
          />
          <Button
            onClick={handleGenerate}
            disabled={generating || !notes.trim()}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? 'Generating…' : 'Generate Report'}
          </Button>
          {generating && <AIProgressBar phase={phase} />}
          {warning && warning.length > 0 && (
            <ContextWarningBanner missing={warning} onDismiss={dismissWarning} href={`/${app}/settings`} actionLabel="Review app profile" />
          )}
        </CardContent>
      </Card>

      {generated && !generating && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Step 2 — Review &amp; Edit</CardTitle>
              <button
                onClick={() => setPreview((p) => !p)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                placeholder="Bug title"
              />
            </div>

            {/* Meta row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Feature</label>
                <AppSelect
                  options={features.map((f) => ({ value: f, label: f }))}
                  value={feature || null}
                  onChange={setFeature}
                  placeholder="Pick a feature"
                  className="w-full"
                />
              </div>
              {variantConfig.fields.priority && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Priority</label>
                  <AppSelect
                    options={withCurrentValue(config.priorityOptions, priority).map((p) => ({ value: p, label: p }))}
                    value={priority}
                    onChange={setPriority}
                    className="w-full"
                  />
                </div>
              )}
              {variantConfig.fields.severity && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Severity</label>
                  <AppSelect
                    options={withCurrentValue(config.severityOptions, severity).map((s) => ({ value: s, label: s }))}
                    value={severity || null}
                    onChange={setSeverity}
                    placeholder="Pick a severity"
                    className="w-full"
                  />
                </div>
              )}
              {variantConfig.fields.bugType && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Bug Type</label>
                  <AppSelect
                    options={withCurrentValue(BUG_TYPE_OPTIONS, bugType).map((t) => ({ value: t, label: t }))}
                    value={bugType}
                    onChange={setBugType}
                    className="w-full"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Layer</label>
                <AppSelect
                  options={LAYER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  value={layer}
                  onChange={(v) => setLayer(v as BugLayer)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Bug Scope row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bug Scope</label>
                <AppSelect
                  options={[
                    { value: 'epic',  label: 'Epic Bug',  description: 'Standard Bug issue' },
                    { value: 'story', label: 'Story Bug', description: 'Test subtask under a story' },
                  ]}
                  value={bugScope}
                  onChange={(v) => { setBugScope(v as 'epic' | 'story'); if (v === 'epic') setParentKey('') }}
                  className="w-full"
                />
              </div>
              {bugScope === 'story' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Parent Story Key</label>
                  <Input
                    value={parentKey}
                    onChange={(e) => setParentKey(e.target.value.toUpperCase())}
                    placeholder="e.g. DT-2840"
                  />
                </div>
              )}
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Report Body</label>
              {preview ? (
                <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-input bg-muted/30 px-4 py-3 min-h-[300px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[300px] resize-y font-mono text-sm"
                />
              )}
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save as Draft'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Saved to <code className="text-xs">data/{app}/bugs/{feature || '…'}/…</code>
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
