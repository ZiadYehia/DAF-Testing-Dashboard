'use client'

// Full-page create flow for Change Requests — mirrors bugs/new/page.tsx's
// describe -> generate -> review/edit -> save structure. Ports the create-path
// logic that used to live in ChangeRequestDialog.tsx (which now only handles
// edit); same endpoints, same request/response shapes.

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Sparkles, Send, GitPullRequestArrow, ChevronDown, Check } from 'lucide-react'
import Link from 'next/link'
import { Combobox } from '@base-ui/react/combobox'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppSelect } from '@/components/shared/AppSelect'
import { AIProgressBar } from '@/components/shared/AIProgressBar'
import { useStreamingGenerate } from '@/hooks/useStreamingGenerate'
import { useCrFormat } from '@/hooks/useCrFormat'
import { useModels } from '@/hooks/useModels'
import { cn } from '@/lib/utils'
import type { AIModel, GeneratedChangeRequest } from '@/lib/ai'
import type { CrParentType } from '@/lib/cr-format'
import type { ChangeRequestRecord } from '@/components/change-requests/ChangeRequestDialog'

const PRIORITY_OPTIONS = ['P1', 'P2', 'P3', 'P4']

/** Keep the CR's current value selectable even if it's since fallen out of the configured option list. */
function withCurrentValue(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options
}

/** A story/epic offered in the affected-parent picker when no parent is preset. */
interface CrCandidateStory {
  key: string
  summary: string
  status?: string
  labels?: string[]
  components?: string[]
}

export default function NewChangeRequestPage() {
  return (
    <Suspense fallback={null}>
      <NewChangeRequestPageInner />
    </Suspense>
  )
}

function NewChangeRequestPageInner() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const app = params?.app as string

  // Same module-derivation pattern as bugs/new: the `[prefix]` dynamic segment
  // sits directly after the app slug when this route is reached via a
  // module's wrapper page (`[app]/[prefix]/change-requests/new`).
  const parts = pathname?.split('/') ?? []
  const appIdx = parts.indexOf(app)
  const crIdx = parts.indexOf('change-requests', appIdx)
  const moduleSlug = crIdx > appIdx + 1 ? parts[appIdx + 1] : null
  const crBase = moduleSlug ? `/${app}/${moduleSlug}/change-requests` : `/${app}/change-requests`

  // Preset parent (Stories view's "New CR" action) arrives via query params —
  // when present, the picker is skipped and generation runs in CONTEXT mode.
  const presetParentKey = searchParams.get('parentKey')
  const presetParentType = (searchParams.get('parentType') as CrParentType | null) ?? undefined
  const presetParentSummary = searchParams.get('parentSummary') ?? undefined
  const hasPresetParent = !!presetParentKey

  const { models, selectedModel, setSelectedModel } = useModels()

  // Per-app CR default model (Settings → AI & Models). Pre-selects the
  // configured model but leaves the user free to change it afterward.
  useEffect(() => {
    fetch(`/api/${app}/ai-features`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const defaultModel = d?.features?.changeRequest?.defaultModel
        if (defaultModel) setSelectedModel(defaultModel)
      })
      .catch(() => {})
  }, [app])

  const activeModels = models.length === 0
    ? [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' as const, requiredEnvKey: 'GEMINI_API_KEY', supportsVision: true, description: 'Best quality — supports screenshots', enabled: true },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' as const, requiredEnvKey: 'GEMINI_API_KEY', supportsVision: true, description: 'Highest quality — supports screenshots', enabled: true },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic' as const, requiredEnvKey: 'ANTHROPIC_API_KEY', supportsVision: false, description: 'Fast & lightweight', enabled: false },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' as const, requiredEnvKey: 'ANTHROPIC_API_KEY', supportsVision: false, description: 'High quality reasoning', enabled: false },
      ] as AIModel[]
    : models

  const { config } = useCrFormat(app)
  const { generate, generating, phase } = useStreamingGenerate<GeneratedChangeRequest & { suggestedParentKey: string | null }>()

  const [notes, setNotes] = useState('')
  // Affected-parent picker state (no-preset mode only).
  const [stories, setStories] = useState<CrCandidateStory[]>([])
  const [storiesLoading, setStoriesLoading] = useState(false)
  const [parentKeyInput, setParentKeyInput] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [changeType, setChangeType] = useState('')
  const [priority, setPriority] = useState('P2')
  const [saving, setSaving] = useState(false)
  const [generated, setGenerated] = useState(false)

  const parentKey = hasPresetParent ? presetParentKey! : parentKeyInput.trim()
  const selectedStory = stories.find((s) => s.key === parentKeyInput.trim()) ?? null

  // Default the change type once the app's CR format loads.
  useEffect(() => {
    setChangeType((prev) => prev || config.changeTypes[0] || '')
  }, [config])

  // Module-scoped candidate list for the picker + the "suggest a parent" AI
  // pass — same endpoint the Stories view itself reads from.
  useEffect(() => {
    if (hasPresetParent) return
    setStoriesLoading(true)
    fetch(`/api/${app}/stories${moduleSlug ? `?module=${moduleSlug}` : ''}`)
      .then((r) => (r.ok ? r.json() : { stories: [] }))
      .then((data: { stories?: CrCandidateStory[] }) => setStories(data.stories ?? []))
      .catch(() => setStories([]))
      .finally(() => setStoriesLoading(false))
  }, [app, moduleSlug, hasPresetParent])

  const changeTypeOptions = withCurrentValue(config.changeTypes, changeType)

  const handleGenerate = async () => {
    if (!notes.trim()) {
      toast.error('Describe the change first.')
      return
    }
    try {
      const data = hasPresetParent
        ? await generate(`/api/${app}/change-requests/generate`, {
            notes,
            model: selectedModel,
            parentKey,
            parentType: presetParentType,
            parentSummary: presetParentSummary,
          })
        : await generate(`/api/${app}/change-requests/generate`, {
            notes,
            model: selectedModel,
            module: moduleSlug ?? undefined,
            candidates: stories.map((s) => ({ key: s.key, summary: s.summary })),
          })
      if (!data) return
      setSummary(data.summary ?? '')
      setDescription(data.description ?? '')
      setChangeType(data.changeType || config.changeTypes[0] || '')
      setPriority(data.priority ?? 'P2')
      // Pre-fill the AI's suggested parent key (any key, even one not in the
      // fetched candidate list). The user can retype it or pick another.
      if (!hasPresetParent && data.suggestedParentKey) {
        setParentKeyInput(data.suggestedParentKey)
      }
      setGenerated(true)
      toast.success('Change Request drafted — review and create.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  const handleSave = async () => {
    if (!summary.trim() || !description.trim() || !changeType.trim() || !priority.trim()) {
      toast.error('Summary, description, change type, and priority are required.')
      return
    }
    if (!parentKey) {
      toast.error('Select the affected story/epic first.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/${app}/change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentKey,
          parentType: hasPresetParent ? presetParentType : undefined,
          summary,
          description,
          changeType,
          priority,
          module: moduleSlug ?? null,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 502 && data?.changeRequest) {
        // Local row saved, Jira push failed — the CR isn't lost (it can be
        // retried from the list's Sync action), so still navigate back to it.
        toast.warning(`Saved locally, but the Jira push failed: ${data.error ?? 'unknown error'}`)
        router.push(crBase)
        return
      }
      if (!res.ok) throw new Error(data?.error ?? 'Failed to create Change Request')

      const cr = data as ChangeRequestRecord
      toast.success(`Change Request created${cr.crKey ? ` as ${cr.crKey}` : ''}.`)
      router.push(crBase)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save Change Request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={crBase}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitPullRequestArrow className="h-6 w-6" />
            New Change Request
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {hasPresetParent
              ? `Filed against ${presetParentKey}${presetParentSummary ? ` — ${presetParentSummary}` : ''}`
              : 'Describe the change, generate a draft, then review and create.'}
          </p>
        </div>
      </div>

      {/* Step 1 — Describe & Generate */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Step 1 — Describe the Change</CardTitle>
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
            placeholder="Describe, in your own words, what came up and how it changes scope — rough notes are fine.&#10;&#10;Example: On today's call the client asked for a bulk-export option on the items list, in addition to single-item export. This wasn't in the original story."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[140px] resize-y text-sm"
            disabled={generating}
          />
          <Button
            onClick={handleGenerate}
            disabled={generating || !notes.trim()}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate'}
          </Button>
          {generating && <AIProgressBar phase={phase} />}
        </CardContent>
      </Card>

      {generated && !generating && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step 2 — Review &amp; Edit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasPresetParent && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Affected story/epic</label>
                <Input
                  value={parentKeyInput}
                  onChange={(e) => setParentKeyInput(e.target.value.toUpperCase())}
                  placeholder="Parent story/epic key — e.g. DT-1234"
                  disabled={saving}
                  className="font-mono"
                />
                <Combobox.Root<CrCandidateStory>
                  items={stories}
                  value={selectedStory}
                  onValueChange={(story) => setParentKeyInput(story?.key ?? '')}
                  itemToStringLabel={(s) => `${s.summary} (${s.key})`}
                  isItemEqualToValue={(a, b) => a.key === b.key}
                  disabled={saving || storiesLoading}
                >
                  <Combobox.InputGroup
                    className={cn(
                      'relative flex items-center rounded-lg border border-input bg-transparent transition-colors',
                      'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
                      'dark:bg-input/30',
                    )}
                  >
                    <Combobox.Input
                      aria-label="Search stories and epics by summary or key"
                      placeholder={storiesLoading ? 'Loading stories/epics…' : 'Search by summary or key…'}
                      className="h-9 w-full rounded-lg border-0 bg-transparent pr-8 pl-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <div className="absolute right-1.5 flex items-center text-muted-foreground">
                      {storiesLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Combobox.Trigger
                          className="flex size-6 items-center justify-center rounded-md hover:bg-accent"
                          aria-label="Open story/epic list"
                        >
                          <ChevronDown className="size-3.5" />
                        </Combobox.Trigger>
                      )}
                    </div>
                  </Combobox.InputGroup>

                  <Combobox.Portal>
                    <Combobox.Positioner side="bottom" sideOffset={4} align="start" className="isolate z-50">
                      <Combobox.Popup
                        className={cn(
                          'relative isolate z-50 flex w-(--anchor-width) max-w-(--available-width) flex-col max-h-(--available-height) origin-(--transform-origin)',
                          'overflow-hidden rounded-xl bg-popover text-popover-foreground',
                          'shadow-lg ring-1 ring-foreground/10 duration-100',
                          'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
                          'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
                        )}
                      >
                        <Combobox.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                          {storiesLoading
                            ? 'Loading stories/epics…'
                            : stories.length === 0
                            ? 'No stories or epics found for this module.'
                            : 'No matches.'}
                        </Combobox.Empty>
                        <Combobox.List className="max-h-64 overflow-y-auto scrollbar-thin p-1.5">
                          {(story: CrCandidateStory) => (
                            <Combobox.Item
                              key={story.key}
                              value={story}
                              className={cn(
                                'relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none',
                                'transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground',
                                'data-selected:bg-accent/40 data-selected:text-foreground',
                              )}
                            >
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate leading-tight">{story.summary}</span>
                                <span className="font-mono text-xs text-muted-foreground">{story.key}</span>
                              </span>
                              <Combobox.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-primary">
                                <Check className="size-3.5" />
                              </Combobox.ItemIndicator>
                            </Combobox.Item>
                          )}
                        </Combobox.List>
                      </Combobox.Popup>
                    </Combobox.Positioner>
                  </Combobox.Portal>
                </Combobox.Root>
                <p className="text-xs text-muted-foreground">
                  Type the parent key directly (e.g. DT-1234), or search below. AI pre-fills its best guess after you
                  generate — the CR lands under whichever key is shown here.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Summary</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                placeholder="Short title describing the change"
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Change type</label>
                <AppSelect
                  options={changeTypeOptions.map((t) => ({ value: t, label: t }))}
                  value={changeType || null}
                  onChange={setChangeType}
                  placeholder="Pick a change type"
                  className="w-full"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Priority</label>
                <AppSelect
                  options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p }))}
                  value={priority}
                  onChange={setPriority}
                  className="w-full"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[220px] resize-y font-mono text-sm"
                disabled={saving}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={handleSave} disabled={saving || !parentKey || !summary.trim()} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {saving ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
