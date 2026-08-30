'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Sparkles,
  Loader2,
  ChevronDown,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  Pencil,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AppSelect } from '@/components/shared/AppSelect'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import type { ModuleManifest } from '@/lib/modules'
import type { Story } from '@/app/[app]/knowledge/stories/page'

// ─── Types ────────────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9-]+$/
const PRIORITY_OPTIONS = ['P1', 'P2', 'P3', 'P4']

type FlowStatus = 'idle' | 'generating' | 'preview' | 'applying' | 'done'

interface ProposedFeatureRow {
  slug: string
  title: string
  module: string | null
  knowledge: string
  exists: boolean
  include: boolean
  previewKnowledge: boolean
}

interface ProposedFrRow {
  id: string
  requirement: string
  module: string
  priority: string
  include: boolean
}

interface StoryResult {
  storyKey: string
  summary: string
  features: ProposedFeatureRow[]
  frs: ProposedFrRow[]
  error: string | null
  collapsed: boolean
}

interface ApplyResultItem {
  storyKey: string
  featuresCreated: string[]
  featuresSkipped: { slug: string; reason: string }[]
  frsAdded: string[]
  frsSkipped: string[]
  error?: string
}

interface StoryBreakdownFlowProps {
  app: string
  selectedStories: Story[]
  model: string
  knownModules: ModuleManifest[]
  existingFeatures: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStoryResult(storyKey: string, fallbackSummary: string, data: {
  story?: { key: string; summary: string }
  features?: Array<{ slug: string; title: string; module: string | null; knowledge: string; exists: boolean }>
  frs?: Array<{ id: string; requirement: string; module: string; priority: string }>
}): StoryResult {
  return {
    storyKey,
    summary: data.story?.summary ?? fallbackSummary,
    error: null,
    collapsed: false,
    features: (data.features ?? []).map((f) => ({
      slug: f.slug,
      title: f.title,
      module: f.module ?? null,
      knowledge: f.knowledge ?? '',
      exists: !!f.exists,
      include: true,
      previewKnowledge: true,
    })),
    frs: (data.frs ?? []).map((r) => ({
      id: r.id,
      requirement: r.requirement,
      module: r.module ?? '',
      priority: r.priority || 'P2',
      include: true,
    })),
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StoryBreakdownFlow({ app, selectedStories, model, knownModules, existingFeatures }: StoryBreakdownFlowProps) {
  const [status, setStatus] = useState<FlowStatus>('idle')
  const [guidance, setGuidance] = useState('')
  const [moduleScope, setModuleScope] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null)
  const [results, setResults] = useState<StoryResult[]>([])
  const [applyResults, setApplyResults] = useState<ApplyResultItem[] | null>(null)

  const fetchBreakdown = async (storyKey: string, priorProposedFRs: ProposedFrRow[]) => {
    const res = await fetch(`/api/${app}/stories/breakdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyKey,
        model,
        module: moduleScope,
        guidance: guidance.trim() || undefined,
        priorProposedFRs: priorProposedFRs.map(({ id, requirement, module, priority }) => ({ id, requirement, module, priority })),
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Breakdown failed')
    return data
  }

  const handleGenerate = async () => {
    if (selectedStories.length === 0) {
      toast.error('Select at least one story first')
      return
    }
    setStatus('generating')
    setApplyResults(null)
    setResults(
      selectedStories.map((s) => ({ storyKey: s.key, summary: s.summary, features: [], frs: [], error: null, collapsed: false })),
    )

    let priorFrs: ProposedFrRow[] = []
    for (let i = 0; i < selectedStories.length; i++) {
      setProgress({ i: i + 1, n: selectedStories.length })
      try {
        const data = await fetchBreakdown(selectedStories[i].key, priorFrs)
        const row = toStoryResult(selectedStories[i].key, selectedStories[i].summary, data)
        priorFrs = priorFrs.concat(row.frs)
        setResults((prev) => prev.map((r, idx) => (idx === i ? row : r)))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Breakdown failed'
        setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, error: message } : r)))
      }
    }
    setProgress(null)
    setStatus('preview')
  }

  const handleRetry = async (index: number) => {
    setResults((prev) => prev.map((r, idx) => (idx === index ? { ...r, error: null } : r)))
    const priorFrs = results.filter((r, idx) => idx !== index && !r.error).flatMap((r) => r.frs)
    try {
      const data = await fetchBreakdown(results[index].storyKey, priorFrs)
      const row = toStoryResult(results[index].storyKey, results[index].summary, data)
      setResults((prev) => prev.map((r, idx) => (idx === index ? row : r)))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Breakdown failed'
      setResults((prev) => prev.map((r, idx) => (idx === index ? { ...r, error: message } : r)))
    }
  }

  const updateFeature = (storyIdx: number, featIdx: number, patch: Partial<ProposedFeatureRow>) => {
    setResults((prev) =>
      prev.map((r, ri) => (ri !== storyIdx ? r : { ...r, features: r.features.map((f, fi) => (fi !== featIdx ? f : { ...f, ...patch })) })),
    )
  }

  const updateFr = (storyIdx: number, frIdx: number, patch: Partial<ProposedFrRow>) => {
    setResults((prev) =>
      prev.map((r, ri) => (ri !== storyIdx ? r : { ...r, frs: r.frs.map((x, xi) => (xi !== frIdx ? x : { ...x, ...patch })) })),
    )
  }

  const toggleStoryInclude = (storyIdx: number, include: boolean) => {
    setResults((prev) =>
      prev.map((r, ri) =>
        ri !== storyIdx ? r : { ...r, features: r.features.map((f) => ({ ...f, include })), frs: r.frs.map((x) => ({ ...x, include })) },
      ),
    )
  }

  const toggleCollapse = (storyIdx: number) => {
    setResults((prev) => prev.map((r, ri) => (ri !== storyIdx ? r : { ...r, collapsed: !r.collapsed })))
  }

  const handleReset = () => {
    setStatus('idle')
    setResults([])
    setApplyResults(null)
    setProgress(null)
  }

  const includedFeatureCount = results.reduce((n, r) => n + r.features.filter((f) => f.include).length, 0)
  const includedFrCount = results.reduce((n, r) => n + r.frs.filter((x) => x.include).length, 0)

  const handleApply = async () => {
    setStatus('applying')
    try {
      const items = results
        .filter((r) => !r.error)
        .map((r) => ({
          storyKey: r.storyKey,
          features: r.features.filter((f) => f.include).map((f) => ({ slug: f.slug, module: f.module, knowledge: f.knowledge })),
          frs: r.frs.filter((x) => x.include).map((x) => ({ id: x.id, requirement: x.requirement, module: x.module, priority: x.priority })),
        }))
        .filter((item) => item.features.length > 0 || item.frs.length > 0)

      if (items.length === 0) {
        toast.error('Nothing selected to create')
        setStatus('preview')
        return
      }

      const res = await fetch(`/api/${app}/stories/breakdown/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleScope, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Apply failed')

      const applied = (data.results ?? []) as ApplyResultItem[]
      setApplyResults(applied)
      applied.forEach((r) => {
        if (r.error) {
          toast.error(`${r.storyKey}: ${r.error}`)
        } else {
          const parts: string[] = []
          if (r.featuresCreated.length) parts.push(`${r.featuresCreated.length} feature(s)`)
          if (r.frsAdded.length) parts.push(`${r.frsAdded.length} FR(s)`)
          toast.success(`${r.storyKey}: created ${parts.join(', ') || 'nothing new'}`)
        }
      })
      setStatus('done')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Apply failed')
      setStatus('preview')
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Step 2 — Break Stories into Features</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'idle' && (
          <>
            {selectedStories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select one or more stories above to break them down into features, per-feature knowledge, and
                functional requirements.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {selectedStories.length} stor{selectedStories.length === 1 ? 'y' : 'ies'} selected:{' '}
                {selectedStories.map((s) => s.key).join(', ')}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Module scope:</span>
              <AppSelect
                options={[{ value: '__none__', label: 'No module scope' }, ...knownModules.map((m) => ({ value: m.slug, label: m.name }))]}
                value={moduleScope ?? '__none__'}
                onChange={(v) => setModuleScope(v === '__none__' ? null : v)}
                size="sm"
                className="min-w-[180px]"
              />
            </div>
            <Textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder="Guidance (optional) — e.g. focus on validation rules; skip anything already covered"
              rows={2}
            />
            <Button onClick={handleGenerate} disabled={selectedStories.length === 0} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate breakdown
            </Button>
          </>
        )}

        {status === 'generating' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {progress ? `Breaking down story ${progress.i} of ${progress.n}…` : 'Starting…'}
            </p>
            <div className="space-y-2">
              {results.map((r, i) => (
                <StoryCard
                  key={r.storyKey}
                  result={r}
                  editable={false}
                  isCurrent={!!progress && i === progress.i - 1}
                  knownModules={knownModules}
                  existingFeatures={existingFeatures}
                  onToggleCollapse={() => toggleCollapse(i)}
                  onToggleStoryInclude={() => {}}
                  onUpdateFeature={() => {}}
                  onUpdateFr={() => {}}
                  onRetry={() => {}}
                />
              ))}
            </div>
          </div>
        )}

        {(status === 'preview' || status === 'applying') && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {includedFeatureCount} feature{includedFeatureCount === 1 ? '' : 's'} + {includedFrCount} requirement
              {includedFrCount === 1 ? '' : 's'} selected — uncheck any you don&apos;t want, or edit inline.
            </p>
            <div className="space-y-2">
              {results.map((r, i) => (
                <StoryCard
                  key={r.storyKey}
                  result={r}
                  editable={status === 'preview'}
                  isCurrent={false}
                  knownModules={knownModules}
                  existingFeatures={existingFeatures}
                  onToggleCollapse={() => toggleCollapse(i)}
                  onToggleStoryInclude={(include) => toggleStoryInclude(i, include)}
                  onUpdateFeature={(featIdx, patch) => updateFeature(i, featIdx, patch)}
                  onUpdateFr={(frIdx, patch) => updateFr(i, frIdx, patch)}
                  onRetry={() => handleRetry(i)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" onClick={handleReset} disabled={status === 'applying'}>
                Start over
              </Button>
              <Button
                onClick={handleApply}
                disabled={status === 'applying' || (includedFeatureCount === 0 && includedFrCount === 0)}
                className="gap-2"
              >
                {status === 'applying' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Applying…
                  </>
                ) : (
                  <>
                    Create {includedFeatureCount} feature{includedFeatureCount === 1 ? '' : 's'} + {includedFrCount}{' '}
                    requirement{includedFrCount === 1 ? '' : 's'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {status === 'done' && applyResults && (
          <div className="space-y-3">
            <div className="space-y-2">
              {applyResults.map((r) => (
                <div key={r.storyKey} className="rounded-lg border border-input p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{r.storyKey}</Badge>
                    {r.error ? (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> {r.error}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </span>
                    )}
                  </div>
                  {!r.error && (
                    <p className="text-xs text-muted-foreground">
                      {r.featuresCreated.length} feature{r.featuresCreated.length === 1 ? '' : 's'} created
                      {r.featuresSkipped.length > 0 &&
                        `, skipped: ${r.featuresSkipped.map((s) => `${s.slug} (${s.reason})`).join(', ')}`}
                      {' · '}
                      {r.frsAdded.length} requirement{r.frsAdded.length === 1 ? '' : 's'} added
                      {r.frsSkipped.length > 0 && `, ${r.frsSkipped.length} skipped (duplicate id)`}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Link href={`/${app}/features`} className="text-xs text-primary hover:underline flex items-center gap-1">
                View features <ArrowRight className="h-3 w-3" />
              </Link>
              <Link href={`/${app}/requirements`} className="text-xs text-primary hover:underline flex items-center gap-1">
                View requirements <ArrowRight className="h-3 w-3" />
              </Link>
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 ml-auto">
                <RotateCcw className="h-3.5 w-3.5" /> Start over
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Story card ───────────────────────────────────────────────────────────────

function StoryCard({
  result,
  editable,
  isCurrent,
  knownModules,
  existingFeatures,
  onToggleCollapse,
  onToggleStoryInclude,
  onUpdateFeature,
  onUpdateFr,
  onRetry,
}: {
  result: StoryResult
  editable: boolean
  isCurrent: boolean
  knownModules: ModuleManifest[]
  existingFeatures: string[]
  onToggleCollapse: () => void
  onToggleStoryInclude: (include: boolean) => void
  onUpdateFeature: (featIdx: number, patch: Partial<ProposedFeatureRow>) => void
  onUpdateFr: (frIdx: number, patch: Partial<ProposedFrRow>) => void
  onRetry: () => void
}) {
  const hasData = result.features.length > 0 || result.frs.length > 0
  const allIncluded = result.features.every((f) => f.include) && result.frs.every((x) => x.include)

  return (
    <div className="rounded-lg border border-input overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
        {editable && hasData && (
          <input
            type="checkbox"
            checked={allIncluded}
            onChange={(e) => onToggleStoryInclude(e.target.checked)}
            className="h-4 w-4 accent-primary shrink-0"
            aria-label={`Include ${result.storyKey}`}
          />
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          disabled={!hasData}
        >
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
              result.collapsed ? '-rotate-90' : '',
            )}
          />
          <Badge variant="secondary" className="text-xs shrink-0">{result.storyKey}</Badge>
          <span className="text-sm font-medium truncate">{result.summary}</span>
        </button>
        {result.error ? (
          <span className="text-xs text-destructive flex items-center gap-1.5 shrink-0">
            <XCircle className="h-3.5 w-3.5" /> {result.error}
            <Button size="xs" variant="outline" onClick={onRetry} className="gap-1">
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </span>
        ) : !hasData && isCurrent ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
        ) : !hasData ? (
          <span className="text-xs text-muted-foreground shrink-0">Queued…</span>
        ) : (
          <span className="text-xs text-muted-foreground shrink-0">
            {result.features.length} feature{result.features.length === 1 ? '' : 's'} · {result.frs.length} FR
            {result.frs.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {!result.collapsed && hasData && (
        <div className="p-3 space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Features</p>
            {result.features.map((f, fi) => (
              <FeatureRow
                key={fi}
                feature={f}
                editable={editable}
                knownModules={knownModules}
                existingFeatures={existingFeatures}
                onChange={(patch) => onUpdateFeature(fi, patch)}
              />
            ))}
          </div>
          {result.frs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Requirements</p>
              <div className="space-y-1.5">
                {result.frs.map((r, ri) => (
                  <FrRow key={ri} fr={r} editable={editable} onChange={(patch) => onUpdateFr(ri, patch)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Feature row ──────────────────────────────────────────────────────────────

function FeatureRow({
  feature,
  editable,
  knownModules,
  existingFeatures,
  onChange,
}: {
  feature: ProposedFeatureRow
  editable: boolean
  knownModules: ModuleManifest[]
  existingFeatures: string[]
  onChange: (patch: Partial<ProposedFeatureRow>) => void
}) {
  const slugValid = SLUG_RE.test(feature.slug)
  const existsNow = existingFeatures.includes(feature.slug)

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2 transition-opacity',
        feature.include ? 'border-border' : 'border-border/40 opacity-50',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={feature.include}
          onChange={(e) => onChange({ include: e.target.checked })}
          className="h-4 w-4 accent-primary shrink-0"
          aria-label={`Include feature ${feature.slug}`}
          disabled={!editable}
        />
        <span className="text-sm font-medium">{feature.title}</span>
        {existsNow && (
          <Badge
            variant="outline"
            className="text-xs text-amber-600 dark:text-amber-400 border-amber-200/70 dark:border-amber-500/20"
          >
            already exists — will be skipped
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[160px] space-y-1">
          <Input
            value={feature.slug}
            onChange={(e) => onChange({ slug: e.target.value })}
            className="font-mono h-7 text-xs"
            disabled={!editable || !feature.include}
            aria-invalid={!slugValid}
          />
          {!slugValid && (
            <p className="text-[11px] text-destructive">Slug must be lowercase letters, numbers, and hyphens only.</p>
          )}
        </div>
        <AppSelect
          options={[{ value: '__none__', label: 'No module' }, ...knownModules.map((m) => ({ value: m.slug, label: m.name }))]}
          value={feature.module ?? '__none__'}
          onChange={(v) => onChange({ module: v === '__none__' ? null : v })}
          size="sm"
          disabled={!editable || !feature.include}
          className="min-w-[140px]"
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Knowledge</span>
          <button
            type="button"
            onClick={() => onChange({ previewKnowledge: !feature.previewKnowledge })}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {feature.previewKnowledge ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {feature.previewKnowledge ? 'Edit' : 'Preview'}
          </button>
        </div>
        {feature.previewKnowledge ? (
          <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-input bg-muted/30 px-3 py-2 max-h-56 overflow-auto text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{feature.knowledge || '*(empty)*'}</ReactMarkdown>
          </div>
        ) : (
          <Textarea
            value={feature.knowledge}
            onChange={(e) => onChange({ knowledge: e.target.value })}
            className="min-h-[140px] resize-y font-mono text-xs"
            spellCheck={false}
            disabled={!editable || !feature.include}
          />
        )}
      </div>
    </div>
  )
}

// ─── FR row ───────────────────────────────────────────────────────────────────

function FrRow({ fr, editable, onChange }: { fr: ProposedFrRow; editable: boolean; onChange: (patch: Partial<ProposedFrRow>) => void }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 space-y-1.5 transition-opacity',
        fr.include ? 'border-border' : 'border-border/40 opacity-50',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={fr.include}
          onChange={(e) => onChange({ include: e.target.checked })}
          className="h-4 w-4 accent-primary shrink-0"
          aria-label={`Include ${fr.id}`}
          disabled={!editable}
        />
        <Input
          value={fr.id}
          onChange={(e) => onChange({ id: e.target.value })}
          className="font-mono h-7 text-xs w-40"
          disabled={!editable || !fr.include}
        />
        <Input
          value={fr.module}
          onChange={(e) => onChange({ module: e.target.value })}
          className="h-7 text-xs w-32"
          placeholder="Module"
          disabled={!editable || !fr.include}
        />
        <AppSelect
          options={PRIORITY_OPTIONS.map((o) => ({ value: o, label: o }))}
          value={fr.priority}
          onChange={(v) => onChange({ priority: v })}
          variant="inline"
          disabled={!editable || !fr.include}
        />
      </div>
      <Textarea
        value={fr.requirement}
        onChange={(e) => onChange({ requirement: e.target.value })}
        rows={2}
        className="text-xs"
        disabled={!editable || !fr.include}
      />
    </div>
  )
}
