'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type {
  IntakeGroup,
  IntakeQuestion,
  IntakeItemField,
  IntakeValue,
  IntakeLoginStep,
  IntakeLoginStepAction,
  IntakeStepLocator,
  IntakeLocatorKind,
} from '@/lib/intake-types'
import { LOCATOR_KINDS, LOGIN_STEP_ACTIONS } from '@/lib/intake-types'

type Row = Record<string, string>

interface IntakeGroupFormProps {
  /** App slug — used to call PUT /api/{app}/intake. */
  app: string
  scope: 'app' | 'module' | 'feature'
  /** Module or feature slug. Required for 'module'/'feature' scope, ignored for 'app'. */
  slug?: string
  group: IntakeGroup
  initialAnswers?: Record<string, IntakeValue>
  onSaved?: (answers: Record<string, IntakeValue>, readiness: unknown) => void
}

function defaultValueFor(q: IntakeQuestion): IntakeValue {
  return q.type === 'short-text' || q.type === 'long-text' ? '' : []
}

/** Renders one IntakeGroup's questions and saves them via PUT /api/{app}/intake, handling the 409 hand-written-file conflict with a confirm dialog. */
export function IntakeGroupForm({ app, scope, slug, group, initialAnswers, onSaved }: IntakeGroupFormProps) {
  const [values, setValues] = useState<Record<string, IntakeValue>>(() => {
    const seed: Record<string, IntakeValue> = {}
    for (const q of group.questions) {
      seed[q.id] = initialAnswers?.[q.id] ?? defaultValueFor(q)
    }
    return seed
  })
  const [saving, setSaving] = useState(false)
  const [conflictFile, setConflictFile] = useState<string | null>(null)

  const setValue = (id: string, v: IntakeValue) => setValues((prev) => ({ ...prev, [id]: v }))

  async function submit(force: boolean) {
    setSaving(true)
    try {
      const res = await fetch(`/api/${app}/intake`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, slug, groupId: group.id, answers: values, force }),
      })

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}))
        setConflictFile(typeof data.file === 'string' ? data.file : 'this file')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save')
      }

      const data = await res.json()
      toast.success(`${group.title} saved`)
      onSaved?.(values, data.readiness)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">{group.title}</h3>
        {group.description && <p className="text-sm text-muted-foreground mt-0.5">{group.description}</p>}
      </div>

      <div className="space-y-5">
        {group.questions.map((q) => (
          <QuestionField key={q.id} question={q} value={values[q.id]} onChange={(v) => setValue(q.id, v)} />
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => submit(false)} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>

      <Dialog open={conflictFile !== null} onOpenChange={(open) => { if (!open) setConflictFile(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Overwrite hand-written file?</DialogTitle>
            <DialogDescription>
              <code className="rounded bg-muted px-1 py-0.5">{conflictFile}</code> was written by hand, not generated
              from this form. Saving will replace its contents with what you see here — this can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflictFile(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConflictFile(null)
                void submit(true)
              }}
            >
              Overwrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Per-question rendering ─────────────────────────────────────────────────────

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion
  value: IntakeValue | undefined
  onChange: (v: IntakeValue) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{question.label}</label>
      {question.help && <p className="text-xs text-muted-foreground">{question.help}</p>}
      <QuestionInput question={question} value={value} onChange={onChange} />
    </div>
  )
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion
  value: IntakeValue | undefined
  onChange: (v: IntakeValue) => void
}) {
  if (question.type === 'short-text') {
    return (
      <Input
        value={typeof value === 'string' ? value : ''}
        placeholder={question.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  if (question.type === 'long-text') {
    return (
      <Textarea
        rows={4}
        value={typeof value === 'string' ? value : ''}
        placeholder={question.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  if (question.type === 'login-steps') {
    const steps = (Array.isArray(value) ? value : []) as IntakeLoginStep[]
    return <LoginStepsEditor steps={steps} onChange={(next) => onChange(next)} />
  }

  const rows = (Array.isArray(value) ? value : []) as Row[]
  const fields = question.itemFields ?? []
  return question.type === 'key-value' ? (
    <KeyValueRows rows={rows} fields={fields} onChange={onChange} />
  ) : (
    <ListRows rows={rows} fields={fields} onChange={onChange} />
  )
}

function emptyRow(fields: IntakeItemField[]): Row {
  const row: Row = {}
  for (const f of fields) row[f.key] = ''
  return row
}

function ListRows({ rows, fields, onChange }: { rows: Row[]; fields: IntakeItemField[]; onChange: (rows: Row[]) => void }) {
  const update = (i: number, key: string, val: string) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  const add = () => onChange([...rows, emptyRow(fields)])

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="rounded-md border p-3 space-y-2">
          <div className="flex justify-end">
            <button type="button" onClick={() => remove(i)} aria-label="Remove row">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
          {fields.map((f) =>
            f.long ? (
              <Textarea
                key={f.key}
                rows={2}
                placeholder={f.placeholder ?? f.label}
                value={row[f.key] ?? ''}
                onChange={(e) => update(i, f.key, e.target.value)}
              />
            ) : (
              <Input
                key={f.key}
                placeholder={f.placeholder ?? f.label}
                value={row[f.key] ?? ''}
                onChange={(e) => update(i, f.key, e.target.value)}
              />
            )
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  )
}

function KeyValueRows({ rows, fields, onChange }: { rows: Row[]; fields: IntakeItemField[]; onChange: (rows: Row[]) => void }) {
  const keyField = fields[0]
  const valueField = fields[1]
  const keyKey = keyField?.key ?? 'key'
  const valueKey = valueField?.key ?? 'value'

  const update = (i: number, key: string, val: string) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  const add = () => onChange([...rows, emptyRow(fields)])

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-start">
          <Input
            className="flex-1"
            placeholder={keyField?.placeholder ?? keyField?.label}
            value={row[keyKey] ?? ''}
            onChange={(e) => update(i, keyKey, e.target.value)}
          />
          {valueField?.long ? (
            <Textarea
              rows={1}
              className="flex-1"
              placeholder={valueField.placeholder ?? valueField.label}
              value={row[valueKey] ?? ''}
              onChange={(e) => update(i, valueKey, e.target.value)}
            />
          ) : (
            <Input
              className="flex-1"
              placeholder={valueField?.placeholder ?? valueField?.label}
              value={row[valueKey] ?? ''}
              onChange={(e) => update(i, valueKey, e.target.value)}
            />
          )}
          <button type="button" onClick={() => remove(i)} className="mt-2 shrink-0" aria-label="Remove row">
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  )
}

// ─── Login-steps editor ─────────────────────────────────────────────────────────

function emptyLoginStep(): IntakeLoginStep {
  return { action: 'click', locator: { kind: 'css', value: '' } }
}

function needsLocator(action: IntakeLoginStepAction): boolean {
  return action === 'click' || action === 'fill' || action === 'waitForVisible'
}

function LoginStepsEditor({ steps, onChange }: { steps: IntakeLoginStep[]; onChange: (steps: IntakeLoginStep[]) => void }) {
  const update = (i: number, patch: Partial<IntakeLoginStep>) => onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const updateLocator = (i: number, patch: Partial<IntakeStepLocator>) =>
    onChange(
      steps.map((s, idx) => (idx === i ? { ...s, locator: { ...(s.locator ?? { kind: 'css', value: '' }), ...patch } } : s))
    )
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i))
  const add = () => onChange([...steps, emptyLoginStep()])
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="rounded-md border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}.</span>
            <Select value={step.action} onValueChange={(v) => v && update(i, { action: v as IntakeLoginStepAction })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGIN_STEP_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down">
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button type="button" onClick={() => remove(i)} aria-label="Remove step">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </div>

          {step.action === 'goto' && (
            <Input placeholder="URL — e.g. {base}/login" value={step.url ?? ''} onChange={(e) => update(i, { url: e.target.value })} />
          )}

          {step.action === 'waitForUrl' && (
            <Input
              placeholder="URL starts with — e.g. {base}"
              value={step.startsWith ?? ''}
              onChange={(e) => update(i, { startsWith: e.target.value })}
            />
          )}

          {needsLocator(step.action) && (
            <div className="flex flex-wrap gap-2">
              <Select value={step.locator?.kind ?? 'css'} onValueChange={(v) => v && updateLocator(i, { kind: v as IntakeLocatorKind })}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATOR_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="min-w-[140px] flex-1"
                placeholder="Locator value"
                value={step.locator?.value ?? ''}
                onChange={(e) => updateLocator(i, { value: e.target.value })}
              />
              {step.locator?.kind === 'role' && (
                <Input
                  className="min-w-[120px] flex-1"
                  placeholder="Accessible name (optional)"
                  value={step.locator?.name ?? ''}
                  onChange={(e) => updateLocator(i, { name: e.target.value })}
                />
              )}
            </div>
          )}

          {step.action === 'fill' && (
            <Input
              placeholder="Value to type — e.g. {env:APP_LOGIN_PASSWORD}"
              value={step.value ?? ''}
              onChange={(e) => update(i, { value: e.target.value })}
            />
          )}

          {(step.action === 'click' || step.action === 'fill') && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={step.onlyIfVisible === true}
                onChange={(e) => update(i, { onlyIfVisible: e.target.checked })}
              />
              Only run if visible
            </label>
          )}

          {step.action === 'click' && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={step.retryOnFlake === true}
                onChange={(e) => update(i, { retryOnFlake: e.target.checked })}
              />
              Retry once if flaky
            </label>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add step
      </Button>
    </div>
  )
}
