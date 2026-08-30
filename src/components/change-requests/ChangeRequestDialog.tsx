'use client'

// Shared create/edit dialog for Change Requests. Mirrors the AI-generate ->
// review/edit -> submit flow of ReportBugDialog.tsx / useBugDraft.ts, scaled
// down to the CR's smaller field set (summary, description, changeType,
// priority — no variant-dependent field toggles).

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles, Send, Save, GitPullRequestArrow, ChevronDown, Check } from 'lucide-react'
import { Combobox } from '@base-ui/react/combobox'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AppSelect } from '@/components/shared/AppSelect'
import { AIProgressBar } from '@/components/shared/AIProgressBar'
import { useStreamingGenerate } from '@/hooks/useStreamingGenerate'
import { useCrFormat } from '@/hooks/useCrFormat'
import { cn } from '@/lib/utils'
import type { GeneratedChangeRequest } from '@/lib/ai'
import type { CrParentType } from '@/lib/cr-format'

const PRIORITY_OPTIONS = ['P1', 'P2', 'P3', 'P4']

/** Keep the CR's current value selectable even if it's since fallen out of the configured option list. */
function withCurrentValue(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options
}

export interface ChangeRequestRecord {
  id: number
  appSlug: string
  parentKey: string
  parentType: string
  crKey: string | null
  summary: string
  description: string
  changeType: string
  priority: string
  label: string
  jiraStatus: string | null
  assignee: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string | null
  syncedAt: string | null
}

/** The parent story/epic a new CR is filed against (create mode only). */
export interface ChangeRequestParent {
  key: string
  type?: CrParentType
  summary?: string
}

/** A story/epic offered in the affected-parent picker when no parent is preset. */
interface CrCandidateStory {
  key: string
  summary: string
  status?: string
  labels?: string[]
  components?: string[]
}

interface ChangeRequestDialogProps {
  app: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** AI model id to use for "Generate with AI" (create mode only). */
  model: string
  /** Create mode: the story/epic this CR is filed against. Ignored in edit mode. */
  parent?: ChangeRequestParent | null
  /** Edit mode: the CR being edited. When set, the dialog edits (PATCH) instead of creating. */
  changeRequest?: ChangeRequestRecord | null
  /** Module slug to tag a newly-created CR with. `null`/omitted = app-level (no module). Ignored in edit mode. */
  module?: string | null
  /** Called once after a successful create or edit, with the resulting/updated record. */
  onSaved: (cr: ChangeRequestRecord) => void
}

function targetLabel(parentType?: string): string {
  return parentType === 'epic' ? 'Story under epic' : 'Sub-task under story'
}

export function ChangeRequestDialog({
  app,
  open,
  onOpenChange,
  model,
  parent,
  changeRequest,
  module,
  onSaved,
}: ChangeRequestDialogProps) {
  const isEdit = !!changeRequest
  // No `parent` prop means the caller doesn't already know which story/epic
  // this CR belongs to (e.g. the module/app-level "New CR" entry point) — the
  // user types the key themselves instead of it being locked in from context.
  const hasPresetParent = !isEdit && !!parent?.key
  const { config } = useCrFormat(app)
  const { generate, generating, phase } = useStreamingGenerate<GeneratedChangeRequest & { suggestedParentKey: string | null }>()

  const [notes, setNotes] = useState('')
  // Affected-parent picker state (no-preset mode only — Stories view locks
  // `parent` instead and never touches this).
  const [stories, setStories] = useState<CrCandidateStory[]>([])
  const [storiesLoading, setStoriesLoading] = useState(false)
  const [selectedParentKey, setSelectedParentKey] = useState<string | null>(null)
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [changeType, setChangeType] = useState('')
  const [priority, setPriority] = useState('P2')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ crKey: string | null; parentType: string; jiraError?: string } | null>(null)
  // Gates the review/edit step — like the bug reporter, the fields stay hidden
  // until the AI has drafted them (create mode). Edit mode shows them straight away.
  const [generated, setGenerated] = useState(false)

  const parentKey = hasPresetParent ? parent!.key : (selectedParentKey ?? '')
  const selectedStory = stories.find((s) => s.key === selectedParentKey) ?? null

  // Re-seed whenever the dialog (re)opens, so switching between "New CR" targets
  // or edit rows never leaks the previous session's draft.
  useEffect(() => {
    if (!open) return
    setResult(null)
    setNotes('')
    setSelectedParentKey(null)
    setGenerated(false)
    if (changeRequest) {
      setSummary(changeRequest.summary)
      setDescription(changeRequest.description)
      setChangeType(changeRequest.changeType)
      setPriority(changeRequest.priority)
    } else {
      setSummary('')
      setDescription('')
      setChangeType(config.changeTypes[0] ?? '')
      setPriority('P2')
    }
    // Module-scoped candidate list for the picker + the "suggest a parent"
    // AI pass — same endpoint the Stories view itself reads from.
    if (!isEdit && !hasPresetParent) {
      setStories([])
      setStoriesLoading(true)
      fetch(`/api/${app}/stories${module ? `?module=${module}` : ''}`)
        .then((r) => (r.ok ? r.json() : { stories: [] }))
        .then((data: { stories?: CrCandidateStory[] }) => setStories(data.stories ?? []))
        .catch(() => setStories([]))
        .finally(() => setStoriesLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, changeRequest])

  const changeTypeOptions = withCurrentValue(config.changeTypes, changeType)

  const handleGenerate = async () => {
    if (!notes.trim()) {
      toast.error('Describe the change first.')
      return
    }
    try {
      // Locked parent (Stories view) -> CONTEXT mode, unchanged. Otherwise ->
      // SUGGEST mode: hand the AI the fetched candidates and let it pick the
      // best-matching parent (or none) instead of requiring one up front.
      const data = hasPresetParent
        ? await generate(`/api/${app}/change-requests/generate`, {
            notes,
            model,
            parentKey,
            parentType: parent?.type,
            parentSummary: parent?.summary,
          })
        : await generate(`/api/${app}/change-requests/generate`, {
            notes,
            model,
            module: module ?? undefined,
            candidates: stories.map((s) => ({ key: s.key, summary: s.summary })),
          })
      if (!data) return
      setSummary(data.summary ?? '')
      setDescription(data.description ?? '')
      setChangeType(data.changeType || config.changeTypes[0] || '')
      setPriority(data.priority ?? 'P2')
      // Pre-select the AI's suggested parent if it matches a fetched
      // candidate — the user can still override it in the picker.
      if (!hasPresetParent && data.suggestedParentKey && stories.some((s) => s.key === data.suggestedParentKey)) {
        setSelectedParentKey(data.suggestedParentKey)
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
    if (!isEdit && !parentKey) {
      toast.error('Select the affected story/epic first.')
      return
    }
    setSaving(true)
    try {
      if (isEdit && changeRequest) {
        const res = await fetch(`/api/${app}/change-requests/${changeRequest.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary, description, changeType, priority }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error ?? 'Failed to save Change Request')
        toast.success('Change Request updated.')
        onSaved(data as ChangeRequestRecord)
        onOpenChange(false)
        return
      }

      if (!parentKey) throw new Error('Missing parent story/epic key')
      const res = await fetch(`/api/${app}/change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentKey,
          parentType: parent?.type,
          summary,
          description,
          changeType,
          priority,
          module: module ?? null,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 502 && data?.changeRequest) {
        // Local row saved, Jira push failed — surface both outcomes clearly instead
        // of a generic error (the CR isn't lost; it can be retried from the list).
        const cr = data.changeRequest as ChangeRequestRecord
        toast.warning(`Saved locally, but the Jira push failed: ${data.error ?? 'unknown error'}`)
        setResult({ crKey: null, parentType: cr.parentType, jiraError: data.error ?? 'unknown error' })
        onSaved(cr)
        return
      }
      if (!res.ok) throw new Error(data?.error ?? 'Failed to create Change Request')

      const cr = data as ChangeRequestRecord
      setResult({ crKey: cr.crKey, parentType: cr.parentType })
      toast.success(`Change Request created${cr.crKey ? ` as ${cr.crKey}` : ''}.`)
      onSaved(cr)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save Change Request')
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || generating
  // Once a create attempt has resolved (success or partial-failure), the primary
  // action becomes "Close" — editing further and re-submitting would create a
  // second Jira issue, so the dialog is done until reopened for a fresh CR.
  const isDone = !isEdit && !!result

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequestArrow className="h-4 w-4" />
            {isEdit
              ? `Edit Change Request${changeRequest?.crKey ? ` — ${changeRequest.crKey}` : ''}`
              : `New Change Request${hasPresetParent ? ` for ${parent!.key}` : ''}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Edit the Change Request. Saving pushes the update to Jira.'
              : 'Describe the change in plain English, optionally generate a draft with AI, then review and create.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — describe the change in plain English, then let the AI draft it. */}
        {!isEdit && !isDone && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Describe the change</label>
            <Textarea
              placeholder="Describe, in your own words, what came up on the call and how it changes scope — rough notes are fine. AI fills in the rest."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px] resize-y text-sm"
              disabled={generating}
            />
            <Button variant="outline" onClick={handleGenerate} disabled={generating || !notes.trim()} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate with AI'}
            </Button>
            {generating && <AIProgressBar phase={phase} />}
          </div>
        )}

        {/* Step 2 — review & edit the AI-filled fields (revealed after generate). */}
        {!isEdit && !isDone && !hasPresetParent && generated && (
          <div className="space-y-1.5 border-t pt-4">
            <label className="text-sm font-medium">Affected story/epic</label>
            <Combobox.Root<CrCandidateStory>
              items={stories}
              value={selectedStory}
              onValueChange={(story) => setSelectedParentKey(story?.key ?? null)}
              itemToStringLabel={(s) => `${s.summary} (${s.key})`}
              isItemEqualToValue={(a, b) => a.key === b.key}
              disabled={busy || storiesLoading}
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
              AI picked the closest-matching story or epic from this module — change it here if it&apos;s wrong.
            </p>
          </div>
        )}

        {!isDone && (isEdit || generated) && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Summary</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                placeholder="Short title describing the change"
                disabled={busy}
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
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Priority</label>
                <AppSelect
                  options={PRIORITY_OPTIONS.map((p) => ({ value: p, label: p }))}
                  value={priority}
                  onChange={setPriority}
                  className="w-full"
                  disabled={busy}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[220px] resize-y font-mono text-sm"
                disabled={busy}
              />
            </div>
          </div>
        )}

        {result && (
          <div
            className={cn(
              'rounded-lg border px-3 py-2.5 text-xs',
              result.jiraError
                ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                : 'border-border bg-muted/30 text-muted-foreground'
            )}
          >
            {result.jiraError ? (
              <>
                Change Request saved locally, but the Jira push failed:{' '}
                <span className="font-medium">{result.jiraError}</span>. It hasn&apos;t been lost — retry from the
                Change Requests list (Sync), or edit and save again.
              </>
            ) : (
              <>
                Created as <span className="font-medium text-foreground">{targetLabel(result.parentType)}</span>
                {result.crKey ? (
                  <>
                    {' '}
                    — <span className="font-medium text-foreground">{result.crKey}</span>
                  </>
                ) : null}
                .
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {isDone ? 'Close' : 'Cancel'}
          </Button>
          {!isDone && (
            <Button onClick={handleSave} disabled={busy || (!isEdit && (!parentKey || !summary.trim()))}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
