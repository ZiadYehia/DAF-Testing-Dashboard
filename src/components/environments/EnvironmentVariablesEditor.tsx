'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ClipboardPaste, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseLines, toLines } from '@/lib/environments-client'
import { rowsToVars, type EnvironmentManager } from './useEnvironmentManager'

/** A pasted `.env` block, as opposed to someone typing a key with an `=` in it by accident. */
const looksLikeEnvBlock = (text: string) =>
  text.includes('=') && (text.includes('\n') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(text.trim()))

/**
 * The variables of one environment, as a field per variable.
 *
 * A single textarea made the whole thing a text-editing problem: to change one API key you had
 * to find its line, and a stray keystroke on the wrong line silently renamed a variable. These
 * are key/value pairs, so they get a key field and a value field, and the parts that were only
 * ever implicit — which keys collide, which row has a value but no name — can be said outright.
 *
 * Bulk mode keeps the paste-a-whole-.env workflow the textarea was there for. It is a mode, not
 * the default, because pasting happens once per environment and editing happens every time
 * after.
 */
export function EnvironmentVariablesEditor({ mgr }: { mgr: EnvironmentManager }) {
  const { draftVars, addVar, setVar, removeVar, replaceVars, insertVarsAt } = mgr
  const [bulk, setBulk] = useState<string | null>(null)

  const named = draftVars.filter((r) => r.key.trim())
  const count = Object.keys(rowsToVars(draftVars)).length
  /** Keys typed more than once. The last row wins on save, so the earlier ones are dead weight. */
  const duplicates = new Set(
    named.map((r) => r.key.trim())
      .filter((k, i, all) => all.indexOf(k) !== i),
  )
  const orphanValues = draftVars.filter((r) => !r.key.trim() && r.value.trim()).length

  const openBulk = () => setBulk(toLines(rowsToVars(draftVars)))
  const applyBulk = () => {
    if (bulk !== null) replaceVars(parseLines(bulk))
    setBulk(null)
  }

  /** Focus a row's key field once React has rendered it. */
  const focusKey = (id: number) =>
    requestAnimationFrame(() => document.getElementById(`env-var-key-${id}`)?.focus())

  if (bulk !== null) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="env-vars-bulk" className="text-xs font-medium text-muted-foreground">
            Paste a .env block
          </label>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setBulk(null)}>
            <X className="h-3 w-3" /> Cancel
          </Button>
        </div>
        <Textarea
          id="env-vars-bulk"
          autoFocus
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          spellCheck={false}
          // `rows` is ignored: the Textarea primitive sets `field-sizing-content`, so it sizes to
          // what you typed. Bounds instead, so a 40-line .env cannot push the buttons off screen.
          className="min-h-48 max-h-[40vh] w-full resize-y font-mono text-[11px] leading-relaxed"
          placeholder={'EPTTS_MASAR_API_URL=https://host/masar-service/api/v1\nEPTTS_MFG_APIKEY=…'}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            {Object.keys(parseLines(bulk)).length} variable(s) — replaces every field below.
          </p>
          <Button size="sm" className="h-7 text-xs" onClick={applyBulk}>Use these</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Variables</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {count} variable{count === 1 ? '' : 's'}
        </span>
      </div>

      <div className="space-y-1.5">
        {draftVars.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            No variables yet. Add one, or paste a .env block.
          </p>
        )}

        {draftVars.map((row) => {
          const duplicate = duplicates.has(row.key.trim())
          return (
            <div key={row.id} className="flex items-start gap-1.5">
              <div className="w-2/5 shrink-0">
                <Input
                  id={`env-var-key-${row.id}`}
                  value={row.key}
                  spellCheck={false}
                  aria-label="Variable name"
                  aria-invalid={duplicate || undefined}
                  onChange={(e) => setVar(row.id, { key: e.target.value })}
                  // A whole .env pasted into a name field should become rows, not a name with
                  // newlines in it — that is how people move a config over, every time.
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text')
                    if (!looksLikeEnvBlock(text)) return
                    e.preventDefault()
                    insertVarsAt(row.id, parseLines(text))
                  }}
                  className={cn('h-8 font-mono text-[11px]', duplicate && 'border-amber-500')}
                  placeholder="EPTTS_MFG_APIKEY"
                />
              </div>
              <span className="pt-1.5 text-xs text-muted-foreground">=</span>
              <Input
                value={row.value}
                spellCheck={false}
                aria-label={row.key.trim() ? `Value for ${row.key.trim()}` : 'Variable value'}
                onChange={(e) => setVar(row.id, { value: e.target.value })}
                className="h-8 min-w-0 flex-1 font-mono text-[11px]"
                placeholder="value"
              />
              <Button
                size="icon" variant="ghost" className="size-8 shrink-0 text-muted-foreground"
                title={`Remove ${row.key.trim() || 'this variable'}`}
                onClick={() => removeVar(row.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="sr-only">Remove {row.key.trim() || 'this variable'}</span>
              </Button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="secondary" size="sm" className="h-8 gap-1 text-xs"
                onClick={() => focusKey(addVar())}>
          <Plus className="h-3.5 w-3.5" /> Add variable
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={openBulk}>
          <ClipboardPaste className="h-3.5 w-3.5" /> Paste .env block
        </Button>
      </div>

      {duplicates.size > 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          Repeated:{' '}
          {[...duplicates].map((k, i) => (
            <span key={k}>{i > 0 && ', '}<code>{k}</code></span>
          ))}
          {' '}— only the last row of each is saved.
        </p>
      )}
      {orphanValues > 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {orphanValues} value{orphanValues === 1 ? ' has' : 's have'} no variable name and will
          be dropped when you save.
        </p>
      )}
    </div>
  )
}
