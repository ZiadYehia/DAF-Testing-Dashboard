'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Check, Globe, Loader2, Pencil, Plus, Server, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  activateEnvironment, createEnvironment, deleteEnvironment, fetchEnvironment, fetchEnvironments,
  parseLines, toLines, updateEnvironment, type EnvDetail, type EnvSummary,
} from '@/lib/environments-client'

/**
 * Pick which server the automation runs against, and see exactly what that means.
 *
 * Applies to every app type. A web app switches its base URL and dashboard logins, an API app
 * its service URLs and keys, a mobile app the backend its build talks to — same shape, so this
 * is not special-cased per engine.
 *
 * The variables are shown in full. Someone about to point a suite at a different server needs
 * to see which host and which credentials they are switching to, and a masked value makes that
 * comparison impossible. These are the team's own test credentials and none of this is written
 * to the committed `data/` tree.
 *
 * The active environment's variables are injected into the run child by the run route and beat
 * automation-hub/.env, which stays as the fallback for anything an environment does not define.
 *
 * This is the compact header control; Settings → Automation has the full management card. Both
 * go through lib/environments-client.ts so they cannot disagree.
 */
export function EnvironmentSwitcher({
  app,
  onActiveChange,
}: {
  app: string
  /**
   * Fires with the active environment's name (null when none is active and .env decides).
   * The Hub needs it to report each automation's status for the environment you are pointed
   * at, rather than whichever server happened to run last.
   */
  onActiveChange?: (name: string | null) => void
}) {
  const [envs, setEnvs] = useState<EnvSummary[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<EnvDetail | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftVars, setDraftVars] = useState('')

  // Every setState here is inside an async callback, never in the effect body — the effect
  // only kicks off the fetch. Setting state synchronously in an effect is what
  // react-hooks/set-state-in-effect warns about, and it is a cascading render for no gain.
  const load = useCallback(async () => {
    const list = await fetchEnvironments(app)
    setEnvs(list)
    onActiveChange?.(list.find((e) => e.isActive)?.name ?? null)
  }, [app, onActiveChange])

  useEffect(() => { load() }, [load])

  const active = envs?.find((e) => e.isActive) ?? null

  const activate = async (id: number) => {
    setBusy(true)
    try {
      const res = await activateEnvironment(app, id)
      if (!res.ok) { toast.error(res.error); return }
      toast.success(`Runs now target "${res.name}"`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const startNew = () => {
    setEditing({ id: 0, name: '', description: '', isActive: false, keys: [], updatedAt: null, variables: {} })
    setDraftName('')
    setDraftDesc('')
    setDraftVars('')
  }

  const startEdit = async (id: number) => {
    const detail = await fetchEnvironment(app, id)
    if (!detail) { toast.error('Could not load that environment'); return }
    setEditing(detail)
    setDraftName(detail.name)
    setDraftDesc(detail.description)
    setDraftVars(toLines(detail.variables))
  }

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      const payload = { name: draftName, description: draftDesc, variables: parseLines(draftVars) }
      const isNew = editing.id === 0
      const res = isNew
        ? await createEnvironment(app, payload)
        : await updateEnvironment(app, editing.id, payload)
      if (!res.ok) { toast.error(res.error); return }
      toast.success(isNew ? `Created "${res.name}"` : `Saved "${res.name}"`)
      setEditing(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (env: EnvSummary) => {
    setBusy(true)
    try {
      const res = await deleteEnvironment(app, env.id)
      if (!res.ok) { toast.error(res.error); return }
      toast.success(`Deleted "${env.name}"`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted"
        title="Choose which server the automation runs against"
      >
        <Server className="h-3.5 w-3.5" />
        {envs === null
          ? <span className="text-muted-foreground">Environment…</span>
          : active
            ? <span className="font-medium">{active.name}</span>
            // No environment means .env decides, which is invisible — say so rather than
            // showing a reassuring blank.
            : <span className="text-amber-600 dark:text-amber-400">Using .env</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> Environments
            </DialogTitle>
            <DialogDescription>
              Where this app&apos;s automation runs. The active environment&apos;s variables are
              applied to every run and override <code>automation-hub/.env</code>; anything it
              does not define still falls back to that file.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {envs?.length === 0 && (
              <p className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                No environments yet — runs use <code>automation-hub/.env</code>, which only the
                person who edited it can see. Create one to make the target explicit.
              </p>
            )}
            {envs?.map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded border p-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {e.name}
                    {e.isActive && (
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Check className="h-3 w-3" /> active
                      </Badge>
                    )}
                  </p>
                  {e.description && (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">{e.description}</p>
                  )}
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {e.keys.length} variable{e.keys.length === 1 ? '' : 's'}
                    {e.keys.length ? ` · ${e.keys.slice(0, 4).join(', ')}${e.keys.length > 4 ? '…' : ''}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!e.isActive && (
                    <Button size="sm" variant="secondary" className="h-7 text-xs"
                            disabled={busy} onClick={() => activate(e.id)}>
                      Use this
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                          title="Edit" onClick={() => startEdit(e.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                          title={e.isActive ? 'Switch away before deleting' : 'Delete'}
                          disabled={busy || e.isActive} onClick={() => remove(e)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="secondary" className="gap-1" onClick={startNew}>
              <Plus className="h-4 w-4" /> New environment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${editing.name}` : 'New environment'}</DialogTitle>
            <DialogDescription>
              One <code>KEY=value</code> per line — paste a block straight from a .env file.
              Values are shown in full, because choosing a target means seeing what you are
              choosing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)}
                   placeholder="Production (devsim)" />
            <Input value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)}
                   placeholder="What this target is, who runs it, when it expires" />
            <Textarea
              value={draftVars}
              onChange={(e) => setDraftVars(e.target.value)}
              rows={12}
              className="font-mono text-[11px]"
              placeholder={'EPTTS_MASAR_API_URL=https://host/masar-service/api/v1\nEPTTS_REGISTRY_API_URL=https://host/registry-service/api/v1\nEPTTS_MFG_APIKEY=…'}
            />
            <p className="text-[10px] text-muted-foreground">
              {Object.keys(parseLines(draftVars)).length} variable(s) parsed
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !draftName.trim()} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
