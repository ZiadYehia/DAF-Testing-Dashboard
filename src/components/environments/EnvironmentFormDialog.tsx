'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { parseLines } from '@/lib/environments-client'
import type { EnvironmentManager } from './useEnvironmentManager'

/** Lines that are neither blank, a comment, nor `KEY=value` are silently dropped on save. */
function countSkippedLines(text: string) {
  return text.split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && !l.includes('='))
    .length
}

/**
 * The create/edit form, shared by the Automation Hub and Settings.
 *
 * Both surfaces used to render their own copy of this markup inside their own dialog. Identical
 * on the day it was copied and not for long after — and the Hub's copy opened *on top of* the
 * environments list, so editing put two stacked cards on screen. One component, opened from both
 * places, is the only way they stay the same.
 *
 * `sm:max-w-2xl` rather than `max-w-2xl`: DialogContent's own `sm:max-w-sm` is a media-query rule
 * and beats an unprefixed utility whatever the class order, so a plain `max-w-2xl` here is
 * discarded above 640px and the form gets 384px to show `.env` lines in.
 */
export function EnvironmentFormDialog({ mgr, onClosed }: {
  mgr: EnvironmentManager
  /** Runs after the form closes, saved or cancelled — the Hub uses it to reopen its list. */
  onClosed?: () => void
}) {
  const { editing, busy, save, cancelEdit, draftName, setDraftName, draftDesc, setDraftDesc, draftVars, setDraftVars } = mgr
  const parsedCount = Object.keys(parseLines(draftVars)).length
  const skipped = countSkippedLines(draftVars)

  const close = () => { cancelEdit(); onClosed?.() }

  return (
    <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing?.id ? `Edit ${editing.name}` : 'New environment'}</DialogTitle>
          <DialogDescription>
            One <code>KEY=value</code> per line — paste a block straight from a .env file. Values
            are shown in full, because choosing a target means seeing what you are choosing.
          </DialogDescription>
        </DialogHeader>

        {/* The fields scroll, not the dialog. Scrolling the whole dialog put Save below the
            fold on a long .env; capping the fields keeps the footer on screen at any length,
            and the cap is a max so a short form still sizes to its content. */}
        <div className="max-h-[65vh] space-y-4 overflow-y-auto">
          {/* Labelled, not placeholder-only. A placeholder disappears the moment there is a
              value, so an environment being edited showed two anonymous text boxes. */}
          <div className="space-y-1.5">
            <label htmlFor="env-name" className="text-xs font-medium text-muted-foreground">Name</label>
            <Input id="env-name" value={draftName} onChange={(e) => setDraftName(e.target.value)}
                   placeholder="Production (devsim)" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="env-desc" className="text-xs font-medium text-muted-foreground">
              Description <span className="font-normal">(optional)</span>
            </label>
            <Input id="env-desc" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)}
                   placeholder="What this target is, who runs it, when it expires" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="env-vars" className="text-xs font-medium text-muted-foreground">Variables</label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {parsedCount} variable{parsedCount === 1 ? '' : 's'} parsed
              </span>
            </div>
            <Textarea
              id="env-vars"
              value={draftVars}
              onChange={(e) => setDraftVars(e.target.value)}
              spellCheck={false}
              // `rows` is ignored: the Textarea primitive sets `field-sizing-content`, so it
              // sizes to what you typed. Bounds instead — tall enough to paste into, capped so a
              // 40-line .env cannot push the buttons off the screen.
              className="min-h-48 max-h-[40vh] w-full resize-y font-mono text-[11px] leading-relaxed"
              placeholder={'EPTTS_MASAR_API_URL=https://host/masar-service/api/v1\nEPTTS_REGISTRY_API_URL=https://host/registry-service/api/v1\nEPTTS_MFG_APIKEY=…'}
            />
            {skipped > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {skipped} line{skipped === 1 ? ' has' : 's have'} no <code>=</code> and will be
                dropped when you save.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !draftName.trim()} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing?.id ? 'Save changes' : 'Create environment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
