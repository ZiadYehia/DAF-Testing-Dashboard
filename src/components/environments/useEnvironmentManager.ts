'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  activateEnvironment, createEnvironment, deleteEnvironment, fetchEnvironment, fetchEnvironments,
  parseLines, toLines, updateEnvironment, type EnvDetail, type EnvSummary,
} from '@/lib/environments-client'

/**
 * Everything the two environment surfaces do, in one place.
 *
 * The Automation Hub header and Settings → Automation both list, activate, create, edit and
 * delete environments. They used to each own a private copy of this state and of the editor
 * markup, so a fix applied to one silently left the other behind — the two dialogs had already
 * drifted apart in width, labelling and stacking behaviour. The state lives here and the markup
 * lives in EnvironmentRow / EnvironmentFormDialog so there is only ever one of each to change.
 */
export function useEnvironmentManager(
  app: string,
  /**
   * Fires with the active environment's name (null when none is active and .env decides).
   * Must be referentially stable — a `useState` setter is; an inline arrow would re-fire the
   * load effect on every render.
   */
  onActiveChange?: (name: string | null) => void,
) {
  const [envs, setEnvs] = useState<EnvSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<EnvDetail | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftVars, setDraftVars] = useState('')

  // Every setState is inside an async callback, never in the effect body — the effect only
  // kicks off the fetch. Setting state synchronously in an effect is what
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

  const cancelEdit = () => setEditing(null)

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      const payload = { name: draftName.trim(), description: draftDesc.trim(), variables: parseLines(draftVars) }
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

  return {
    envs, active, busy,
    load, activate, remove,
    editing, startNew, startEdit, cancelEdit, save,
    draftName, setDraftName,
    draftDesc, setDraftDesc,
    draftVars, setDraftVars,
  }
}

export type EnvironmentManager = ReturnType<typeof useEnvironmentManager>
