import { NextRequest, NextResponse } from 'next/server'
import { guardApp } from '@/lib/auth'
import { getSetting } from '@/lib/settings'
import { isFeatureEnabled } from '@/lib/ai-config'
import { createSession, closeSession, hasSession, runTurn } from '@automation-hub/engine/authoring'
import type { ChatEvent } from '@automation-hub/types'
import { sseResponse } from '@/lib/sse'

export const runtime = 'nodejs'
// An authoring turn drives a real browser across several steps — give it room.
export const maxDuration = 300

async function guard(app: string): Promise<NextResponse | null> {
  const result = await guardApp(app, 'automation.edit')
  return result.ok ? null : result.response
}

/**
 * POST /api/[app]/automation/chat — run one authoring turn, streamed as SSE.
 * Body: { message, model, sessionId? }. A new session is created when sessionId
 * is absent; its id is emitted as the first `session` event.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const blocked = await guard(app)
  if (blocked) return blocked
  if (!(await isFeatureEnabled(app, 'automationHub'))) {
    return NextResponse.json({ error: 'AI is disabled for this app (Settings → AI & Models)' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const message = String(body?.message ?? '').trim()
  const model = String(body?.model ?? '')
  const sessionId: string | undefined = body?.sessionId || undefined

  if (!message) return NextResponse.json({ error: 'A message is required' }, { status: 400 })
  // Authoring needs Claude's tool-use loop — reject non-Claude models up front.
  if (!sessionId && !model.startsWith('claude')) {
    return NextResponse.json({ error: 'Authoring requires a Claude model' }, { status: 400 })
  }

  // Engine is chosen once, at session creation — a resumed session already has it
  // baked in, so this is only consulted when there's no sessionId yet.
  const engine = body?.engine === 'appium' ? 'appium' as const : 'playwright' as const
  let apkPath = ''
  let avd: string | undefined
  if (!sessionId && engine === 'appium') {
    apkPath = String(body?.appium?.apkPath ?? '').trim()
    if (!apkPath) {
      return NextResponse.json({ error: 'apkPath is required for an Appium session' }, { status: 400 })
    }
    const avdRaw = String(body?.appium?.avd ?? '').trim()
    if (avdRaw) avd = avdRaw
  }

  const apiKey = await getSetting('global', 'ANTHROPIC_API_KEY')
  if (!apiKey && !sessionId) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured. Add it in Settings.' }, { status: 400 })
  }

  return sseResponse(async (emit) => {
    // ChatEvent objects already carry their own `type` field first, so re-merging
    // them onto `{ type: e.type, ...e }` reproduces the exact same JSON as before.
    const send = (e: ChatEvent) => emit(e.type, e)
    try {
      let sid = sessionId
      if (!sid) {
        sid = engine === 'appium'
          ? await createSession(apiKey as string, model, { engine: 'appium', target: { apkPath, avd } })
          : await createSession(apiKey as string, model, { engine: 'playwright', app })
        send({ type: 'session', sessionId: sid })
      } else if (!hasSession(sid)) {
        send({ type: 'error', message: 'Session expired — start a new chat' })
        return
      }
      await runTurn(sid, message, send)
    } catch (err: any) {
      send({ type: 'error', message: err?.message ?? 'Chat failed' })
    }
  }, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

/** DELETE /api/[app]/automation/chat?sessionId=... — close the browser session. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ app: string }> },
) {
  const { app } = await params
  const blocked = await guard(app)
  if (blocked) return blocked

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (sessionId) await closeSession(sessionId)
  return NextResponse.json({ ok: true })
}
