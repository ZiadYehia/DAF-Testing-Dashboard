/**
 * HTTP exchange recorder + Postman-style run artifacts for the EPTTS API suite.
 *
 * WHY
 *
 * A replayed API test told you only pass/fail. For an EPCIS API that is nearly useless:
 * the interesting question is always "what exactly did we send, and what came back" —
 * especially with a 202-then-poll contract where the meaningful answer arrives several
 * requests later.
 *
 * So every request/response is recorded and each run emits three artifacts:
 *
 *   api-log.html                — self-contained request/response viewer (the Postman-like
 *                                 view; opens straight from the Hub)
 *   api-exchanges.json          — the same data, machine-readable
 *   postman_collection.json     — exactly the requests this run sent, importable into
 *                                 Postman to re-send by hand
 *
 * The runner lifts these out of Playwright's output dir into runs/<ts>/ alongside
 * video.webm and trace.zip.
 *
 * SECRETS: recorded AS SENT, unmasked — headers and bodies both. That is deliberate: an
 * artifact you cannot replay is not worth much, and the Postman collection and the viewer's
 * Copy buttons only work if the credential is really there. The bearer lives 15 minutes.
 *
 * The consequence: `runs/<ts>/` and `test-results/` hold real credentials. Both are gitignored
 * so nothing reaches the repository, but DO NOT attach these files to a ticket or send them
 * outside the team. For evidence that leaves the machine, use
 * scripts/eptts-api-bug-evidence.js — it writes into the committed `data/` tree and redacts.
 */
import { test } from '@playwright/test'
import type { APIResponse } from '@playwright/test'

/** One recorded HTTP round-trip. */
export interface Exchange {
  seq: number
  /** Wall-clock start, ISO. */
  startedAt: string
  /** Which B2B role acted, when known. */
  role: string | null
  method: string
  url: string
  /** Request headers, exactly as sent. */
  requestHeaders: Record<string, string>
  /** Request body, pretty-printed when JSON. */
  requestBody: string | null
  status: number
  statusText: string
  responseHeaders: Record<string, string>
  responseBody: string | null
  durationMs: number
  /** Short label describing the call's role in the test, e.g. "auth", "poll". */
  label: string
}

const exchanges: Exchange[] = []
let seq = 0

const SECRET_HEADERS = new Set(['apikey', 'authorization', 'cookie', 'set-cookie'])

/**
 * Headers are recorded AS SENT, credentials included.
 *
 * These artifacts exist to be replayed — the Postman collection is meant to be imported and
 * re-sent, and the Copy buttons in api-log.html are meant to produce something that works
 * when pasted. A masked `Authorization` makes all of that require hand-editing, and the
 * bearer it hides lives 15 minutes anyway.
 *
 * WHERE THE SECRETS NOW ARE: every run's `runs/<ts>/` folder and `test-results/`. Both are
 * gitignored, so nothing reaches the repository — but these files are no longer safe to
 * attach to a ticket or send to anyone outside the team.
 *
 * Still redacted, deliberately: scripts/eptts-api-bug-evidence.js, which writes into `data/`.
 * That directory IS committed and its contents go to Jira.
 */
function maskHeaders(h: Record<string, string>): Record<string, string> {
  return { ...h }
}

/** Pretty-print JSON bodies, cap anything huge so an artifact stays openable. */
function formatBody(body: unknown, limit = 20_000): string | null {
  if (body === undefined || body === null) return null
  let text: string
  if (typeof body === 'string') {
    try { text = JSON.stringify(JSON.parse(body), null, 2) } catch { text = body }
  } else {
    try { text = JSON.stringify(body, null, 2) } catch { text = String(body) }
  }
  return text.length > limit ? `${text.slice(0, limit)}\n… truncated (${text.length} chars total)` : text
}

export interface RecordInput {
  role?: string | null
  method: string
  url: string
  requestHeaders?: Record<string, string>
  requestBody?: unknown
  label?: string
  startedAt: number
  res: APIResponse
}

/** Record a completed round-trip. Never throws: logging must not fail a test. */
export async function recordExchange(input: RecordInput): Promise<void> {
  let responseBody: string | null = null
  let responseHeaders: Record<string, string> = {}
  let status = 0
  let statusText = ''
  try {
    status = input.res.status()
    statusText = input.res.statusText()
    responseHeaders = input.res.headers()
    const ct = responseHeaders['content-type'] ?? ''
    if (ct.includes('json')) {
      responseBody = formatBody(await input.res.json())
    } else {
      const t = await input.res.text()
      responseBody = t ? formatBody(t) : null
    }
  } catch {
    // A body can only be consumed once; if a caller already read it we still keep the
    // request side, which is the half that is hard to reconstruct.
  }

  exchanges.push({
    seq: ++seq,
    startedAt: new Date(input.startedAt).toISOString(),
    role: input.role ?? null,
    method: input.method,
    url: input.url,
    requestHeaders: maskHeaders(input.requestHeaders ?? {}),
    requestBody: formatBody(input.requestBody),
    status,
    statusText,
    responseHeaders: maskHeaders(responseHeaders),
    responseBody,
    durationMs: Date.now() - input.startedAt,
    label: input.label ?? '',
  })
}

/**
 * Record an attempt that never got a response — a timeout, a reset, a refused connection.
 *
 * recordExchange() needs an APIResponse, so a request that throws was logged as nothing at
 * all. That is the worst case for reading a run afterwards: two commission runs against a
 * wedged SendEPCIS produced a log containing ONE entry, the `auth` call, and the API Console
 * showed no EPCIS exchange. It looked as though the test had never tried to submit, when in
 * fact it had waited 45 s and given up. The attempt is the evidence.
 */
export function recordFailedExchange(input: Omit<RecordInput, 'res'> & { error: unknown }): void {
  const reason = input.error instanceof Error ? input.error.message : String(input.error)
  exchanges.push({
    seq: ++seq,
    startedAt: new Date(input.startedAt).toISOString(),
    role: input.role ?? null,
    method: input.method,
    url: input.url,
    requestHeaders: maskHeaders(input.requestHeaders ?? {}),
    requestBody: formatBody(input.requestBody),
    // 0 is "no HTTP response", distinct from any status the platform could return.
    status: 0,
    statusText: 'no response',
    responseHeaders: {},
    responseBody: `The request did not complete: ${reason.split('\n')[0]}`,
    durationMs: Date.now() - input.startedAt,
    label: input.label ?? '',
  })
}

export function recordedExchanges(): Exchange[] {
  return exchanges
}

export function resetExchanges(): void {
  exchanges.length = 0
  seq = 0
}

// ─── artifact rendering ──────────────────────────────────────────────────────

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function statusClass(status: number): string {
  if (status === 0) return 'err'
  if (status < 300) return 'ok'
  if (status < 400) return 'redir'
  if (status < 500) return 'clienterr'
  return 'err'
}

/**
 * Escape for an HTML *attribute*.
 *
 * The copy buttons carry their payload in `data-copy`, and an EPCIS document is full of `"`
 * — one unescaped quote closes the attribute early and the rest of the JSON becomes stray
 * markup. Newlines are encoded too, so a multi-line body survives as one attribute value and
 * comes back off the clipboard with its line breaks intact.
 */
const attr = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '&#10;')

/** The request half as plain text, shaped like an HTTP request so it pastes anywhere. */
function requestText(e: Exchange): string {
  const headers = Object.entries(e.requestHeaders ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n')
  return [
    `${e.method} ${e.url}`,
    headers,
    '',
    e.requestBody ?? '(no request body)',
  ].join('\n')
}

/** The response half, including the "no response" case a timeout records. */
function responseText(e: Exchange): string {
  const headers = Object.entries(e.responseHeaders ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n')
  return [
    e.status === 0 ? 'NO RESPONSE' : `HTTP ${e.status} ${e.statusText}`,
    `(${e.durationMs} ms)`,
    headers,
    '',
    e.responseBody ?? '(no response body)',
  ].join('\n')
}

/** Both halves, for the "Copy all" on the summary row. */
const transcript = (e: Exchange) =>
  `# ${e.label || e.url}${e.role ? ` (as ${e.role})` : ''}\n\n${requestText(e)}\n\n--- response ---\n${responseText(e)}`

/** A self-contained request/response viewer — no external assets, opens from the Hub. */
function renderHtml(title: string, list: Exchange[]): string {
  const rows = list.map((e) => `
<details class="ex" ${e.status >= 400 || e.status === 0 ? 'open' : ''}>
  <summary>
    <span class="seq">#${e.seq}</span>
    <span class="method m-${esc(e.method.toLowerCase())}">${esc(e.method)}</span>
    <span class="status s-${statusClass(e.status)}">${e.status || '—'}</span>
    <span class="path">${esc(e.url.replace(/^https?:\/\/[^/]+/, ''))}</span>
    ${e.role ? `<span class="role">${esc(e.role)}</span>` : ''}
    ${e.label ? `<span class="label">${esc(e.label)}</span>` : ''}
    <span class="ms">${e.durationMs} ms</span>
    <button class="copy" data-copy="${attr(transcript(e))}"
            title="Copy the whole exchange">Copy all</button>
  </summary>
  <div class="body">
    <div class="pane">
      <h4>Request <button class="copy" data-copy="${attr(requestText(e))}">Copy</button></h4>
      <div class="url">${esc(e.url)}</div>
      <table class="hdrs">${Object.entries(e.requestHeaders).map(([k, v]) =>
        `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
      ${e.requestBody ? `<pre>${esc(e.requestBody)}</pre>` : '<p class="none">no body</p>'}
    </div>
    <div class="pane">
      <h4>Response <span class="s-${statusClass(e.status)}">${e.status} ${esc(e.statusText)}</span>
        <button class="copy" data-copy="${attr(responseText(e))}">Copy</button></h4>
      <table class="hdrs">${Object.entries(e.responseHeaders)
        .filter(([k]) => /content-type|content-length|date/i.test(k))
        .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
      ${e.responseBody ? `<pre>${esc(e.responseBody)}</pre>` : '<p class="none">no body</p>'}
    </div>
  </div>
</details>`).join('\n')

  const failed = list.filter((e) => e.status >= 400 || e.status === 0).length

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)} — API log</title><style>
:root{--bg:#0f1420;--panel:#171d2b;--line:#2a3244;--fg:#e6e9ef;--dim:#8b95a8}
@media (prefers-color-scheme:light){:root{--bg:#f6f7f9;--panel:#fff;--line:#e2e5ea;--fg:#1a1e26;--dim:#6b7280}}
*{box-sizing:border-box}
body{margin:0;padding:20px;background:var(--bg);color:var(--fg);
  font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
h1{font-size:16px;margin:0 0 4px}
.meta{color:var(--dim);margin-bottom:16px;font-size:12px}
.ex{background:var(--panel);border:1px solid var(--line);border-radius:6px;margin-bottom:8px}
summary{cursor:pointer;padding:9px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
summary::-webkit-details-marker{display:none}
.seq{color:var(--dim);min-width:34px}
.method{font-weight:700;min-width:52px}
.m-post{color:#f0a35e}.m-get{color:#5eb0f0}.m-put{color:#c98ff0}.m-delete{color:#f07070}
.status{font-weight:700;min-width:38px}
.s-ok{color:#4ec9a0}.s-clienterr{color:#f0a35e}.s-err{color:#f07070}.s-redir{color:#5eb0f0}
.path{flex:1;min-width:220px;word-break:break-all}
.role,.label{font-size:11px;padding:1px 7px;border:1px solid var(--line);border-radius:10px;color:var(--dim)}
.ms{color:var(--dim);font-size:11px}
.body{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 12px 12px}
@media (max-width:900px){.body{grid-template-columns:1fr}}
.pane{min-width:0}
h4{margin:6px 0;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--dim)}
.url{color:var(--dim);font-size:11px;margin-bottom:6px;word-break:break-all}
.hdrs{border-collapse:collapse;width:100%;margin-bottom:8px;font-size:11px}
.hdrs th{text-align:left;color:var(--dim);font-weight:400;padding:1px 8px 1px 0;white-space:nowrap;vertical-align:top}
.hdrs td{word-break:break-all}
pre{background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:10px;
  overflow-x:auto;max-height:420px;margin:0;font-size:12px}
.none{color:var(--dim);font-style:italic;margin:0}
.copy{margin-left:8px;padding:1px 7px;font:inherit;font-size:11px;color:var(--dim);
  background:transparent;border:1px solid var(--line);border-radius:4px;cursor:pointer}
.copy:hover{color:var(--fg);border-color:var(--dim)}
.copy.done{color:#22c55e;border-color:#22c55e}
summary .copy{float:right}
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">${list.length} exchange(s)${failed ? ` · ${failed} with status ≥ 400 (expanded below)` : ''}
 · <strong>contains real credentials — do not share this file</strong>
 · generated by automation-hub/lib/eptts-api-log.ts</div>
${rows || '<p class="none">No HTTP exchanges were recorded for this run.</p>'}
<script>
// One listener on the document rather than one per button: a run can record dozens of
// exchanges, and this file is opened straight from disk with no bundler to help.
document.addEventListener('click', function (ev) {
  var btn = ev.target.closest && ev.target.closest('.copy')
  if (!btn) return
  // Inside a <summary>, a click would also toggle the <details> open or shut.
  ev.preventDefault()
  ev.stopPropagation()
  var text = btn.getAttribute('data-copy') || ''
  var done = function () {
    var was = btn.textContent
    btn.textContent = 'Copied'
    btn.classList.add('done')
    setTimeout(function () { btn.textContent = was; btn.classList.remove('done') }, 1400)
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, fallback)
  } else {
    fallback()
  }
  // file:// and older browsers refuse the async clipboard API; a hidden textarea still works.
  function fallback() {
    var ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); done() } catch (e) { btn.textContent = 'Copy failed' }
    document.body.removeChild(ta)
  }
})
</script>
</body></html>`
}

/** The exact requests this run sent, as an importable Postman collection. */
function renderPostman(title: string, list: Exchange[]): string {
  return JSON.stringify({
    info: {
      _postman_id: `eptts-run-${Date.now().toString(36)}`,
      name: `${title} (recorded run)`,
      description: [
        'Generated from an actual Automation Hub run — these are the requests that were sent,',
        'in order, with their real bodies.',
        '',
        'Credential headers are MASKED. Before sending, set `apikey` (for /auth) and',
        '`Authorization: Bearer <token>` from your own environment. Disable SSL verification:',
        'the host serves a self-signed certificate. Connect the Citrix VPN first.',
      ].join('\n'),
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: list.map((e) => ({
      name: `#${e.seq} ${e.method} ${e.url.replace(/^https?:\/\/[^/]+/, '')}${e.label ? ` — ${e.label}` : ''}`,
      request: {
        method: e.method,
        header: Object.entries(e.requestHeaders).map(([key, value]) => ({
          key, value, type: 'text',
          ...(SECRET_HEADERS.has(key.toLowerCase()) ? { description: 'set this yourself — masked in the recording' } : {}),
        })),
        ...(e.requestBody
          ? { body: { mode: 'raw', raw: e.requestBody, options: { raw: { language: 'json' } } } }
          : {}),
        url: { raw: e.url },
        description: `Recorded response: ${e.status} ${e.statusText} in ${e.durationMs} ms`,
      },
      response: [{
        name: `${e.status} ${e.statusText}`,
        code: e.status,
        status: e.statusText,
        body: e.responseBody ?? '',
        header: Object.entries(e.responseHeaders).map(([key, value]) => ({ key, value })),
      }],
    })),
  }, null, 2)
}

/**
 * Write the three artifacts into Playwright's output dir and attach them to the test.
 *
 * Written to `testInfo.outputPath` so the runner can lift them into runs/<ts>/, AND
 * attached via `testInfo.attach` so they also appear in the Playwright HTML report and
 * trace. Never throws — an artifact problem must not fail a passing test.
 */
export async function writeApiArtifacts(title?: string): Promise<void> {
  const list = recordedExchanges()
  if (!list.length) return

  let info: ReturnType<typeof test.info>
  try { info = test.info() } catch { return } // called outside a test
  const name = title ?? info.title

  const files: [string, string, string][] = [
    ['api-log.html', renderHtml(name, list), 'text/html'],
    ['api-exchanges.json', JSON.stringify(list, null, 2), 'application/json'],
    ['api-postman-collection.json', renderPostman(name, list), 'application/json'],
  ]

  for (const [file, body, contentType] of files) {
    try {
      const p = info.outputPath(file)
      const { writeFile } = await import('fs/promises')
      await writeFile(p, body, 'utf8')
      await info.attach(file, { path: p, contentType })
    } catch {
      // Best effort: keep going so one bad artifact does not lose the others.
    }
  }
}
