/**
 * Automation Hub — MCP authoring loop (Phase 2).
 *
 * Connects the Next server to the Playwright MCP server over stdio, exposes its
 * browser tools to Claude, and runs an agentic tool-use loop so the user can drive
 * a live browser from a chat prompt. This is the same engine that will power
 * "talk to AI and it does the flow" authoring; Phase 3 turns a session into a spec.
 *
 * Replay never uses this (that's engine/runner.ts) — this is authoring only, and
 * only Claude models do the agentic tool-loop reliably.
 */
import Anthropic from '@anthropic-ai/sdk'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { randomUUID } from 'crypto'
import path from 'path'
import type { ChatEvent } from '../types'

/**
 * Absolute path to the locally-installed Playwright MCP CLI.
 * Built from process.cwd() rather than require.resolve — Turbopack rewrites
 * require.resolve inside bundled route handlers (the Phase 1 lesson).
 */
function playwrightMcpCli(): string {
  return path.join(process.cwd(), 'node_modules', '@playwright', 'mcp', 'cli.js')
}

/** Internal Anthropic model id → dated API id (mirrors src/lib/ai.ts). */
function resolveAnthropicModelId(modelId: string): string {
  const map: Record<string, string> = {
    'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6': 'claude-sonnet-4-6',
  }
  return map[modelId] ?? modelId
}

const SYSTEM_PROMPT = `You are an automation author embedded in a testing dashboard. You drive a real
Chromium browser through the Playwright MCP tools to carry out the flow the user describes
(navigate, click, type, assert what's on screen).

Guidelines:
- Take a snapshot to understand the page before acting; act on one step at a time.
- Prefer resilient targets (roles, visible text, labels) over brittle CSS/XPath — the saved
  test must survive small UI changes.
- After completing the flow, briefly summarise what you did and what you verified, so it can
  later be saved as a replayable Playwright test.
- If a step fails, report what happened instead of guessing wildly.`

interface Session {
  mcp: Client
  transport: StdioClientTransport
  anthropic: Anthropic
  modelId: string
  tools: Anthropic.Tool[]
  /** Full conversation history (Anthropic message params). */
  messages: Anthropic.MessageParam[]
  busy: boolean
  /** Date.now() of the last accessor call — drives the idle-expiry sweep below. */
  lastUsedAt: number
  /**
   * App slug this session is authoring for — undefined when the caller didn't supply
   * one, in which case silent page mining (Phase D) is naturally skipped on close. Only
   * ever set by createSession; page-miner.ts never redefines page-object methods that
   * already exist, so this is safe to carry for the session's whole lifetime.
   */
  app?: string
  /**
   * How many of `messages`' tool-use actions have already been mined into page-object
   * methods (either by a mid-life `chat/save`, or never — 0 initially). closeSession only
   * mines actions AFTER this watermark, so a save-then-close never mines the same
   * actions twice. Set via `markExtracted`.
   */
  extractedActionCount: number
}

const sessions = new Map<string, Session>()

/** Max tool-use iterations per user turn — a runaway-loop backstop. */
const MAX_ITERATIONS = 25

/** Sessions idle longer than this are closed by the sweep (leaked child + browser). */
const SESSION_IDLE_MS = 15 * 60_000
const SWEEP_INTERVAL_MS = 60_000

/** Bump a session's last-used timestamp — call from every accessor that touches it. */
function touch(s: Session): void {
  s.lastUsedAt = Date.now()
}

async function sweepIdleSessions(): Promise<void> {
  const now = Date.now()
  const staleIds: string[] = []
  for (const [id, s] of sessions) {
    if (now - s.lastUsedAt > SESSION_IDLE_MS) staleIds.push(id)
  }
  for (const id of staleIds) {
    await closeSession(id) // reuses the same cleanup as the explicit DELETE path
  }
}

/**
 * Periodic idle-session reaper. Survives HMR re-evaluation via the same
 * globalThis-flag guard src/lib/automation-scheduler.ts uses for its tick timer —
 * at most one interval per process. `.unref()` so it never keeps the process alive.
 */
function startIdleSweep(): void {
  const g = globalThis as typeof globalThis & { __mcpSessionSweepStarted?: boolean }
  if (g.__mcpSessionSweepStarted) return
  g.__mcpSessionSweepStarted = true

  const timer = setInterval(() => {
    sweepIdleSessions().catch((err) => console.error('[mcp-client] idle sweep failed:', err))
  }, SWEEP_INTERVAL_MS)
  timer.unref?.()
}

startIdleSweep()

/**
 * Spawn the Playwright MCP server, connect, and create an authoring session.
 * Returns the session id; the browser stays open across turns until closeSession.
 * `opts.app` (when supplied by the caller — chat/route.ts's `[app]` param) is what
 * gates silent page mining on close; omit it for authoring flows that shouldn't mine.
 */
export async function createSession(
  apiKey: string,
  modelId: string,
  opts?: { app?: string },
): Promise<string> {
  // Spawn the locally-installed CLI via node directly — no npx in the path, and
  // argv passing is space-safe (the Phase 1 robustness fix). cross-spawn (used by
  // StdioClientTransport) still handles any Windows specifics.
  const transport = new StdioClientTransport({
    command: process.execPath, // node
    args: [playwrightMcpCli(), '--headless', '--isolated'],
  })
  const mcp = new Client({ name: 'automation-hub', version: '1.0.0' })
  await mcp.connect(transport)

  const { tools: mcpTools } = await mcp.listTools()
  const tools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: (t.inputSchema ?? { type: 'object', properties: {} }) as Anthropic.Tool.InputSchema,
  }))

  const id = randomUUID()
  sessions.set(id, {
    mcp,
    transport,
    anthropic: new Anthropic({ apiKey }),
    modelId: resolveAnthropicModelId(modelId),
    tools,
    messages: [],
    busy: false,
    lastUsedAt: Date.now(),
    app: opts?.app,
    extractedActionCount: 0,
  })
  return id
}

export function hasSession(id: string): boolean {
  const s = sessions.get(id)
  if (!s) return false
  touch(s)
  return true
}

export interface SessionAction { tool: string; input: unknown }

/**
 * Pull the full transcript (every tool-use action + the last summary text) out of a
 * session's raw message history. Shared by `getTranscript` (all actions, for chat/save)
 * and `closeSession` (actions since the mining watermark, for page-miner.ts).
 */
function extractTranscript(s: Session): { actions: SessionAction[]; summary: string } {
  const actions: SessionAction[] = []
  let summary = ''
  for (const m of s.messages) {
    if (m.role !== 'assistant' || typeof m.content === 'string') continue
    for (const block of m.content) {
      if (block.type === 'tool_use') actions.push({ tool: block.name, input: block.input })
      else if (block.type === 'text' && block.text.trim()) summary = block.text // keep the last
    }
  }
  return { actions, summary }
}

/**
 * Extract the authoring transcript for codegen (Phase 3): the ordered browser
 * actions Claude took (tool_use blocks) plus its final summary text. Returns null
 * if the session is gone or no actions were taken.
 */
export function getTranscript(id: string): { actions: SessionAction[]; summary: string } | null {
  const s = sessions.get(id)
  if (!s) return null
  touch(s)
  const { actions, summary } = extractTranscript(s)
  if (actions.length === 0) return null
  return { actions, summary }
}

/** The (resolved) model id a session is using — so codegen reuses the same model. */
export function getSessionModel(id: string): string | null {
  const s = sessions.get(id)
  if (!s) return null
  touch(s)
  return s.modelId
}

/**
 * Record how many of a session's tool-use actions have already been turned into page
 * methods (chat/save calls this right after mining, with `transcript.actions.length`),
 * so a later close/reap doesn't re-mine — and thus re-append duplicate methods for —
 * actions the save path already covered. No-op if the session is already gone.
 */
export function markExtracted(id: string, count: number): void {
  const s = sessions.get(id)
  if (!s) return
  s.extractedActionCount = count
}

/**
 * Close the browser and drop the session. Safe to call more than once. Also the single
 * choke point silent page mining (Phase D) flows through: both the explicit chat DELETE
 * and the 15-min idle reaper (`sweepIdleSessions`) call this one function, so capturing
 * the transcript here covers both the 'close' and 'reap' reasons from the plan.
 */
export async function closeSession(id: string): Promise<void> {
  const s = sessions.get(id)
  if (!s) return
  sessions.delete(id)

  // Capture everything page-mining needs BEFORE mcp.close() tears down the transport —
  // the session object is still intact at this point, but stale once the browser is gone.
  const { app, anthropic, modelId, extractedActionCount } = s
  const { actions: allActions, summary } = extractTranscript(s)
  const actions = allActions.slice(extractedActionCount)

  try { await s.mcp.close() } catch { /* already gone */ }

  // Fire-and-forget: never block the close response on a model call, and never let a
  // mining failure surface here — page-miner.ts already logs its own errors and never
  // throws, but the dynamic import itself could reject, hence the extra .catch.
  if (app && actions.length > 0) {
    void import('./page-miner')
      .then((m) => m.mineSessionPages({ actions, summary, app, anthropic, modelId, reason: 'close' }))
      .catch((err) => console.error('[mcp-client] page mining failed:', err))
  }
}

/** Convert an MCP tool result into Anthropic tool_result content + a UI preview. */
function convertToolResult(result: any): {
  content: Anthropic.ToolResultBlockParam['content']
  preview: string
  ok: boolean
} {
  const blocks: Exclude<Anthropic.ToolResultBlockParam['content'], string> = []
  let preview = ''
  for (const item of result?.content ?? []) {
    if (item.type === 'text') {
      blocks.push({ type: 'text', text: item.text })
      if (preview.length < 200) preview += item.text
    } else if (item.type === 'image' && item.data && item.mimeType) {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: item.mimeType, data: item.data },
      })
      if (!preview) preview = '[screenshot]'
    }
  }
  if (blocks.length === 0) blocks.push({ type: 'text', text: '(no output)' })
  return { content: blocks, preview: preview.slice(0, 200), ok: !result?.isError }
}

/**
 * Run one user turn through the agentic loop, emitting events as they happen.
 * `emit` is awaited so the route can backpressure the SSE stream.
 */
export async function runTurn(
  id: string,
  userText: string,
  emit: (e: ChatEvent) => void | Promise<void>,
): Promise<void> {
  const s = sessions.get(id)
  if (!s) { await emit({ type: 'error', message: 'Session not found or expired' }); return }
  touch(s)
  if (s.busy) { await emit({ type: 'error', message: 'This session is still working on the previous message' }); return }
  s.busy = true

  s.messages.push({ role: 'user', content: userText })

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await s.anthropic.messages.create({
        model: s.modelId,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        tools: s.tools,
        messages: s.messages,
      })
      s.messages.push({ role: 'assistant', content: response.content })

      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          await emit({ type: 'text', text: block.text })
        }
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )
      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
        await emit({ type: 'done' })
        return
      }

      // Execute each requested tool and gather results into one user message.
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        await emit({ type: 'tool_use', tool: tu.name, input: tu.input })
        try {
          const result = await s.mcp.callTool({
            name: tu.name,
            arguments: (tu.input ?? {}) as Record<string, unknown>,
          })
          const { content, preview, ok } = convertToolResult(result)
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content, is_error: !ok })
          await emit({ type: 'tool_result', tool: tu.name, ok, preview })
        } catch (err: any) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: `Tool error: ${err?.message ?? String(err)}`,
            is_error: true,
          })
          await emit({ type: 'tool_result', tool: tu.name, ok: false, preview: String(err?.message ?? err).slice(0, 200) })
        }
      }
      s.messages.push({ role: 'user', content: toolResults })
    }
    await emit({ type: 'text', text: '\n_(Reached the step limit for one message — send another to continue.)_' })
    await emit({ type: 'done' })
  } catch (err: any) {
    await emit({ type: 'error', message: err?.message ?? 'Authoring run failed' })
  } finally {
    s.busy = false
  }
}
