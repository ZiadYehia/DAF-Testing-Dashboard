'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Network, Sparkles, Save, Search, ChevronLeft, Eye, Pencil, Database, FlaskConical, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { AppSelect } from '@/components/shared/AppSelect'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AIModel } from '@/lib/ai'
import type { FeatureSummary } from '@/lib/features'
import type { ModuleManifest } from '@/lib/modules'
import { useModels } from '@/hooks/useModels'

interface Story {
  key: string
  summary: string
  description: string
  status: string
  labels: string[]
  components: string[]
}


export default function ModuleKnowledgePage() {
  const params = useParams()
  const app = params?.app as string

  const { models, selectedModel, setSelectedModel } = useModels()
  const [module, setModule] = useState('')
  const [source, setSource] = useState<'local' | 'jira'>('local')

  const activeModels = models.length === 0
    ? [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' as const, requiredEnvKey: 'GEMINI_API_KEY', supportsVision: true, description: 'Best quality — supports screenshots', enabled: true },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' as const, requiredEnvKey: 'GEMINI_API_KEY', supportsVision: true, description: 'Highest quality — supports screenshots', enabled: true },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic' as const, requiredEnvKey: 'ANTHROPIC_API_KEY', supportsVision: false, description: 'Fast & lightweight', enabled: false },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' as const, requiredEnvKey: 'ANTHROPIC_API_KEY', supportsVision: false, description: 'High quality reasoning', enabled: false },
      ] as AIModel[]
    : models

  const [fetching, setFetching] = useState(false)
  const [stories, setStories] = useState<Story[] | null>(null)

  const [synthesizing, setSynthesizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [content, setContent] = useState('')
  const [savedFilename, setSavedFilename] = useState<string | null>(null)
  const [savedFeatureSlug, setSavedFeatureSlug] = useState<string | null>(null)
  const [preview, setPreview] = useState(true)

  // Save destination
  const [saveDestination, setSaveDestination] = useState<'knowledge' | 'module-knowledge' | 'feature'>('module-knowledge')
  const [selectedFeature, setSelectedFeature] = useState<string>('')
  const [selectedModuleSlug, setSelectedModuleSlug] = useState<string>('')
  const [features, setFeatures] = useState<FeatureSummary[]>([])
  const [knownModules, setKnownModules] = useState<ModuleManifest[]>([])

  useEffect(() => {
    const firstEnabled = models.find((m) => m.enabled)
    if (firstEnabled) setSelectedModel(firstEnabled.id)
  }, [models])

  useEffect(() => {
    fetch(`/api/${app}/features`)
      .then((r) => r.json())
      .then((data: FeatureSummary[]) => setFeatures(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch(`/api/${app}/modules`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: ModuleManifest[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setKnownModules(data)
          setSelectedModuleSlug(data[0].slug)
        }
      })
      .catch(() => {})
  }, [app])

  const handleFetch = async () => {
    setFetching(true)
    setStories(null)
    try {
      const params = new URLSearchParams({ source })
      if (module.trim()) params.set('module', module.trim())
      const res = await fetch(`/api/${app}/stories?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch stories')
      const items = (data.stories ?? []) as Story[]
      setStories(items)
      if (items.length === 0) {
        toast.info('No stories found for that module.')
      } else {
        // Auto-suggest: find a feature whose jiraKey matches any fetched story key
        const match = features.find((f) => f.jiraKey && items.some((s) => s.key === f.jiraKey))
        if (match) {
          setSaveDestination('feature')
          setSelectedFeature(match.name)
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch stories')
    }
    setFetching(false)
  }

  const handleSynthesize = async (save: boolean) => {
    if (!module.trim()) {
      toast.error('Enter a module name first')
      return
    }
    if (save && saveDestination === 'feature' && !selectedFeature) {
      toast.error('Select a feature to save to')
      return
    }
    if (save && saveDestination === 'module-knowledge' && !selectedModuleSlug) {
      toast.error('Select a module to save to')
      return
    }
    save ? setSaving(true) : setSynthesizing(true)
    try {
      const res = await fetch(`/api/${app}/stories/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: module.trim(),
          model: selectedModel,
          source,
          save,
          content: save ? content : undefined,
          featureSlug: save && saveDestination === 'feature' ? selectedFeature : undefined,
          moduleSlug: save && saveDestination === 'module-knowledge' ? selectedModuleSlug : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Synthesis failed')
      setContent(data.content ?? '')
      setPreview(true)
      if (save) {
        if (data.destination === 'feature' && data.featureSlug) {
          setSavedFeatureSlug(data.featureSlug)
          setSavedFilename(null)
          toast.success(`Saved to feature: ${data.featureSlug}`)
        } else if (data.destination === 'module-knowledge' && data.filename && data.moduleSlug) {
          setSavedFilename(data.filename)
          setSavedFeatureSlug(null)
          toast.success(`Saved to modules/${data.moduleSlug}/knowledge/${data.filename}`)
        } else if (data.filename) {
          setSavedFilename(data.filename)
          setSavedFeatureSlug(null)
          toast.success(`Saved to knowledge/${data.filename}`)
        }
      } else {
        toast.success(`Synthesized from ${data.storyCount} stories`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Synthesis failed')
    }
    save ? setSaving(false) : setSynthesizing(false)
  }

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/${app}/knowledge`} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Knowledge
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Network className="h-6 w-6" />
            Module Knowledge
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Pull user stories from the Jira board and synthesize domain knowledge for a module.
          </p>
        </div>
      </div>

      {/* Step 1 — pick module + fetch */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Step 1 — Choose a Module</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">AI Model:</span>
              <AppSelect
                options={activeModels.map((m) => ({
                  value: m.id,
                  label: m.name,
                  description: m.enabled ? m.provider : 'key required',
                  disabled: !m.enabled,
                }))}
                value={selectedModel}
                onChange={setSelectedModel}
                size="sm"
                className="min-w-[180px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Source:</span>
            <div className="inline-flex rounded-lg border border-input p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSource('local')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  source === 'local'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Local files
              </button>
              <button
                type="button"
                onClick={() => setSource('jira')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  source === 'jira'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Jira board
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder={
                source === 'local'
                  ? 'Filter by key/text (e.g. items-list, ABC-123, bulk import)'
                  : 'Module / Jira component (e.g. Orders Module)'
              }
              className="flex-1"
            />
            <Button onClick={handleFetch} disabled={fetching} variant="outline" className="gap-2">
              <Search className="h-4 w-4" />
              {fetching ? 'Fetching…' : 'Fetch stories'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {source === 'local' ? (
              <>
                Stories are read from <code>data/{app}/stories/</code>. Leave the filter blank to
                load every local story; otherwise the filter is matched against the story key
                or content (substring, case-insensitive).
              </>
            ) : (
              <>
                Stories are read from the configured Jira board (project{' '}
                <code>JIRA_PROJECT_KEY</code>). Leave the module blank to fetch all stories;
                otherwise it filters by Jira component.
              </>
            )}
          </p>

          {fetching && <Skeleton className="h-24 w-full" />}

          {stories && stories.length > 0 && (
            <div className="rounded-lg border border-input divide-y max-h-72 overflow-auto">
              {stories.map((s) => (
                <div key={s.key} className="px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{s.key}</Badge>
                    <span className="font-medium">{s.summary}</span>
                    {s.status && <span className="text-xs text-muted-foreground ml-auto">{s.status}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 — synthesize */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Step 2 — Synthesize Knowledge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Save destination picker */}
          <div className="rounded-lg border border-input bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Save to</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-input p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSaveDestination('module-knowledge')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                    saveDestination === 'module-knowledge'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className="h-3 w-3" /> Module Knowledge
                </button>
                <button
                  type="button"
                  onClick={() => setSaveDestination('knowledge')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                    saveDestination === 'knowledge'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Database className="h-3 w-3" /> App Knowledge
                </button>
                <button
                  type="button"
                  onClick={() => setSaveDestination('feature')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                    saveDestination === 'feature'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FlaskConical className="h-3 w-3" /> Feature
                </button>
              </div>
              {saveDestination === 'module-knowledge' && knownModules.length > 0 && (
                <AppSelect
                  options={knownModules.map((m) => ({ value: m.slug, label: m.name }))}
                  value={selectedModuleSlug}
                  onChange={setSelectedModuleSlug}
                  size="sm"
                  className="min-w-[180px]"
                />
              )}
              {saveDestination === 'feature' && (
                <AppSelect
                  options={features.map((f) => ({
                    value: f.name,
                    label: f.name,
                    description: f.jiraKey ?? undefined,
                  }))}
                  value={selectedFeature || null}
                  onChange={setSelectedFeature}
                  placeholder="Select feature…"
                  size="sm"
                  className="min-w-[200px]"
                />
              )}
            </div>
            {saveDestination === 'module-knowledge' && selectedModuleSlug && (
              <p className="text-xs text-muted-foreground">
                Will save to <code>modules/{selectedModuleSlug}/knowledge/</code> — injected for all features in the <strong>{knownModules.find(m => m.slug === selectedModuleSlug)?.name ?? selectedModuleSlug}</strong> module. Best for shared module context (roles, fields, lifecycle states).
              </p>
            )}
            {saveDestination === 'feature' && selectedFeature && (
              <p className="text-xs text-muted-foreground">
                Will save to <code>features/{selectedFeature}/knowledge.md</code> — used exclusively when generating test cases for that feature.
              </p>
            )}
            {saveDestination === 'knowledge' && (
              <p className="text-xs text-muted-foreground">
                Will save to <code>knowledge/</code> — injected for <em>all</em> features across all modules. Best for platform-wide writing rules and format guides.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => handleSynthesize(false)} disabled={synthesizing || saving} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {synthesizing ? 'Synthesizing…' : 'Synthesize preview'}
            </Button>
            {content && (
              <Button
                onClick={() => handleSynthesize(true)}
                disabled={saving || synthesizing || (saveDestination === 'feature' && !selectedFeature) || (saveDestination === 'module-knowledge' && !selectedModuleSlug)}
                variant="outline"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : saveDestination === 'feature' ? 'Save to Feature' : saveDestination === 'module-knowledge' ? 'Save to Module' : 'Save to App Knowledge'}
              </Button>
            )}
          </div>

          {synthesizing && (
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-48 w-full" />
            </div>
          )}

          {content && !synthesizing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {savedFeatureSlug ? (
                    <>Saved to <code>features/{savedFeatureSlug}/knowledge.md</code></>
                  ) : savedFilename && saveDestination === 'module-knowledge' ? (
                    <>Saved to <code>modules/{selectedModuleSlug}/knowledge/{savedFilename}</code></>
                  ) : savedFilename ? (
                    <>Saved to <code>data/{app}/knowledge/{savedFilename}</code></>
                  ) : (
                    'Preview — not yet saved'
                  )}
                </span>
                <button
                  onClick={() => setPreview((p) => !p)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {preview ? 'Edit' : 'Preview'}
                </button>
              </div>
              {preview ? (
                <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-input bg-muted/30 px-4 py-3 min-h-[300px] overflow-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[400px] resize-y font-mono text-sm"
                  spellCheck={false}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
