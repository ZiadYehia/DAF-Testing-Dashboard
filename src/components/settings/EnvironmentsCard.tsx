'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  activateEnvironment, createEnvironment, deleteEnvironment, fetchEnvironment, fetchEnvironments,
  parseLines, toLines, updateEnvironment, type EnvDetail, type EnvSummary,
} from '@/lib/environments-client'

/**
 * Manage this app's run targets from Settings.
 *
 * The Automation Hub header has a compact switcher, but that is the only place environments
 * were reachable — so an app whose Hub you had not opened looked as though it had none, and
 * there was nowhere to create the first one outside the Hub. Both surfaces share
 * lib/environments-client.ts so they cannot disagree about what activating or saving does.
 *
 * Environments are per app. That is deliberate: an app's environment carries ITS base URLs and
 * credentials, and the dashboard app and the API app of the same product target different
 * services with different keys. An environment created for one app is therefore not visible in
 * another — create one per app that needs it.
 */
export function EnvironmentsCard({ app }: { app: string }) {
  const [envs, setEnvs] = useState<EnvSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<EnvDetail | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftVars, setDraftVars] = useState('')

  const load = useCallback(async () => {
    setEnvs(await fetchEnvironments(app))
  }, [app])

  useEffect(() => { load() }, [load])

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Environments</CardTitle>
          <CardDescription>
            Which server this app&apos;s automation runs against. The active environment&apos;s
            variables are applied to every run and override <code>automation-hub/.env</code>;
            anything it does not define still falls back to that file. Run history and execution
            status are recorded per environment, so results from one server never overwrite
            another&apos;s.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {envs === null && <div className="h-14 animate-pulse rounded-lg bg-muted/40" />}
          {envs?.length === 0 && (
            <p className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
              No environments for this app yet — runs use <code>automation-hub/.env</code>, which
              only the person who edited it can see. Create one to make the target explicit.
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
          <Button variant="secondary" className="gap-1" onClick={startNew}>
            <Plus className="h-4 w-4" /> New environment
          </Button>
        </CardContent>
      </Card>

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
