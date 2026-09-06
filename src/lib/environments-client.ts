/**
 * Browser-side calls to the environments API.
 *
 * Two components manage environments — the compact switcher in the Automation Hub header and
 * the management card in Settings — and they must agree on what "activate" or "save" does. The
 * fetch calls live here so a change lands in both rather than in whichever one was edited.
 */

export interface EnvSummary {
  id: number
  name: string
  description: string
  isActive: boolean
  /** Variable NAMES only. Values come from fetchEnvironment. */
  keys: string[]
  updatedAt: string | null
}

export interface EnvDetail extends EnvSummary {
  variables: Record<string, string>
}

export interface EnvPayload {
  name: string
  description: string
  variables: Record<string, string>
}

/** Never throws: a failed list degrades to "no environments", which the callers render. */
export async function fetchEnvironments(app: string): Promise<EnvSummary[]> {
  try {
    const res = await fetch(`/api/${app}/environments`)
    return res.ok ? await res.json() : []
  } catch {
    return []
  }
}

export async function fetchEnvironment(app: string, id: number): Promise<EnvDetail | null> {
  try {
    const res = await fetch(`/api/${app}/environments/${id}`)
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

type Result = { ok: true; name: string } | { ok: false; error: string }

async function send(url: string, method: string, body?: unknown): Promise<Result> {
  try {
    const res = await fetch(url, {
      method,
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error ?? `Request failed (${res.status})` }
    return { ok: true, name: data.name ?? '' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export const activateEnvironment = (app: string, id: number) =>
  send(`/api/${app}/environments/${id}`, 'POST', { activate: true })

export const createEnvironment = (app: string, payload: EnvPayload) =>
  send(`/api/${app}/environments`, 'POST', payload)

export const updateEnvironment = (app: string, id: number, payload: EnvPayload) =>
  send(`/api/${app}/environments/${id}`, 'PATCH', payload)

export const deleteEnvironment = (app: string, id: number) =>
  send(`/api/${app}/environments/${id}`, 'DELETE')

/** `KEY=value` lines <-> an object. A textarea is the fastest way to paste a whole config. */
export function parseLines(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const at = line.indexOf('=')
    if (at === -1) continue
    // An empty value is meaningful, not a parse failure: EPTTS_MFG_DISPENSABLE_GTINS= says
    // "this tenant has none", which is different from leaving the variable unset.
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return out
}

export const toLines = (vars: Record<string, string>) =>
  Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n')
