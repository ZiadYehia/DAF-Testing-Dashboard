/**
 * Automation Hub — authoring engine dispatcher (Phase 8).
 *
 * A thin engine-dispatch layer so route handlers (not built yet — a later
 * phase) don't need to know whether a given authoring session id is backed by
 * mcp-client.ts (Playwright) or appium-mcp-client.ts (Appium). Tracks
 * `id -> engine` in a module-level map, populated whenever a session is
 * created through this dispatcher, and used to route every other call to the
 * matching client.
 */
import type { ChatEvent } from '../types'
import * as playwrightClient from './mcp-client'
import * as appiumClient from './appium-mcp-client'

export type AuthoringEngine = 'playwright' | 'appium'

export type CreateSessionOpts =
  | { engine: 'playwright'; app?: string }
  | { engine: 'appium'; target: { apkPath: string; avd?: string } }

/** id -> which engine's client owns this session. */
const engines = new Map<string, AuthoringEngine>()

/** Which engine backs a session id, or null if unknown — lets a caller (e.g. chat/save's
 * route) pick the right codegen path without guessing from getSessionTarget's ambiguous null. */
export function getEngine(id: string): AuthoringEngine | null {
  return engines.get(id) ?? null
}

/**
 * Create a session with the matching client and remember which engine backs it.
 * `app` (playwright only) is what gates silent page mining on close (Phase D) — the
 * appium branch never carries one, so mining is naturally skipped for those sessions.
 */
export async function createSession(
  apiKey: string,
  modelId: string,
  opts: CreateSessionOpts,
): Promise<string> {
  const id =
    opts.engine === 'appium'
      ? await appiumClient.createSession(apiKey, modelId, opts.target)
      : await playwrightClient.createSession(apiKey, modelId, { app: opts.app })
  engines.set(id, opts.engine)
  return id
}

/** Unknown ids are simply not-a-session — false, not a throw. */
export function hasSession(id: string): boolean {
  const engine = engines.get(id)
  if (!engine) return false
  return engine === 'appium' ? appiumClient.hasSession(id) : playwrightClient.hasSession(id)
}

/**
 * Delegate a turn by looked-up engine. An unknown id emits the same
 * `{type: 'error', ...}` shape both clients' own not-found handling already
 * uses, rather than throwing — callers only need to consume `emit` events.
 */
export async function runTurn(
  id: string,
  userText: string,
  emit: (e: ChatEvent) => void | Promise<void>,
): Promise<void> {
  const engine = engines.get(id)
  if (!engine) {
    await emit({ type: 'error', message: 'Session not found or expired' })
    return
  }
  if (engine === 'appium') return appiumClient.runTurn(id, userText, emit)
  return playwrightClient.runTurn(id, userText, emit)
}

export function getTranscript(id: string): ReturnType<typeof playwrightClient.getTranscript> {
  const engine = engines.get(id)
  if (!engine) return null
  return engine === 'appium' ? appiumClient.getTranscript(id) : playwrightClient.getTranscript(id)
}

export function getSessionModel(id: string): string | null {
  const engine = engines.get(id)
  if (!engine) return null
  return engine === 'appium' ? appiumClient.getSessionModel(id) : playwrightClient.getSessionModel(id)
}

/**
 * What device/APK an Appium session is bound to. Playwright's client has no
 * such concept (a browser session has no fixed "target" the way an Appium
 * session is bound to one APK/device) — return null for that case rather
 * than erroring.
 */
export function getSessionTarget(id: string): { apkPath: string; avd?: string } | null {
  const engine = engines.get(id)
  if (engine !== 'appium') return null
  return appiumClient.getSessionTarget(id)
}

/**
 * Delegate close by looked-up engine, then forget the id here regardless of
 * outcome — best-effort, so a close failure in the underlying client can't
 * leak the dispatcher's own id -> engine bookkeeping.
 */
export async function closeSession(id: string): Promise<void> {
  const engine = engines.get(id)
  try {
    if (engine === 'appium') await appiumClient.closeSession(id)
    else if (engine === 'playwright') await playwrightClient.closeSession(id)
  } finally {
    engines.delete(id)
  }
}
