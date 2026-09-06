'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  activateEnvironment, createEnvironment, deleteEnvironment, fetchEnvironment, fetchEnvironments,
  updateEnvironment, type EnvDetail, type EnvSummary,
} from '@/lib/environments-client'

/**
 * One variable being edited.
 *
 * A row, not a line of text. The editor shows a field per variable, and a field needs an
 * identity that survives renaming its key and reordering its neighbours — otherwise React
 * reuses the wrong input and your cursor jumps to another row mid-word. `id` is that identity
 * and never reaches the server; only key and value do.
 */
export interface VarRow {
  id: number
  key: string
  value: string
}

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
  const [draftVars, setDraftVars] = useState<VarRow[]>([])
  // Row ids only have to be unique within one editing session, so a counter beats anything
  // derived from the key — which is the one thing the user is about to change.
  const nextId = useRef(0)
  const makeRows = (vars: Record<string, string>): VarRow[] =>
    Object.entries(vars).map(([key, value]) => ({ id: nextId.current++, key, value }))
  const blankRow = (): VarRow => ({ id: nextId.current++, key: '', value: '' })

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
    // One empty row, so a new environment opens on a field you can type in rather than on a
    // button you have to find first.
    setDraftVars([blankRow()])
  }

  const startEdit = async (id: number) => {
    const detail = await fetchEnvironment(app, id)
    if (!detail) { toast.error('Could not load that environment'); return }
    setEditing(detail)
    setDraftName(detail.name)
    setDraftDesc(detail.description)
    setDraftVars(makeRows(detail.variables))
  }

  const cancelEdit = () => setEditing(null)

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      const payload = { name: draftName.trim(), description: draftDesc.trim(), variables: rowsToVars(draftVars) }
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

  /** Append a blank row and hand back its id, so the caller can focus it. */
  const addVar = () => {
    const row = blankRow()
    setDraftVars((rows) => [...rows, row])
    return row.id
  }

  const setVar = (id: number, patch: Partial<Omit<VarRow, 'id'>>) =>
    setDraftVars((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const removeVar = (id: number) => setDraftVars((rows) => rows.filter((r) => r.id !== id))

  /** Replace every row — used when a `.env` block is pasted in wholesale. */
  const replaceVars = (vars: Record<string, string>) => setDraftVars(makeRows(vars))

  /**
   * Insert parsed variables at a row, replacing it. This is the paste path: dropping a block
   * into an empty key field should become that many rows, not one row with newlines in its name.
   */
  const insertVarsAt = (id: number, vars: Record<string, string>) =>
    setDraftVars((rows) => {
      const at = rows.findIndex((r) => r.id === id)
      if (at === -1) return rows
      return [...rows.slice(0, at), ...makeRows(vars), ...rows.slice(at + 1)]
    })

  return {
    envs, active, busy,
    load, activate, remove,
    editing, startNew, startEdit, cancelEdit, save,
    draftName, setDraftName,
    draftDesc, setDraftDesc,
    draftVars, setDraftVars, addVar, setVar, removeVar, replaceVars, insertVarsAt,
  }
}

/**
 * Rows to the object the API stores.
 *
 * A row with no key is a field someone opened and did not fill, not a variable named "" — it is
 * dropped. Whitespace around a key is always a typo; whitespace inside a value might not be, so
 * only the key is trimmed. A repeated key keeps the last row, which is what a `.env` file does.
 */
export function rowsToVars(rows: VarRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    const key = r.key.trim()
    if (key) out[key] = r.value
  }
  return out
}

export type EnvironmentManager = ReturnType<typeof useEnvironmentManager>
