/**
 * Automation Hub — silent MCP page mining (Phase D).
 *
 * ANY Playwright MCP authoring session (chat/explore/testcase authoring — anything that
 * carries an `app` slug, see mcp-client.ts's `Session.app`) silently mines reusable
 * page-object methods when it ends, whether or not the user ever saves a test out of it.
 * The test file itself is untouched by this path; only shared `pages/<app>/*.page.ts`
 * files gain methods, so later sessions/codegen runs for the same app get a richer POM
 * index to reuse instead of re-inventing selectors.
 *
 * Called from two places, both funneling through the same watermark bookkeeping in
 * mcp-client.ts:
 *   - `closeSession` (chat DELETE and the 15-min idle reaper both call it) — reason 'close'.
 *   - `chat/save` route — reason 'save', run synchronously BEFORE `generateSpec` so the
 *     freshly-mined methods are visible in the POM index the test is generated against.
 *
 * This function must NEVER throw and NEVER surface an error to the user — mining is a
 * best-effort side effect of authoring, not a step anyone is waiting on.
 */
import type Anthropic from '@anthropic-ai/sdk'
import type { SessionAction } from './mcp-client'
import { extractPagesFromSession } from './codegen'
import { appendToTsPageFile, saveTsPageFile } from '../store'

export type MiningReason = 'close' | 'reap' | 'save'

/**
 * Mine reusable page-object methods out of a session's recorded actions and apply them
 * to `pages/<app>/*.page.ts` files, best-effort. Returns the relative paths of any page
 * files actually touched (mainly useful to the 'save' caller, which needs a fresh POM
 * index right after this resolves); the 'close'/'reap' callers just let it run and log.
 *
 * Skips (returns []) with no model call at all when there's no app (session never
 * carried one — e.g. Appium, which never reaches this module) or no actions to mine.
 */
export async function mineSessionPages(input: {
  actions: SessionAction[]
  summary: string
  app?: string
  anthropic: Anthropic
  modelId: string
  reason: MiningReason
}): Promise<string[]> {
  const { actions, summary, app, anthropic, modelId, reason } = input
  if (!app || actions.length === 0) return []

  try {
    const pageAppends = await extractPagesFromSession({ actions, summary, app, anthropic, modelId })
    if (pageAppends.length === 0) return []

    const touched: string[] = []
    for (const append of pageAppends) {
      try {
        if (append.mode === 'append') {
          await appendToTsPageFile(append.path, append.body)
        } else {
          await saveTsPageFile(append.path, append.body, { create: true })
        }
        touched.push(append.path)
      } catch (err) {
        // Missing 'append' target or already-existing 'new' path — skip that one block,
        // best-effort, same semantics as applyTsArtifacts.
        console.warn(
          `[page-miner] ${reason} ${app}: skipping page ${append.mode} "${append.path}": ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
    if (touched.length > 0) {
      console.log(`[page-miner] ${reason} ${app}: touched ${touched.join(', ')}`)
    }
    return touched
  } catch (err) {
    console.error(`[page-miner] ${reason} ${app}: mining failed:`, err)
    return []
  }
}
