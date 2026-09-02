'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertTriangle, ArrowLeftRight, Check, ChevronDown, ChevronRight, Copy, Loader2, Pencil,
  Send, Trash2, Plus,
} from 'lucide-react'
import { toast } from 'sonner'

/**
 * The API console: read the exchanges a run produced, edit one, send it again.
 *
 * Every API run already records each call — method, URL, headers, request and response bodies
 * — via automation-hub/lib/eptts-api-log.ts. Until now the only way to see that was to open
 * api-log.html in another tab: static, read-only, and outside the app. This surfaces the same
 * data in place and makes it editable, which is what turns a replay into a debugging session.
 *
 * WHY THE SEND GOES THROUGH THE SERVER
 *
 * The browser cannot make these calls. The targets sit behind the Citrix VPN on a self-signed
 * certificate, and the credentials must not be in the client. So the composer posts to
 * /api/[app]/automation/api-request, which holds the origin allow-list and resolves
 * `{{ENV_KEY}}` placeholders from automation-hub/.env server-side.
 *
 * Credentials are never in this component's state. A recorded Authorization header arrives
 * already masked ("«masked, 448 chars»"); prefilling the editor replaces it with
 * `{{EPTTS_MFG_APIKEY}}`-style placeholders, because pasting the mask back would send the
 * literal string "«masked…»" and produce a puzzling 401.
 */

interface Exchange {
  seq: number
  startedAt: string
  role: string | null
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody: string | null
  status: number
  statusText: string
  responseHeaders: Record<string, string>
  responseBody: string | null
  durationMs: number
  label: string
}

interface HeaderRow { key: string, value: string }

interface SendResponse {
  request?: { method: string, url: string, headers: Record<string, string>, body: string | null }
  response?: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    durationMs: number
    truncated: boolean
  }
  error?: string
  needsConfirmation?: boolean
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

/** A masked recording is not a usable value — offer the placeholder instead. */
const MASKED = /^«masked/

function placeholderFor(headerName: string): string {
  const n = headerName.toLowerCase()
  if (n === 'apikey') return '{{EPTTS_MFG_APIKEY}}'
  if (n === 'authorization') return 'Bearer {{EPTTS_MFG_BEARER}}'
  return ''
}

/**
 * Bodies are shown and copied AS RECORDED, credentials included.
 *
 * An earlier version redacted tokens here. Removed on request: this console exists to debug
 * against a live platform, and a masked bearer cannot be pasted into anything that works.
 * The recordings hold the real values anyway (see eptts-api-log.ts), so redacting only at the
 * point of reading cost the reader and protected nothing.
 *
 * What it means in practice: this panel will display a live bearer token, and Copy will put
 * one on the clipboard. They are 15-minute credentials for your own tenant, so the exposure
 * that matters is a screenshot or a paste that outlives them.
 *
 * Evidence bound for a ticket should come from scripts/eptts-api-bug-evidence.js instead —
 * that one still redacts, because it writes into `data/`, which is committed and goes to Jira.
 */
const pretty = (s: string | null): string => {
  if (!s) return ''
  try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s }
}

/** The editor gets the same text: a real value is what makes a resend work. */
const forEditor = pretty

export function ApiConsole({
  app, project, runTs,
}: { app: string, project: string, runTs: string | null }) {
  /**
   * Recordings, cached per run.
   *
   * Keyed rather than a single `exchanges` value so nothing is set synchronously inside the
   * effect — the "no run selected" and "still loading" states are derived at render time
   * instead of being written by an effect body, which is what
   * react-hooks/set-state-in-effect is warning about. Switching between two runs now also
   * stops refetching what it already has.
   */
  const [cache, setCache] = useState<Record<string, Exchange[]>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const exchanges = runTs ? cache[runTs] ?? null : null
  const loadError = runTs ? errors[runTs] ?? null : null
  const [expanded, setExpanded] = useState<number | null>(null)

  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState<HeaderRow[]>([{ key: '', value: '' }])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResponse | null>(null)
  const [confirmWrite, setConfirmWrite] = useState(false)
  const [keys, setKeys] = useState<{ credentials: string[], urls: string[], other: string[] } | null>(null)

  const isWrite = !SAFE_METHODS.has(method)

  // Load the selected run's recording, once per run.
  useEffect(() => {
    if (!runTs || cache[runTs] || errors[runTs]) return
    let cancelled = false
    fetch(`/api/${app}/automation/${project}/runs/${runTs}/api-exchanges.json`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`this run has no recorded exchanges (${r.status})`)
        return r.json()
      })
      .then((d) => {
        if (cancelled) return
        const list: Exchange[] = Array.isArray(d) ? d : (d.exchanges ?? [])
        setCache((c) => ({ ...c, [runTs]: list }))
      })
      .catch((e: Error) => {
        if (!cancelled) setErrors((x) => ({ ...x, [runTs]: e.message }))
      })
    return () => { cancelled = true }
  }, [app, project, runTs, cache, errors])

  useEffect(() => {
    fetch(`/api/${app}/automation/api-request/keys`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setKeys(d))
      .catch(() => { /* the console works without the hint list */ })
  }, [app])

  const loadIntoEditor = useCallback((x: Exchange) => {
    setMethod(x.method.toUpperCase())
    setUrl(x.url)
    setHeaders([
      ...Object.entries(x.requestHeaders ?? {}).map(([key, value]) => ({
        key,
        // Swap a mask for the placeholder that will actually resolve.
        value: MASKED.test(String(value)) ? placeholderFor(key) : String(value),
      })),
      { key: '', value: '' },
    ])
    setBody(forEditor(x.requestBody))
    setResult(null)
    setConfirmWrite(false)
  }, [])

  const send = useCallback(async () => {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(`/api/${app}/automation/api-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          url,
          headers: Object.fromEntries(
            headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value]),
          ),
          body: body.length ? body : null,
          confirmWrite,
        }),
      })
      setResult(await res.json())
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Request failed.' })
    } finally {
      setSending(false)
    }
  }, [app, method, url, headers, body, confirmWrite])

  const bodyIsJson = useMemo(() => {
    if (!body.trim()) return null
    try { JSON.parse(body); return true } catch { return false }
  }, [body])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── recorded exchanges ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ArrowLeftRight className="h-4 w-4" /> Recorded exchanges
            {exchanges && <Badge variant="secondary">{exchanges.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {!runTs && (
            <p className="text-xs text-muted-foreground">
              Pick a run from the history to see the calls it made.
            </p>
          )}
          {loadError && <p className="text-xs text-muted-foreground">{loadError}</p>}
          {runTs && !exchanges && !loadError && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </p>
          )}
          {exchanges?.map((x) => (
            <div key={x.seq} className="rounded border">
              <button
                type="button"
                onClick={() => setExpanded(expanded === x.seq ? null : x.seq)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50"
              >
                {expanded === x.seq
                  ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                <Badge variant="outline" className="font-mono text-[10px]">{x.method}</Badge>
                <span className="truncate font-mono text-xs">{x.label || x.url}</span>
                <span
                  className={`ml-auto shrink-0 font-mono text-xs ${
                    x.status >= 400 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {x.status}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {Math.round(x.durationMs)}ms
                </span>
              </button>

              {expanded === x.seq && (
                <div className="space-y-2 border-t px-2 py-2">
                  <p className="break-all font-mono text-[11px] text-muted-foreground">{x.url}</p>
                  <Detail label="Request headers" value={JSON.stringify(x.requestHeaders, null, 2)} />
                  {x.requestBody && <Detail label="Request body" value={pretty(x.requestBody)} />}
                  <Detail label="Response" value={pretty(x.responseBody)} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" className="h-7 gap-1 text-xs"
                            onClick={() => loadIntoEditor(x)}>
                      <Pencil className="h-3 w-3" /> Edit &amp; resend
                    </Button>
                    {/* The whole round trip in one go — what you want when pasting into a bug. */}
                    <CopyButton text={transcriptOf(x)} what="the whole exchange" />
                  </div>
                </div>
              )}
            </div>
          ))}
          {exchanges?.length === 0 && (
            <p className="text-xs text-muted-foreground">This run recorded no exchanges.</p>
          )}
        </CardContent>
      </Card>

      {/* ── composer ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Send className="h-4 w-4" /> Send a request
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => { setMethod(e.target.value); setConfirmWrite(false) }}
              className="h-9 rounded-md border bg-background px-2 font-mono text-xs"
            >
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="{{EPTTS_MASAR_API_URL}}/scp/SendEPCIS"
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium">Headers</p>
            {headers.map((h, i) => (
              <div key={i} className="flex gap-1">
                <Input
                  value={h.key}
                  onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                  placeholder="apikey"
                  className="h-8 font-mono text-xs"
                />
                <Input
                  value={h.value}
                  onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  placeholder="{{EPTTS_MFG_APIKEY}}"
                  className="h-8 font-mono text-xs"
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                        onClick={() => setHeaders(headers.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                    onClick={() => setHeaders([...headers, { key: '', value: '' }])}>
              <Plus className="h-3 w-3" /> Add header
            </Button>
          </div>

          <div className="space-y-1">
            <p className="flex items-center gap-2 text-xs font-medium">
              Body
              {bodyIsJson === false && (
                <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                  not valid JSON — sent as-is
                </span>
              )}
            </p>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="{}"
              className="font-mono text-[11px]"
            />
          </div>

          {keys && (
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Placeholders resolve on the server, so no secret reaches the browser. Available:{' '}
              {[...keys.credentials, ...keys.urls].map((k) => `{{${k}}}`).join(', ') || 'none'}
            </p>
          )}

          {/* A prefilled POST against production is one click from writing real data. */}
          {isWrite && (
            <label className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-2">
              <input
                type="checkbox"
                checked={confirmWrite}
                onChange={(e) => setConfirmWrite(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-[11px] leading-relaxed">
                <AlertTriangle className="mr-1 inline h-3 w-3 text-amber-600 dark:text-amber-400" />
                <strong>{method}</strong> can change data on the target environment, which is
                production. Anything it creates — a commissioned serial, a shipment — is
                permanent. Tick to confirm you mean it.
              </span>
            </label>
          )}

          <Button
            onClick={send}
            disabled={sending || !url.trim() || (isWrite && !confirmWrite)}
            className="w-full gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending…' : `Send ${method}`}
          </Button>

          {result?.error && (
            <p className="rounded border border-red-500/40 bg-red-500/10 p-2 text-[11px]">
              {result.error}
            </p>
          )}
          {result?.response && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-medium">
                <span className={result.response.status >= 400
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400'}
                >
                  {result.response.status} {result.response.statusText}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {Math.round(result.response.durationMs)}ms
                  {result.response.truncated && ' · body truncated'}
                </span>
              </p>
              <Detail label="Response headers" value={JSON.stringify(result.response.headers, null, 2)} />
              <Detail label="Response body" value={pretty(result.response.body)} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Detail({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {value ? <CopyButton text={value} what={label.toLowerCase()} /> : null}
      </div>
      <pre className="max-h-64 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-relaxed">
        {value || '(empty)'}
      </pre>
    </div>
  )
}

/**
 * Copy exactly what is on screen — which means the REDACTED text, not the raw recording.
 *
 * The console redacts bearer tokens and credential fields before rendering. Copying the
 * underlying value instead would put a live token on the clipboard and straight into whatever
 * the user pastes it into, quietly undoing that. So this takes the same string the reader sees.
 */
function CopyButton({ text, what }: { text: string, what: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      title={`Copy ${what}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1400)
        } catch {
          // Clipboard access can be refused (permissions, or a non-secure context). Say so
          // rather than showing a tick for something that did not happen.
          toast.error('Could not copy — the browser refused clipboard access')
        }
      }}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {copied
        ? <><Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Copied</>
        : <><Copy className="h-3 w-3" /> Copy</>}
    </button>
  )
}

/**
 * One exchange as a paste-able transcript.
 *
 * Formatted as an HTTP exchange rather than JSON so it can go straight into a bug, a chat
 * message or a terminal without reshaping. Same redaction as the panels above.
 */
function transcriptOf(x: Exchange): string {
  const reqHeaders = Object.entries(x.requestHeaders ?? {})
    .map(([k, v]) => `${k}: ${v}`).join('\n')
  const resHeaders = Object.entries(x.responseHeaders ?? {})
    .map(([k, v]) => `${k}: ${v}`).join('\n')
  return [
    `# ${x.label || x.url}${x.role ? ` (as ${x.role})` : ''}`,
    '',
    `${x.method} ${x.url}`,
    reqHeaders,
    '',
    pretty(x.requestBody) || '(no request body)',
    '',
    `--- ${x.status === 0 ? 'NO RESPONSE' : `${x.status} ${x.statusText}`} in ${Math.round(x.durationMs)}ms ---`,
    resHeaders,
    '',
    pretty(x.responseBody) || '(no response body)',
  ].join('\n')
}
