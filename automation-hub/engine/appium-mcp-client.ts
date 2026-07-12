/**
 * Automation Hub — Appium MCP authoring loop (Phase 8).
 *
 * The Appium-engine counterpart to engine/mcp-client.ts: connects the Next
 * server to the `appium-mcp` MCP server over stdio, exposes its mobile tools
 * to Claude, and runs the same agentic tool-use loop so the user can drive a
 * real Android app (on the local emulator) from a chat prompt.
 *
 * `appium-mcp` supports "embedded local drivers" — when its own
 * `appium_session_management` tool is called with action='create',
 * platform='android', and no `remoteServerUrl`, it drives the bundled
 * appium-uiautomator2-driver directly in-process. There is no separate
 * Appium server to spawn or manage here (contrast with engine/appium-runner.ts,
 * whose replay path connects to a real spawned Appium server via webdriverio's
 * remote() — a different architecture; don't conflate the two).
 *
 * Replay never uses this (that's engine/appium-runner.ts) — this is authoring
 * only, and only Claude models do the agentic tool-loop reliably.
 */
import Anthropic from '@anthropic-ai/sdk'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { ChatEvent } from '../types'
import { acquireDevice, ensureEmulator, resolveAvd } from './appium/device'

/**
 * Absolute path to the locally-installed appium-mcp CLI.
 * Built from process.cwd() rather than require.resolve — Turbopack rewrites
 * require.resolve inside bundled route handlers (the mcp-client.ts Phase 1
 * lesson, equally true here).
 */
function appiumMcpCli(): string {
  return path.join(process.cwd(), 'node_modules', 'appium-mcp', 'dist', 'index.js')
}

/** Internal Anthropic model id → dated API id (mirrors src/lib/ai.ts / mcp-client.ts). */
function resolveAnthropicModelId(modelId: string): string {
  const map: Record<string, string> = {
    'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6': 'claude-sonnet-4-6',
  }
  return map[modelId] ?? modelId
}

/** Drop undefined values so process.env satisfies StdioClientTransport's Record<string, string>. */
function stringEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

/**
 * Build the mobile authoring system prompt for one session. Unlike
 * mcp-client.ts's static SYSTEM_PROMPT, this can't be a top-level const:
 * capabilities (apkPath, device serial) must be passed explicitly on the
 * session-create tool call, so the real values have to be interpolated in —
 * Claude has no other way to discover them (no CAPABILITIES_CONFIG file is
 * used here).
 */
function buildSystemPrompt(apkPath: string, serial: string): string {
  return `You are an automation author embedded in a testing dashboard. You drive a real Android
app through the Appium MCP tools to carry out the flow the user describes.

Your FIRST action must be a single \`appium_session_management\` call with:
- action: 'create'
- platform: 'android'
- capabilities: {
    "platformName": "Android",
    "appium:automationName": "UiAutomator2",
    "appium:app": "${apkPath}",
    "appium:udid": "${serial}"
  }

Do NOT pass remoteServerUrl — omitting it is what selects the embedded local UiAutomator2
driver (already running in-process against this device), not a separate Appium server.

Guidelines:
- Use \`appium_find_element\` to locate elements before acting — prefer accessibility id,
  resource-id, or text over raw coordinates/XPath, which are brittle and a last resort.
- Use \`appium_gesture\` for taps, long-presses, swipes, and scrolling.
- Take a screenshot or find-element call to understand the screen before acting; act one
  step at a time.
- After completing the flow, briefly summarise what you did and what you verified, so it can
  later be saved as a replayable Appium spec.
- If a step fails, report what happened instead of guessing wildly.
- Do NOT call \`appium_screen_recording\` — recording is the replay engine's job (via the
  harness), not authoring's.`
}

interface Session {
  mcp: Client
  transport: StdioClientTransport
  anthropic: Anthropic
  modelId: string
  tools: Anthropic.Tool[]
  systemPrompt: string
  /** Full conversation history (Anthropic message params). */
  messages: Anthropic.MessageParam[]
  busy: boolean
  /** Date.now() of the last accessor call — drives the idle-expiry sweep below. */
  lastUsedAt: number
  /** What device/APK this session is bound to — read back by routes (later phase) when saving as a project. */
  target: { apkPath: string; avd?: string }
  /** Releases the device mutex acquired for this session's whole lifetime — see createSession's comment. */
  releaseDevice: () => void
  /** Per-session SCREENSHOTS_DIR handed to the appium-mcp child; cleaned up on close. */
  screenshotsDir: string
}

const sessions = new Map<string, Session>()

/** Max tool-use iterations per user turn — a runaway-loop backstop. */
const MAX_ITERATIONS = 25

/** Sessions idle longer than this are closed by the sweep (leaked child + device lock). */
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
    await closeSession(id) // reuses the same cleanup as the explicit DELETE path (device release + temp-dir cleanup included)
  }
}

/**
 * Periodic idle-session reaper. Survives HMR re-evaluation via the same
 * globalThis-flag guard mcp-client.ts's startIdleSweep uses — at most one
 * interval per process. `.unref()` so it never keeps the process alive.
 */
function startIdleSweep(): void {
  const g = globalThis as typeof globalThis & { __appiumMcpSessionSweepStarted?: boolean }
  if (g.__appiumMcpSessionSweepStarted) return
  g.__appiumMcpSessionSweepStarted = true

  const timer = setInterval(() => {
    sweepIdleSessions().catch((err) => console.error('[appium-mcp-client] idle sweep failed:', err))
  }, SWEEP_INTERVAL_MS)
  timer.unref?.()
}

startIdleSweep()

/**
 * Boot the emulator, spawn appium-mcp, connect, and create an authoring
 * session. Returns the session id; the emulator/driver stay bound to this
 * session until closeSession.
 *
 * Device-mutex duration — read before touching this function:
 * There's only one local AVD (device.ts's single-device-mutex design), so an
 * authoring session and a replay run must never drive it concurrently.
 * `withDevice(fn)` (device.ts) releases the mutex the instant `fn`'s promise
 * settles — perfect for a replay run (one bounded async call) but wrong here:
 * an authoring session is a long-lived object that spans many `runTurn` calls
 * over potentially minutes of back-and-forth chat, not one call. If this
 * function only held the mutex during the boot step below (e.g. by wrapping
 * just `ensureEmulator` in `withDevice`), the lock would be released the
 * moment boot finished — and a concurrent replay could then start driving the
 * *same* device while this authoring session is still mid-flow, silently
 * corrupting both. That defeats the mutex's entire purpose.
 * So instead we use `acquireDevice()` (added to device.ts alongside the
 * existing scoped `withDevice`, which is left completely unchanged — its only
 * caller, appium-runner.ts, still gets the old scoped behavior) to take a
 * real held lock here, and only release it in `closeSession`/the idle sweep —
 * i.e. the lock's lifetime matches the session's lifetime, not one call's.
 */
export async function createSession(
  apiKey: string,
  modelId: string,
  target: { apkPath: string; avd?: string },
): Promise<string> {
  const releaseDevice = await acquireDevice()
  try {
    const avd = resolveAvd({ appium: target })
    const serial = await ensureEmulator(avd)

    const id = randomUUID()
    const screenshotsDir = path.join(os.tmpdir(), `appium-mcp-${id}`)

    // Spawn the locally-installed CLI via node directly — no npx in the path
    // (same rationale as mcp-client.ts's playwrightMcpCli). appium-mcp's own
    // start:stdio script is literally `node dist/index.js` — stdio is its
    // default transport, no flag needed. We must pass env explicitly:
    // StdioClientTransport only inherits a curated safe subset (PATH etc.)
    // by default, not full process.env, and appium-mcp needs ANDROID_HOME.
    const transport = new StdioClientTransport({
      command: process.execPath, // node
      args: [appiumMcpCli()],
      env: { ...stringEnv(process.env), SCREENSHOTS_DIR: screenshotsDir },
    })
    const mcp = new Client({ name: 'automation-hub', version: '1.0.0' })
    await mcp.connect(transport)

    const { tools: mcpTools } = await mcp.listTools()
    const tools: Anthropic.Tool[] = mcpTools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: (t.inputSchema ?? { type: 'object', properties: {} }) as Anthropic.Tool.InputSchema,
    }))

    sessions.set(id, {
      mcp,
      transport,
      anthropic: new Anthropic({ apiKey }),
      modelId: resolveAnthropicModelId(modelId),
      tools,
      systemPrompt: buildSystemPrompt(target.apkPath, serial),
      messages: [],
      busy: false,
      lastUsedAt: Date.now(),
      target,
      releaseDevice,
      screenshotsDir,
    })
    return id
  } catch (err) {
    // Boot/spawn/connect failed before the session was stored — nobody else
    // will ever call closeSession for this id, so release the lock ourselves.
    releaseDevice()
    throw err
  }
}

export function hasSession(id: string): boolean {
  const s = sessions.get(id)
  if (!s) return false
  touch(s)
  return true
}

export interface SessionAction { tool: string; input: unknown }

/**
 * Extract the authoring transcript for codegen: the ordered mobile actions
 * Claude took (tool_use blocks) plus its final summary text. Returns null if
 * the session is gone or no actions were taken. Verbatim logic from
 * mcp-client.ts's getTranscript — engine-agnostic, works off s.messages alone.
 */
export function getTranscript(id: string): { actions: SessionAction[]; summary: string } | null {
  const s = sessions.get(id)
  if (!s) return null
  touch(s)
  const actions: SessionAction[] = []
  let summary = ''
  for (const m of s.messages) {
    if (m.role !== 'assistant' || typeof m.content === 'string') continue
    for (const block of m.content) {
      if (block.type === 'tool_use') actions.push({ tool: block.name, input: block.input })
      else if (block.type === 'text' && block.text.trim()) summary = block.text // keep the last
    }
  }
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
 * What device/APK a session is bound to — a later phase (routes) reads this
 * back when saving an authoring session as a project. Playwright's
 * mcp-client.ts has no equivalent (there's no per-session "target" concept
 * for a browser); this is Appium-only.
 */
export function getSessionTarget(id: string): { apkPath: string; avd?: string } | null {
  const s = sessions.get(id)
  if (!s) return null
  touch(s)
  return s.target
}

/**
 * Close the appium-mcp connection and drop the session. Safe to call more
 * than once.
 *
 * Closing the stdio transport (via s.mcp.close()) is sufficient to end the
 * Appium session too: appium-mcp's default APPIUM_MCP_ON_CLIENT_DISCONNECT
 * behavior (`delete_all`, which we don't override) automatically deletes
 * MCP-owned Appium sessions on client disconnect — no extra explicit
 * `appium_session_management` action='delete' tool call is needed here,
 * exactly mirroring how mcp-client.ts's closeSession needs nothing beyond
 * `s.mcp.close()` for Playwright.
 */
export async function closeSession(id: string): Promise<void> {
  const s = sessions.get(id)
  if (!s) return
  sessions.delete(id)
  try { await s.mcp.close() } catch { /* already gone */ }
  // Release the device mutex regardless of how the close above went — an
  // MCP-close failure must never leave the device permanently locked.
  try { s.releaseDevice() } catch { /* best-effort */ }
  // Best-effort: don't let a temp-dir cleanup failure fail the whole close.
  try { await fs.rm(s.screenshotsDir, { recursive: true, force: true }) } catch { /* best-effort */ }
}

/** Convert an MCP tool result into Anthropic tool_result content + a UI preview.
 * Verbatim from mcp-client.ts — engine-agnostic; appium-mcp's tools (e.g.
 * appium_screenshot with returnRawBase64) can return image content blocks
 * exactly like Playwright MCP's snapshot tool does. */
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
 * `emit` is awaited so the route can backpressure the SSE stream. Verbatim
 * structure from mcp-client.ts's runTurn — engine-agnostic, it only calls
 * s.mcp.callTool() and doesn't care what MCP server backs it.
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
        system: s.systemPrompt,
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
