'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AppSelect } from '@/components/shared/AppSelect'
import { Bug, Loader2, Send, FlaskConical } from 'lucide-react'
import type { AIModel } from '@/lib/ai'
import { useBugDraft } from '@/components/bugs/useBugDraft'
import { BugDraftForm } from '@/components/bugs/BugDraftForm'

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

  const [features, setFeatures] = useState<FeatureSummary[]>([])
  const [feature, setFeature] = useState<string>('')
  const [model, setModel] = useState('')

  const moduleVal = useMemo(
    () => features.find((f) => f.name === feature)?.module ?? null,
    [features, feature],
  )

  // No parent story is collected here, so bugs created from automation are
  // always epic-level — the epic variant config applies throughout (enforced
  // inside the hook).
  const draft = useBugDraft({
    open,
    app: targetApp,
    feature,
    module: moduleVal,
    link: linkedTestcase
      ? { app: linkedTestcase.app, feature: linkedTestcase.feature, testcaseId: linkedTestcase.testcaseId }
      : null,
    model,
    fallbackTitle: `${projectTitle} — replay failure`,
  })

  useEffect(() => {
    if (!open) return
    draft.reset(seedNotes({ projectTitle, linkedTestcase, runError, runLog }))
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

  const handleClose = () => {
    if (!draft.busy && !draft.generating) onClose()
  }

  const openBugToast = (message: string, slug: string) =>
    toast.success(message, {
      action: {
        label: 'Open bug',
        onClick: () => window.open(`/${targetApp}/bugs/${feature}/${slug}`, '_blank'),
      },
    })

  const handleSaveDraft = async () => {
    const slug = await draft.saveDraft()
    if (!slug) return
    openBugToast(
      linkedTestcase
        ? `Bug draft created and linked to ${linkedTestcase.testcaseId}.`
        : 'Bug draft created.',
      slug,
    )
    onClose()
  }

  const handleReport = async () => {
    const result = await draft.report()
    if (!result) return
    if (result.attachmentWarning) toast.warning(`Reported, but attachments failed: ${result.attachmentWarning}`)
    else openBugToast(`Reported to Jira as ${result.jiraKey}.`, result.slug)
    onClose()
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
                disabled={!!draft.busy}
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

          <BugDraftForm
            draft={draft}
            models={models}
            model={model}
            onModelChange={setModel}
            settingsHref={`/${targetApp}/settings`}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={!!draft.busy || draft.generating}>Cancel</Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={!draft.generated || !!draft.busy || !feature}>
            {draft.busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
            Save draft
          </Button>
          <Button onClick={handleReport} disabled={!draft.generated || !!draft.busy || !feature}>
            {draft.busy === 'report' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Report to Jira
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
