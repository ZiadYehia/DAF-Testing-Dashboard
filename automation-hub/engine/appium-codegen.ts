/**
 * Automation Hub — Appium codegen (Phase 7).
 *
 * Turns an MCP-authoring-style session (the ordered mobile actions Claude took, plus its
 * summary) into a self-contained Appium spec that automation-hub/engine/appium/harness.mjs
 * can run. Mirrors engine/codegen.ts's Playwright generateSpec() structurally, but targets
 * the vendored Appium harness contract instead of @playwright/test.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { GenerateSpecInput } from './codegen'
import { listHubEnvKeys } from '../store'

const APPIUM_SYSTEM_PROMPT = `You convert a recorded mobile-automation session into a single, self-contained Appium
spec using the vendored harness.

Rules:
- Output ONLY the JavaScript code for the spec — no prose, no markdown fences.
- MUST start with: import { runSpec } from '../../engine/appium/harness.mjs'
- Wrap the entire flow in exactly one \`await runSpec(async (driver) => { ... })\` call —
  no top-level code outside that call besides the import.
- Reproduce the flow from the recorded actions in order.
- Use resilient selectors ONLY: \`driver.$('~someAccessibilityId')\` (accessibility id) or
  \`driver.$('android=new UiSelector().resourceId("...")...')\` / \`.text("...")\` (UiSelector) —
  never raw coordinates/taps-by-position, never brittle XPath indices.
- Always \`await el.waitForDisplayed()\` before interacting with any element (click/setValue) —
  mobile UI transitions are async and elements may not be immediately interactable.
- Turn what the session verified into real assertions: there's no assertion library — throw
  to fail, e.g. \`if (!(await el.isDisplayed())) throw new Error('...descriptive message...')\`.
- Keep it deterministic and runnable as-is; no comments explaining the conversion.`

/**
 * Hub conventions appended to every Appium codegen prompt: secrets/config via
 * automation-hub/.env — never hardcoded. Env key NAMES (never values) are listed so the
 * model references real keys. Unlike the Playwright side, there is no auto-login helper
 * for Appium — any login steps the recorded session performed are simply reproduced like
 * any other action.
 */
async function appiumConventions(app?: string): Promise<string> {
  let keys: string[] = []
  try { keys = await listHubEnvKeys() } catch { /* prompt works without the list */ }
  return `

Hub conventions (the replay engine provides these):
- Never hardcode credentials, tokens, or device/app-specific config. Reference
  process.env.<KEY> — the harness loads automation-hub/.env into its own process before
  your spec runs.${keys.length ? `\n  Available env keys: ${keys.join(', ')}.` : ''}`
}

/** Strip a leading/trailing ```js (or ```ts) fence if the model adds one despite instructions. */
function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:ts|typescript|javascript|js|python|py)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

export type { GenerateSpecInput as GenerateSpecAppiumInput }

/**
 * Strip fences and validate the harness-import contract. Pulled out of
 * generateSpecAppium as its own pure function so the parsing/validation logic is
 * testable with hand-written strings, without an API call.
 */
export function validateAppiumSpec(text: string): string {
  const spec = stripFences(text)
  if (!spec.includes('runSpec') || !spec.includes('engine/appium/harness.mjs')) {
    throw new Error(
      'Generated spec did not import the Appium harness (../../engine/appium/harness.mjs) — try again',
    )
  }
  return spec
}

/** Generate an Appium spec from a session's actions. Throws on API failure. */
export async function generateSpecAppium(input: GenerateSpecInput): Promise<string> {
  const client = new Anthropic({ apiKey: input.apiKey })

  const actionList = input.actions
    .map((a, i) => `${i + 1}. ${a.tool}(${JSON.stringify(a.input)})`)
    .join('\n')

  const userPrompt = `Test title: ${input.title}

What the session verified (author's summary):
${input.summary || '(none provided)'}

Recorded browser actions, in order:
${actionList}

Write the Appium spec.`

  const message = await client.messages.create({
    model: input.modelId,
    max_tokens: 4096,
    system: APPIUM_SYSTEM_PROMPT + (await appiumConventions(input.app)),
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const spec = validateAppiumSpec(text)
  return spec + '\n'
}
