import { NextRequest, NextResponse } from 'next/server'
import https from 'https'
import http from 'http'
import fs from 'fs/promises'
import path from 'path'
import { guardApp } from '@/lib/auth'
import { getApp } from '@/lib/apps'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/[app]/automation/api-request — send one hand-edited HTTP request.
 *
 * This is the send half of the Hub's API console: the user opens a recorded exchange, edits
 * the method, URL, headers or body, and fires it. The browser cannot do this itself — the
 * target sits behind the Citrix VPN on a self-signed certificate, and the credentials must
 * never reach the client — so it is proxied here.
 *
 * THREE THINGS THIS DELIBERATELY REFUSES TO DO
 *
 * 1. It is not an open proxy. The target's ORIGIN must match one already configured in
 *    automation-hub/.env. Without that check, any authenticated user could point this at
 *    any host reachable from the server — including cloud metadata endpoints — and read the
 *    response. The allow-list is derived from configuration, not from the request.
 *
 * 2. It never returns a secret. Header values may contain `{{ENV_KEY}}` placeholders, which
 *    are resolved server-side from the hub .env. The response echoes the request with the
 *    placeholders still in place, so a token cannot be lifted out of the network tab, the
 *    React state, or a screenshot of the console.
 *
 * 3. It does not pretend to be safe. The target here is production: a POST from this console
 *    commissions real serial numbers. The client is required to send `confirmWrite: true` for
 *    any non-idempotent method, so a mis-click on a prefilled POST cannot write.
 */

/** Methods that cannot change state, and so need no write confirmation. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const ALLOWED_METHODS = new Set([...SAFE_METHODS, 'POST', 'PUT', 'PATCH', 'DELETE'])

/** Response bodies are for reading, not for downloading a database through. */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 60_000

/** Headers whose value must never be echoed back to the browser. */
const SECRET_HEADERS = new Set(['authorization', 'apikey', 'cookie', 'set-cookie', 'proxy-authorization'])

const HUB_ENV = path.join(process.cwd(), 'automation-hub', '.env')

/** Parse the hub .env into a map. Values stay on the server. */
async function hubEnv(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(HUB_ENV, 'utf8')
    const out: Record<string, string> = {}
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Origins this app is allowed to talk to: every `*_URL` value in the hub .env.
 *
 * Configuration is the only acceptable source. Taking it from the request — even
 * "just the host part" — is what turns a convenience feature into an SSRF hole.
 */
function allowedOrigins(env: Record<string, string>): Set<string> {
  const out = new Set<string>()
  for (const [key, value] of Object.entries(env)) {
    if (!/_URL$/.test(key) || !value) continue
    try { out.add(new URL(value).origin) } catch { /* not a URL — ignore */ }
  }
  return out
}

/** Substitute {{ENV_KEY}} from the hub .env. Unknown keys are reported, not silently blank. */
function resolvePlaceholders(
  value: string,
  env: Record<string, string>,
  missing: Set<string>,
): string {
  return value.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_m, key: string) => {
    if (env[key] === undefined) { missing.add(key); return _m }
    return env[key]
  })
}

interface SendResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  durationMs: number
  truncated: boolean
}

function send(
  target: URL,
  method: string,
  headers: Record<string, string>,
  body: string | null,
): Promise<SendResult> {
  const transport = target.protocol === 'http:' ? http : https
  const startedAt = Date.now()

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'http:' ? 80 : 443),
        path: `${target.pathname}${target.search}`,
        method,
        headers,
        // The EPTTS hosts serve a self-signed certificate; the suite has the same setting in
        // playwright.config.ts. Scoped to this request, not to the process.
        ...(target.protocol === 'https:' ? { rejectUnauthorized: false } : {}),
      },
      (res) => {
        const chunks: Buffer[] = []
        let total = 0
        let truncated = false
        res.on('data', (c: Buffer) => {
          total += c.length
          if (total > MAX_RESPONSE_BYTES) { truncated = true; res.destroy(); return }
          chunks.push(c)
        })
        const finish = () => resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: Object.fromEntries(
            Object.entries(res.headers).map(([k, v]) => [
              k,
              SECRET_HEADERS.has(k.toLowerCase())
                ? `«masked, ${String(v).length} chars»`
                : Array.isArray(v) ? v.join(', ') : String(v ?? ''),
            ]),
          ),
          body: Buffer.concat(chunks).toString('utf8'),
          durationMs: Date.now() - startedAt,
          truncated,
        })
        res.on('end', finish)
        res.on('close', finish)
      },
    )
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`no response within ${REQUEST_TIMEOUT_MS / 1000}s`))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  // 'automation.run' rather than a new permission: sending a request from the console is the
  // same capability as replaying a spec that sends it.
  const guard = await guardApp(app, 'automation.run')
  if (!guard.ok) return guard.response

  const appConfig = await getApp(app)
  if (!appConfig) return NextResponse.json({ error: 'App not found' }, { status: 404 })
  if (appConfig.type !== 'api') {
    return NextResponse.json(
      { error: 'The API console is only available for apps of type "api".' },
      { status: 400 },
    )
  }

  let input: {
    method?: string
    url?: string
    headers?: Record<string, string>
    body?: string | null
    confirmWrite?: boolean
  }
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 })
  }

  const method = (input.method ?? 'GET').toUpperCase()
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: `Method ${method} is not allowed.` }, { status: 400 })
  }
  if (!SAFE_METHODS.has(method) && input.confirmWrite !== true) {
    return NextResponse.json(
      {
        error: `${method} can change data on the target environment. Re-send with ` +
          'confirmWrite: true once you intend that.',
        needsConfirmation: true,
      },
      { status: 428 },
    )
  }

  const env = await hubEnv()
  const missing = new Set<string>()

  let target: URL
  try {
    target = new URL(resolvePlaceholders(input.url ?? '', env, missing))
  } catch {
    return NextResponse.json({ error: 'A valid absolute URL is required.' }, { status: 400 })
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json({ error: 'Only http and https are supported.' }, { status: 400 })
  }

  const allowed = allowedOrigins(env)
  if (!allowed.has(target.origin)) {
    return NextResponse.json(
      {
        error: `${target.origin} is not a configured target for this app. Allowed: ` +
          `${[...allowed].join(', ') || '(none configured in automation-hub/.env)'}.`,
      },
      { status: 403 },
    )
  }

  const resolvedHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.headers ?? {})) {
    if (!k.trim()) continue
    resolvedHeaders[k] = resolvePlaceholders(String(v), env, missing)
  }
  if (missing.size) {
    return NextResponse.json(
      { error: `Unknown placeholder(s): ${[...missing].map((k) => `{{${k}}}`).join(', ')}.` },
      { status: 400 },
    )
  }

  const body = typeof input.body === 'string' && input.body.length ? input.body : null
  if (body && !('content-type' in Object.fromEntries(
    Object.entries(resolvedHeaders).map(([k, v]) => [k.toLowerCase(), v]),
  ))) {
    resolvedHeaders['Content-Type'] = 'application/json'
  }
  if (body) resolvedHeaders['Content-Length'] = String(Buffer.byteLength(body))

  try {
    const result = await send(target, method, resolvedHeaders, body)
    return NextResponse.json({
      request: {
        method,
        url: target.toString(),
        // The placeholders the CLIENT sent, never the resolved values.
        headers: input.headers ?? {},
        body: body ?? null,
      },
      response: result,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Request failed.' },
      { status: 502 },
    )
  }
}
