'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AppSelect } from '@/components/shared/AppSelect'
import { Bug, Loader2, Send, Sparkles, Eye, Pencil, FlaskConical } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AIModel, GeneratedBugReport } from '@/lib/ai'
import { useStreamingGenerate } from '@/hooks/useStreamingGenerate'
import { AIProgressBar } from '@/components/shared/AIProgressBar'
import { ModelSelector } from '@/components/shared/ModelSelector'
import { ContextWarningBanner } from '@/components/shared/ContextWarningBanner'
import { useBugFormat } from '@/hooks/useBugFormat'
import { LabelMultiSelect } from '@/components/shared/LabelMultiSelect'
import { BUG_TYPE_OPTIONS, LAYER_OPTIONS, getVariantConfig, type BugLayer } from '@/lib/bug-format'

// AI-generated report, extended with the fields the generate route now returns
// (layer classification + optional severity) — kept as a local intersection so
// this file compiles regardless of exactly when ai.ts picks up the new fields.
type GeneratedBugReportExt = GeneratedBugReport & { layer?: string; severity?: string }

/** Keep the bug's current value selectable even if it's since fallen out of the configured option list. */
function withCurrentValue(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options
}

interface LinkedTestcase {
  app: string
  feature: string
  testcaseId: string
}

interface FeatureSummary {
  name: string
  module?: string | null
}

interface AutomationBugDialogProps {
  open: boolean
  /** Dashboard app the hub is mounted under (fallback when no test case is linked). */
  app: string
  projectTitle: string
  linkedTestcase: LinkedTestcase | null | undefined
  /** Failure context from the latest replay, used to seed the description. */
  runError?: string | null
  runLog?: string | null
  models: AIModel[]
  onClose: () => void
}

/** Seed the description with everything the replay already knows about the failure. */
function seedNotes(input: {
  projectTitle: string
  linkedTestcase?: LinkedTestcase | null
  runError?: string | null
  runLog?: string | null
}): string {
  const lines = [`Automation "${input.projectTitle}" failed during replay.`]
  if (input.linkedTestcase) lines.push(`Covers test case ${input.linkedTestcase.testcaseId} (feature: ${input.linkedTestcase.feature}).`)
  if (input.runError) lines.push(`Error: ${input.runError}`)
  if (input.runLog?.trim()) lines.push('', 'Run log (tail):', input.runLog.trim().slice(-1500))
  lines.push('', 'What went wrong (add anything you observed):', '')
  return lines.join('\n')
}

/**
 * Report a bug straight from the Automation Hub. Reuses the dashboard's bug
 * pipeline: AI-generate → create under the feature → (when a test case is linked)
 * record the testcase→bug link so it shows up in the feature's execution tab.
 * Without a linked test case the bug is created unlinked under a picked feature.
 */
export function AutomationBugDialog({
  open,
  app,
  projectTitle,
  linkedTestcase,
  runError,
  runLog,
  models,
  onClose,
}: AutomationBugDialogProps) {
  // Bugs and features live in the linked test case's app when there is one.
  const targetApp = linkedTestcase?.app ?? app

  // No parent story is collected here, so bugs created from automation are
  // always epic-level — the epic variant config applies throughout.
  const { config } = useBugFormat(targetApp)
  const variantConfig = getVariantConfig(config, null)

  const [notes, setNotes] = useState('')
  const { generate, generating, phase, warning, dismissWarning } = useStreamingGenerate<GeneratedBugReportExt>()
  const [model, setModel] = useState('')

  const [generated, setGenerated] = useState(false)
  const [preview, setPreview] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState('P3 – Medium')
  const [bugType, setBugType] = useState('Functional')
  const [severity, setSeverity] = useState('')
  const [layer, setLayer] = useState<BugLayer>('unknown')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])

  const [features, setFeatures] = useState<FeatureSummary[]>([])
  const [feature, setFeature] = useState<string>('')
  const [busy, setBusy] = useState<null | 'draft' | 'report'>(null)
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNotes(seedNotes({ projectTitle, linkedTestcase, runError, runLog }))
    setGenerated(false)
    setPreview(false)
    setTitle('')
    setBody('')
    setPriority('P3 – Medium')
    setBugType('Functional')
    setSeverity('')
    setLayer('unknown')
    setCreatedSlug(null)
    setFeature(linkedTestcase?.feature ?? '')
    if (!model) {
      const first = models.find((m) => m.enabled)
      if (first) setModel(first.id)
    }
    // Features list: the picker when unlinked, the module lookup when linked.
    fetch(`/api/${targetApp}/features`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: FeatureSummary[]) => setFeatures(list))
      .catch(() => setFeatures([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Pre-check all of the variant's configured labels — re-init whenever the
  // dialog (re)opens or the config finishes loading.
  useEffect(() => {
    if (open) setSelectedLabels(variantConfig.jiraLabels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, variantConfig])

  const module = useMemo(
    () => features.find((f) => f.name === feature)?.module ?? null,
    [features, feature],
  )

  const handleClose = () => {
    if (!busy && !generating) onClose()
  }

  const handleGenerate = async () => {
    if (!notes.trim()) {
      toast.error('Describe the bug first.')
      return
    }
    try {
      const data = await generate(`/api/${targetApp}/bugs/generate`, { notes, model, variant: 'epic' })
      if (!data) return
      setTitle(data.title ?? `${projectTitle} — replay failure`)
      setPriority(data.priority ?? 'P3 – Medium')
      setBugType(data.bug_type ?? 'Functional')
      setBody(data.body ?? '')
      setSeverity(data.severity ?? '')
      setLayer((data.layer as BugLayer) ?? 'unknown')
      setGenerated(true)
      toast.success('Bug report generated — review and report.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  /** Creates the bug (once); when a test case is linked, records the execution-tab link. */
  const ensureDraft = async (): Promise<string> => {
    if (createdSlug) return createdSlug
    if (!feature) throw new Error('Pick the feature this bug belongs to')
    if (!title.trim() || !body.trim()) throw new Error('Title and description are required')

    const res = await fetch(`/api/${targetApp}/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature, title: title.trim(), priority, bug_type: bugType, severity, layer, body, module }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to create bug')
    const { slug } = (await res.json()) as { slug: string }

    if (linkedTestcase) {
      const linkRes = await fetch(
        `/api/${linkedTestcase.app}/features/${linkedTestcase.feature}/execution/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testcaseId: linkedTestcase.testcaseId, bugSlug: slug }),
        },
      )
      if (!linkRes.ok) throw new Error((await linkRes.json().catch(() => ({})))?.error ?? 'Bug created but linking failed')
    }
    setCreatedSlug(slug)
    return slug
  }

  const openBugToast = (message: string, slug: string) =>
    toast.success(message, {
      action: {
        label: 'Open bug',
        onClick: () => window.open(`/${targetApp}/bugs/${feature}/${slug}`, '_blank'),
      },
    })

  const handleSaveDraft = async () => {
    setBusy('draft')
    try {
      const slug = await ensureDraft()
      openBugToast(
        linkedTestcase
          ? `Bug draft created and linked to ${linkedTestcase.testcaseId}.`
          : 'Bug draft created.',
        slug,
      )
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft')
    } finally {
      setBusy(null)
    }
  }

  const handleReport = async () => {
    setBusy('report')
    try {
      const slug = await ensureDraft()
      const res = await fetch(`/api/${targetApp}/bugs/${feature}/${slug}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer, labels: selectedLabels }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Failed to report to Jira')
      if (data.attachment_warning) toast.warning(`Reported, but attachments failed: ${data.attachment_warning}`)
      else openBugToast(`Reported to Jira as ${data.jira_key}.`, slug)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to report to Jira')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-red-600" />
            Report bug from automation
          </DialogTitle>
          <DialogDescription>
            {linkedTestcase ? (
              <>
                The bug will be linked to test case{' '}
                <span className="font-mono">{linkedTestcase.testcaseId}</span> and appear in the
                execution tab of <span className="font-medium">{linkedTestcase.feature}</span>.
              </>
            ) : (
              'No test case is linked to this automation — the bug will be created under a feature without an execution-tab link.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Feature picker — only when there's no linked test case dictating it */}
          {!linkedTestcase && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Feature to file the bug under</label>
              <AppSelect
                aria-label="Select a feature"
                className="w-full"
                placeholder="Select a feature…"
                value={feature || null}
                onChange={(v) => setFeature(v)}
                disabled={!!busy}
                options={features.map((f) => ({ value: f.name, label: f.name }))}
              />
            </div>
          )}
          {linkedTestcase && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" />
              Linked test case <span className="font-mono text-foreground">{linkedTestcase.testcaseId}</span>
              <span>·</span> {linkedTestcase.feature}
            </div>
          )}

          {/* Step 1 — describe & generate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">Describe the bug</label>
              <ModelSelector models={models} value={model} onChange={setModel} size="sm" />
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={generating || !!busy}
              className="min-h-32 resize-y font-mono text-xs"
            />
            <Button onClick={handleGenerate} disabled={generating || !!busy || !notes.trim()} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {generating ? 'Generating…' : generated ? 'Regenerate' : 'Generate report'}
            </Button>
            {generating && <AIProgressBar phase={phase} />}
            {warning && warning.length > 0 && (
              <ContextWarningBanner missing={warning} onDismiss={dismissWarning} href={`/${targetApp}/settings`} actionLabel="Review app profile" />
            )}
          </div>

          {/* Step 2 — review & edit */}
          {generated && !generating && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Review &amp; edit</span>
                <button
                  onClick={() => setPreview((p) => !p)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {preview ? 'Edit' : 'Preview'}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!!busy} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {variantConfig.fields.priority && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <Select value={priority} onValueChange={(v) => v && setPriority(v)} disabled={!!busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {withCurrentValue(config.priorityOptions, priority).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {variantConfig.fields.severity && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Severity</label>
                    <Select value={severity} onValueChange={(v) => v && setSeverity(v)} disabled={!!busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {withCurrentValue(config.severityOptions, severity).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {variantConfig.fields.bugType && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <Select value={bugType} onValueChange={(v) => v && setBugType(v)} disabled={!!busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {withCurrentValue(BUG_TYPE_OPTIONS, bugType).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* Manual override of the AI's FE/BE classification — always shown. */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Layer</label>
                  <Select value={layer} onValueChange={(v) => v && setLayer(v as BugLayer)} disabled={!!busy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LAYER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Report body</label>
                {preview ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/30 px-4 py-3 min-h-52">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                  </div>
                ) : (
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={!!busy}
                    className="min-h-52 resize-y font-mono text-xs"
                  />
                )}
              </div>

              <LabelMultiSelect
                labels={variantConfig.jiraLabels}
                selected={selectedLabels}
                onChange={setSelectedLabels}
                disabled={!!busy}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={!!busy || generating}>Cancel</Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={!generated || !!busy || !feature}>
            {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
            Save draft
          </Button>
          <Button onClick={handleReport} disabled={!generated || !!busy || !feature}>
            {busy === 'report' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Report to Jira
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
