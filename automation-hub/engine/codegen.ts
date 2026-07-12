/**
 * Automation Hub — codegen (Phase 3, extended by the TS POM framework phase).
 *
 * Turns an MCP authoring session (the ordered browser actions Claude took, plus its
 * summary), a manual test case, or a revision instruction into framework-native
 * artifacts for one of two frameworks:
 *
 *   - TypeScript: this hub's own fluent Playwright page-object framework
 *     (automation-hub/pages/<app>/*.page.ts + automation-hub/lib/framework/**, see
 *     lib/pom-index.ts's getTsPomIndex). Two-artifact output: a pure fluent-chain
 *     test.spec.ts plus zero or more page-file edits (`TsArtifacts`).
 *   - Python: the vendored automation-hub/python/ pytest framework (see
 *     lib/pom-index.ts's getPomIndex). Same two-artifact shape (`PyArtifacts`).
 *
 * In both frameworks, tests are fluent chains of page-object methods ONLY — any
 * selector/wait/assertion the model needs that has no existing page method comes back
 * as a separate page-file artifact rather than being inlined into the test. A lint gate
 * (`lintFluentTestTs` / `lintFluentTest`) enforces this (plus the ONE-PAGE-PER-TEST rule:
 * a test references exactly one page class/fixture) with one automatic retry before
 * throwing.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SessionAction } from './mcp-client'
import { listHubEnvKeys } from '../store'
import { getPomIndex, getTsPomIndex } from '../lib/pom-index'
import type { TsArtifacts, TsPageAppend } from '../types'

/**
 * Python conventions appended to every Python codegen prompt: the vendored pytest
 * framework's fluent page-object contract, available fixtures, the exact two-artifact
 * output format, and the POM index (see lib/pom-index.ts) so the model reuses existing
 * page-object methods instead of inventing raw selectors.
 */
function pythonConventions(app?: string): string {
  const slug = app ?? '<app-slug>'
  const pomIndex = getPomIndex(app)
  const pomSection = pomIndex
    ? `\n\nAvailable page objects (reuse these methods — never redefine one that already exists here):\n${pomIndex}`
    : '\n\n(No page objects found yet for this app — define whatever the flow needs as NEW page-append methods.)'

  return `

Framework conventions (the vendored automation-hub/python/ pytest framework):
- Use the SYNCHRONOUS Playwright API only — \`from playwright.sync_api import Page, expect\`.
  NEVER use \`async def\`, \`await\`, or \`playwright.async_api\`.
- TESTS ARE FLUENT CHAINS OF PAGE-OBJECT METHODS ONLY. A test file must contain ZERO raw
  selectors or framework-bypassing calls — no \`page.locator\`, \`get_by_role\`, \`get_by_text\`,
  \`get_by_label\`, \`dispatch_event\`, \`expect(...)\` (a \`pytest.raises(...)\` is fine),
  \`sync_playwright\`, or manual \`.goto(...)\` navigation. EVERY selector, wait, and assertion
  lives inside a page-object method — the test only calls page methods and chains their
  fluent returns.
- ONE-PAGE-PER-TEST RULE: the test method takes exactly ONE page-object fixture as its
  argument (see fixtures below) — never a second fixture, and never \`import\`/\`from ...
  import\` anything under \`pages/\` directly in the test file. A flow that crosses screens
  (e.g. create → details) stays inside page methods, which return the next page object
  internally — the test keeps chaining off the single fixture it was given.
- Test file shape:
  - A module docstring describing what the test covers.
  - \`import pytest\`, \`import allure\`, and \`from autotest_framework.src.utils.data import
    unique_suffix\` when a unique identifier is needed.
  - One class per file, decorated \`@allure.feature("...")\` and \`@allure.story("...")\`.
  - Each test method decorated \`@allure.title("...")\` and marked \`@pytest.mark.smoke\` or
    \`@pytest.mark.regression\`.
  - The test method takes the app's page-object fixture as its argument (see fixtures
    below) and body is a single fluent chain, e.g.:
    \`\`\`python
    import allure
    import pytest

    from autotest_framework.src.utils.data import unique_suffix


    @allure.feature("Item Manager")
    @allure.story("Item Create Manual")
    class TestCRT172:

        @pytest.mark.regression
        @allure.title("CRT_172: Sample Item created with required fields only")
        def test_sample_item_minimal_create(self, item_create_page):
            uniq = unique_suffix()
            name = f"QA Sample Item {uniq}"
            (item_create_page
                .select_family("Sample")
                .select_type("Sample Item")
                .fill_item_name(name)
                .fill_field("System File ID / File Hash", f"EF-HASH-{uniq}")
                .next_step()
                .create()
                .assert_created(name)
                .assert_field("System File ID / File Hash", f"EF-HASH-{uniq}"))
    \`\`\`
  - Use \`unique_suffix()\` (never hardcoded literals) for any value that must be unique
    per run (item names, identifiers, emails, etc).
- Fixtures available${app ? ` for app "${slug}"` : ''} (declared in tests/${slug}/conftest.py — take
  ONE as the test method's argument, whichever already lands on the right screen):
  - \`logged_in_page\` — an authenticated Playwright \`Page\`, no navigation yet.
  - \`items_page\` — logged in, already on the app's list page (e.g. the app’s list route).
  - \`item_create_page\` — logged in, already on the create wizard's first step.
  Do not re-implement login or navigation in the test — pick the fixture that already
  starts where the flow needs to begin.
- Page-object API: page objects live under \`pages/${slug}/*.py\`, extend \`BasePage\`
  (\`from autotest_framework.src.pages.base_page import BasePage\`), and every action/
  assertion method returns \`self\` (same page) or the next page object (fluent chaining) —
  never \`None\`.${pomSection}
- If a needed action or assertion has NO existing page method, do not put selectors in the
  test — instead define a NEW method in a page-append artifact for the relevant
  \`pages/${slug}/<module>.py\` file. NEVER redefine or duplicate a method that already exists
  in the page-object API listed above. New page methods must:
  - Use the synchronous Playwright API and return \`self\` or the appropriate next page
    object (fluent).
  - Click wizard/nav buttons (Next, Back, Create, Cancel, or anything that could be
    overlapped by a floating UI element) via \`.dispatch_event("click")\`, not \`.click()\`.
  - Pass \`exact=True\` to \`get_by_role(...)\` whenever the accessible name is short or a
    substring of another control's name (e.g. "Next" vs "Next Month", "Name *" vs
    "Item Name *") — role-name matching is a case-insensitive substring match by default.
  - Follow the docstring/method style already used in the page objects above (short
    docstring explaining any quirk being encoded).

OUTPUT FORMAT — respond with ONLY this, no prose, no markdown fences around the whole
response, in this exact order:
=== FILE: tests/${slug}/test_<slug>.py ===
<full test file, fluent chain only, as described above>
=== FILE: pages/${slug}/<module>.py (append) ===
<new page-object methods only — none, one, or more of these blocks, each targeting the
page file the methods belong on. Every line already indented 4 spaces so it is directly
appendable to the end of that class body. Do NOT repeat existing methods or the whole
file — new method definitions only.>

The FIRST \`=== FILE: ... ===\` block is ALWAYS the test file. Zero or more page-append
blocks (marked with the literal suffix \` (append)\`) follow it, one per page file that
needs new methods. Omit page-append blocks entirely when every needed action/assertion
already exists in the page-object API above.`
}

/**
 * TypeScript conventions appended to every TS codegen prompt: this hub's own fluent
 * Playwright page-object framework's chain contract, the ONE-PAGE-PER-TEST rule, the
 * exact two/three-marker output format (test + page append/new blocks), the TS POM index
 * (see lib/pom-index.ts's getTsPomIndex) so the model reuses existing page objects and
 * locked framework helpers instead of inventing raw selectors, and the env/auth rules
 * this hub's replay engine relies on (folds in what the now-deleted hubConventions used
 * to cover: per-app cached auth via lib/apps.ts + lib/auth.ts, secrets via
 * automation-hub/.env — never hardcoded).
 */
async function tsConventions(app?: string): Promise<string> {
  let keys: string[] = []
  try {
    keys = await listHubEnvKeys()
  } catch {
    /* prompt works without the list */
  }
  const slug = app ?? '<app-slug>'
  const pomIndex = getTsPomIndex(app)
  const pomSection = pomIndex
    ? `\n\nAvailable page objects and framework helpers (reuse these — never redefine one that already exists here):\n${pomIndex}`
    : '\n\n(No page objects found yet for this app — define whatever the flow needs as a NEW page file; the lib/framework/ helpers below are always available.)'

  return `

Framework conventions (this hub's own TypeScript fluent Playwright page-object framework):
- TESTS ARE FLUENT CHAINS OF PAGE-OBJECT METHODS ONLY, with exactly ONE \`await\` at the
  head of the chain. A test file must contain ZERO raw selectors or framework-bypassing
  calls — no \`page.locator(...)\`, \`.getByRole/.getByText/.getByLabel/.getByTestId/
  .getByPlaceholder/.getByAltText/.getByTitle(...)\`, \`.dispatchEvent(...)\`, \`expect(...)\`,
  \`.goto(...)\`, or \`page.click/fill/type/press/check/selectOption/hover/waitFor*/keyboard/
  mouse/evaluate(...)\`. EVERY selector, wait, and assertion lives inside a page-object
  method (built out of the locked lib/framework/ helpers) — the test only calls page
  methods and chains their fluent returns.
- ONE-PAGE-PER-TEST RULE: a test file imports exactly ONE class from \`pages/**\` and the
  chain starts from that class's \`.open(page)\` entry. Never import a second page class
  into a test — a flow that crosses screens (e.g. create → details) stays inside page
  methods, which return the NEXT page object internally (via \`stepTo\`) so the test keeps
  chaining off the class it already imported.
- Test file shape (also the manual-create starter shape):
  \`\`\`ts
  import { test } from '@playwright/test'
  import { stateFor } from '../../lib/apps'
  import { uniqueSuffix } from '../../lib/framework/data'
  import { ItemCreatePage } from '../../pages/myapp/item-create.page'

  test.use({ storageState: stateFor('${slug}') })

  test('CRT_001: Sample Item created with required fields only', async ({ page }) => {
    const uniq = uniqueSuffix()
    const name = \`QA Sample Item \${uniq}\`
    await ItemCreatePage.open(page)
      .selectFamily('Sample')
      .selectType('Sample Item')
      .fillItemName(name)
      .fillField('System File ID / File Hash', \`EF-HASH-\${uniq}\`)
      .nextStep()
      .create()
      .assertCreated(name)
      .assertField('System File ID / File Hash', \`EF-HASH-\${uniq}\`)
  })
  \`\`\`
  - \`test.use({ storageState: stateFor('${slug}') })\` at module scope selects this hub's
    cached logged-in browser state for the app; the imported page class's \`open(page)\`
    static entry then navigates and transparently re-authenticates if needed — NEVER
    script login steps (password fields, SSO buttons) yourself.
  - Use \`uniqueSuffix()\` (from \`lib/framework/data\`, never a hardcoded literal) for any
    value that must be unique per run (item names, identifiers, emails, etc).
  - Exactly one \`await\`, at the head of the whole chain — every chained call returns
    \`this\` or the next page object synchronously; never split the chain across multiple
    \`await\`s or intermediate variables.
- Page-object API: page files live at \`pages/${slug}/<screen>.page.ts\`, one
  \`export class <Screen>Page extends FluentPage\` per file. Every public method:
  - Returns \`this\` (\`return this.step(async () => { ... })\`) for a same-page action or
    assertion, or the next page object via \`return this.stepTo((page, chain) => new
    NextPage(page, chain), async () => { ... })\` for a cross-page transition (e.g.
    \`create()\` landing on the details screen).
  - The class's entry point is a SYNC static (never \`async\` — an async function returning
    a FluentPage would be unwrapped by its own \`then\` before the caller ever saw it):
    \`\`\`ts
    static open(page: Page): ThisScreenPage {
      return new ThisScreenPage(page).step(() => ensureLoggedIn(page, '${slug}', '/route/the/flow/starts/at'))
    }
    \`\`\`
  - Never redefines or duplicates a method that already exists in the page-object API or
    the locked framework helpers listed below.${pomSection}
- If a needed action or assertion has NO existing page method, do not put selectors in the
  test — instead define a NEW method (or a whole NEW page file) in a page artifact. New
  page methods must:
  - Return \`this\` or the appropriate next page object (fluent), built entirely out of the
    locked \`lib/framework/\` helpers (\`clickSafe\`, \`roleExact\`, \`fillField\`,
    \`selectDropdown\`, \`pickDate\`, \`waitVisible\`, \`expectVisible\`, \`expectHidden\`,
    \`expectText\`, \`expectUrl\`, \`expectFieldError\`, \`expectToast\`) — never redefine what
    those already do, and never import \`expect\` directly (only validations.ts does that).
  - Click wizard/nav buttons (Next, Back, Create, Cancel, or anything that could be
    overlapped by a floating UI element) via \`clickSafe(locator)\`, never a plain
    \`.click()\`.
  - Pass \`exact: true\` (via \`roleExact\`, or directly on \`getByRole\`) whenever the
    accessible name is short or a substring of another control's name (e.g. "Next" vs
    "Next Month", "Name *" vs "Item Name *") — role-name matching is a case-insensitive
    substring match by default.
  - Wait for asynchronously-rendered fields to be visible (\`waitVisible\`) before
    interacting, rather than assuming the DOM is settled immediately after a
    navigation/preceding step.
  - Carry a one-line JSDoc comment stating any quirk being encoded, matching the style of
    the page objects/framework helpers listed above.
- Never hardcode credentials, tokens, or environment-specific base URLs. Reference
  process.env.<KEY> (values live in automation-hub/.env) from inside page methods that
  need them.${keys.length ? `\n  Available env keys: ${keys.join(', ')}.` : ''}

OUTPUT FORMAT — respond with ONLY this, no prose, no markdown fences around the whole
response, in this exact order:
=== FILE: projects/<name>/test.spec.ts ===
<full fluent test file, exactly as described above>
=== FILE: pages/${slug}/<screen>.page.ts (append) ===
<new methods only — none, one, or more of these blocks, each targeting an EXISTING page
file. Every line already indented 2 spaces so it is directly appendable to the end of
that class body. Do NOT repeat existing methods or the whole file — new method
definitions only.>
=== FILE: pages/${slug}/<new-screen>.page.ts (new) ===
<a complete NEW page file — imports, \`export class <Screen>Page extends FluentPage\`, the
\`static open(page: Page)\` entry, and its methods — only when the flow starts on a screen
with no existing page file yet.>

The FIRST \`=== FILE: ... ===\` block is ALWAYS the test file. Zero or more page blocks
follow it: the literal suffix \` (append)\` targets an EXISTING page file (methods-only
body), \` (new)\` is a brand-new page file (complete file body). Omit page blocks entirely
when every needed action/assertion already exists in the page-object API above.`
}

/** Strip a leading/trailing ```ts (or ```py) fence if the model adds one despite instructions. */
function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:ts|typescript|javascript|js|python|py)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

export interface GenerateSpecInput {
  apiKey: string
  /** Resolved Anthropic model id (e.g. claude-sonnet-4-6). */
  modelId: string
  title: string
  actions: SessionAction[]
  summary: string
  /** Dashboard app slug this automation targets (drives auth conventions). */
  app?: string
}

// ─── Shared two-artifact plumbing (markers, text extraction, generic retry) ────

const FILE_MARKER_RE = /^=== FILE: (.+?) ===$/gm

/** Extract the text content of an Anthropic message response. */
function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

/**
 * Generic retry-once-on-lint-violation wrapper shared by the Python and TypeScript
 * codegen paths (both used to hand-roll this twice — once per language). `runOnce` runs
 * a single completion; called with no argument for the first attempt, and with the
 * follow-up user message (built by `retryInstruction`) for the one retry — each concrete
 * `runOnce` closure decides how to fold that into its own transport (Anthropic
 * multi-turn message history vs runModel's single-turn re-sent prompt). `parse` turns
 * raw model text into artifacts; `lint` finds violations in the parsed test artifact.
 * Throws (quoting the violations) if the retry is still unclean.
 */
async function generateArtifactsWithRetry<T extends { test: string }>(
  runOnce: (retryInstruction?: string) => Promise<string>,
  parse: (text: string) => T,
  lint: (test: string) => string[],
  retryInstruction: (violations: string[]) => string,
): Promise<T> {
  const text = await runOnce()
  const artifacts = parse(text)
  const violations = lint(artifacts.test)
  if (violations.length === 0) return artifacts

  const retryText = await runOnce(retryInstruction(violations))
  const retryArtifacts = parse(retryText)
  const retryViolations = lint(retryArtifacts.test)
  if (retryViolations.length > 0) {
    throw new Error(
      `Generated test still violates the fluent-chain/one-page rule after one retry:\n${retryViolations.join('\n')}`,
    )
  }
  return retryArtifacts
}

// ─── TypeScript (this hub's own fluent framework) two-artifact contract ────────

/**
 * Parse a model response into `TsArtifacts`: the FIRST `=== FILE: ... ===` block is
 * always the test file (must reference `@playwright/test` and contain a `test(` call);
 * subsequent blocks are page-file edits, one per targeted `pages/<app>/<screen>.page.ts`
 * path. A block's mode is decided by its header suffix — literal ` (append)` (methods
 * only for an EXISTING file; rejected if it contains a line-start `import ` or
 * `export class`, which belong in a whole new file instead) or ` (new)` (a complete file;
 * always accepted as-is). An unsuffixed pages/ header falls back to `'new'` only when its
 * body looks like a complete file (`export class` present); otherwise it's ambiguous and
 * throws. Defensively strips markdown fences per block in case the model wraps one
 * despite instructions. Throws if no `=== FILE: ... ===` marker is found at all.
 */
export function parseTsArtifacts(text: string): TsArtifacts {
  const cleaned = stripFences(text)
  const matches = [...cleaned.matchAll(FILE_MARKER_RE)]
  if (matches.length === 0) {
    throw new Error('Model did not return any "=== FILE: ... ===" blocks')
  }

  const blocks = matches.map((m, i) => {
    const header = m[1].trim()
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : cleaned.length
    return { header, body: stripFences(cleaned.slice(start, end)) }
  })

  const test = blocks[0].body
  if (!test.includes('@playwright/test') || !test.includes('test(')) {
    throw new Error(
      'Model did not return a valid test file (missing "@playwright/test" import or a test(...) block)',
    )
  }

  const pageAppends: TsPageAppend[] = blocks.slice(1).map((b) => {
    const isAppend = /\(append\)\s*$/.test(b.header)
    const isNew = /\(new\)\s*$/.test(b.header)
    const path = b.header.replace(/\s*\((?:append|new)\)\s*$/, '').trim()

    if (isAppend) {
      if (/^import\s/m.test(b.body) || /^export class/m.test(b.body)) {
        throw new Error(
          `Page-append block for "${path}" must contain new methods only — found an import or ` +
            `class declaration (use a "(new)" block for a whole new page file instead)`,
        )
      }
      return { path, mode: 'append', body: b.body }
    }
    if (isNew) {
      return { path, mode: 'new', body: b.body }
    }
    if (b.body.includes('export class')) {
      return { path, mode: 'new', body: b.body }
    }
    throw new Error(
      `Page block for "${path}" is missing the "(append)"/"(new)" header suffix and doesn't look ` +
        `like a complete file (no "export class" found)`,
    )
  })

  return { test, pageAppends }
}

/**
 * Substrings that mean a TS test file is reaching past the page-object layer and
 * touching raw Playwright calls directly — receiver-anchored (e.g. `.dispatchEvent(`,
 * `page.click(`) so fluent page-method names never false-positive (`.clickAddNew(` never
 * matches `page.click(`). `test(`, `test.use(`, and `test.fail/fixme/slow/setTimeout(`
 * are never matched by any of these.
 */
const LINT_VIOLATION_PATTERNS_TS: RegExp[] = [
  /\bpage\.locator\(/,
  /\.getBy(?:Role|Text|Label|TestId|Placeholder|AltText|Title)\(/,
  /\bexpect\(/,
  /\.goto\(/,
  /\.dispatchEvent\(/,
  /\bpage\.(?:click|fill|type|press|check|selectOption|hover|waitFor\w*|keyboard|mouse|evaluate)\(/,
]

/**
 * Lint a TS TEST artifact for raw-Playwright-call violations of the fluent-chain rule,
 * PLUS the one-page-per-test rule (a test must import exactly one `pages/**` class).
 * Comment lines (`//`, `*`, `/*`) are skipped so documented quirks in prose don't
 * false-positive. Returns the offending source lines (trimmed) plus any rule-violation
 * message, or [] when clean.
 */
export function lintFluentTestTs(test: string): string[] {
  const violations: string[] = []
  const lines = test.split(/\r?\n/)
  let pageImportCount = 0

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue
    if (LINT_VIOLATION_PATTERNS_TS.some((re) => re.test(line))) {
      violations.push(line)
    }
    if (/^import .+ from ['"].*\/pages\//.test(line)) {
      pageImportCount++
    }
  }

  if (pageImportCount !== 1) {
    violations.push(`test must import exactly one page class, found ${pageImportCount}`)
  }

  return violations
}

function tsRetryInstruction(violations: string[]): string {
  return `The test file breaks the fluent-chain rule and/or the one-page-per-test rule — it \
contains raw Playwright calls that must live in page-object methods instead of the test, \
and/or doesn't chain from exactly one imported page class:\n\n${violations
    .map((v) => `  ${v}`)
    .join('\n')}\n\nMove any raw calls into new or existing page-object methods (emit new ones as \
a "(append)" block for an existing page file, or a "(new)" block for a brand-new one) and make \
sure the test imports exactly ONE page class and chains its whole flow from that class's \
open(page) entry. Re-emit the FULL output using the same "=== FILE: ... ===" format — the \
complete test file plus any page blocks.`
}

/**
 * Run one Claude call (Anthropic transport, multi-turn history), parse it into
 * TsArtifacts, and lint the test artifact via `generateArtifactsWithRetry` — one
 * automatic retry (as a new assistant+user turn quoting the violations) before throwing.
 */
async function generateTsArtifactsWithRetry(
  client: Anthropic,
  modelId: string,
  system: string,
  messages: Anthropic.MessageParam[],
): Promise<TsArtifacts> {
  let history = messages
  let lastText = ''
  const runOnce = async (retryInstr?: string): Promise<string> => {
    if (retryInstr) {
      history = [...history, { role: 'assistant', content: lastText }, { role: 'user', content: retryInstr }]
    }
    const message = await client.messages.create({ model: modelId, max_tokens: 8192, system, messages: history })
    lastText = extractText(message)
    return lastText
  }
  return generateArtifactsWithRetry(runOnce, parseTsArtifacts, lintFluentTestTs, tsRetryInstruction)
}

/**
 * Non-Anthropic equivalent of generateTsArtifactsWithRetry — runModel() is single-turn
 * (no assistant/tool_use message history), so the retry re-sends the full instruction
 * with the rejected attempt and violations quoted inline instead of as prior turns.
 */
async function generateTsArtifactsWithRetryViaRunModel(
  modelId: string,
  system: string,
  userPrompt: string,
): Promise<TsArtifacts> {
  const { runModel } = await import('@/lib/ai')
  let lastText = ''
  const runOnce = async (retryInstr?: string): Promise<string> => {
    if (!retryInstr) {
      lastText = await runModel(modelId, system, userPrompt, { maxTokens: 8192 })
      return lastText
    }
    const retryPrompt = `${userPrompt}

---
YOUR PREVIOUS RESPONSE (rejected):
${lastText}

${retryInstr}`
    lastText = await runModel(modelId, system, retryPrompt, { maxTokens: 8192 })
    return lastText
  }
  return generateArtifactsWithRetry(runOnce, parseTsArtifacts, lintFluentTestTs, tsRetryInstruction)
}

const TS_SYSTEM_PROMPT = `You convert a recorded browser-automation session into a framework-native Playwright
fluent test plus any new page-object file/methods it needs, for this hub's own
TypeScript fluent page-object framework.

Rules:
- Reproduce the flow from the recorded actions in order (navigate, click, type, etc.) —
  but ONLY by calling page-object methods; never inline the raw actions as selectors.
- Turn what the session verified into real page-object assertion methods.
- Keep it deterministic and runnable as-is; no comments explaining the conversion.`

/** Generate framework-native TS fluent-page artifacts from a session's actions. Throws on API failure. */
export async function generateSpec(input: GenerateSpecInput): Promise<TsArtifacts> {
  const client = new Anthropic({ apiKey: input.apiKey })

  const actionList = input.actions
    .map((a, i) => `${i + 1}. ${a.tool}(${JSON.stringify(a.input)})`)
    .join('\n')

  const userPrompt = `Test title: ${input.title}

What the session verified (author's summary):
${input.summary || '(none provided)'}

Recorded browser actions, in order:
${actionList}

Write the fluent Playwright artifacts.`

  return generateTsArtifactsWithRetry(
    client,
    input.modelId,
    TS_SYSTEM_PROMPT + (await tsConventions(input.app)),
    [{ role: 'user', content: userPrompt }],
  )
}

const TS_FROM_TESTCASE_SYSTEM = `You convert a manual test case into a framework-native Playwright fluent test plus any
new page-object file/methods it needs, for this hub's own TypeScript fluent page-object
framework.

The input is a tester's objective and step list (each step is usually an action and an
expected result). Translate it into a test that performs the actions and turns the expected
results into real page-object assertions — via page methods only, never raw selectors
inlined in the test. You don't know exact selectors — infer reasonable accessible names
from the step text when writing NEW page methods.`

/** Generate framework-native TS fluent-page artifacts directly from a manual test case (no live browser drive). */
export async function generateSpecFromTestcase(input: {
  apiKey: string
  modelId: string
  provider?: string
  title: string
  objective: string
  steps: string
  /** Dashboard app slug this automation targets (drives framework conventions). */
  app?: string
}): Promise<TsArtifacts> {
  const userPrompt = `Test title: ${input.title}\n\nObjective: ${input.objective}\n\nSteps:\n${input.steps}\n\nWrite the fluent Playwright artifacts.`
  const system = TS_FROM_TESTCASE_SYSTEM + (await tsConventions(input.app))
  if ((input.provider ?? 'anthropic') === 'anthropic') {
    const client = new Anthropic({ apiKey: input.apiKey })
    return generateTsArtifactsWithRetry(client, input.modelId, system, [{ role: 'user', content: userPrompt }])
  }
  return generateTsArtifactsWithRetryViaRunModel(input.modelId, system, userPrompt)
}

const REVISE_TS_SYSTEM = `You revise an existing framework-native Playwright fluent test (this hub's own TypeScript
fluent page-object framework) per the user's instruction, returning the updated
two-artifact output. Preserve everything the instruction doesn't ask to change. The test
must remain a pure fluent chain of page-object methods, importing exactly one page class —
if the instruction needs an action/assertion with no existing page method, add a NEW method
(or a whole new page file) via a page artifact instead of inlining a selector into the test.`

/** Revise an existing TS fluent test per a natural-language instruction (editor AI assist). */
export async function reviseSpec(input: {
  apiKey: string
  modelId: string
  provider?: string
  currentSpec: string
  pageFiles: Array<{ path: string; content: string }>
  instruction: string
  /** Dashboard app slug this automation targets (drives framework conventions). */
  app?: string
}): Promise<TsArtifacts> {
  const pageFilesSection = input.pageFiles.length
    ? input.pageFiles.map((f) => `### ${f.path}\n${f.content}`).join('\n\n')
    : '(none provided)'
  const userPrompt = `Current test file:

${input.currentSpec}

Page objects it imports:
${pageFilesSection}

Instruction: ${input.instruction}

Re-emit the full output (test file, plus any page blocks needed) using the
"=== FILE: ... ===" format.`
  const system = REVISE_TS_SYSTEM + (await tsConventions(input.app))
  if ((input.provider ?? 'anthropic') === 'anthropic') {
    const client = new Anthropic({ apiKey: input.apiKey })
    return generateTsArtifactsWithRetry(client, input.modelId, system, [{ role: 'user', content: userPrompt }])
  }
  return generateTsArtifactsWithRetryViaRunModel(input.modelId, system, userPrompt)
}

// ─── Silent MCP page mining (Phase D) — mines page-object methods only, never a test ──

const PAGE_MINING_SYSTEM = `You mine reusable page-object methods from a recorded browser-automation session, for
this hub's own TypeScript fluent page-object framework.

Rules:
- NEVER emit a test file — output page-object method blocks ONLY.
- NEVER redefine or duplicate a method that already exists in the page-object API or
  framework helpers listed below — only add methods for actions/assertions genuinely
  missing from it.
- If everything the session did is already covered by existing page methods, respond with
  EXACTLY the text \`=== NONE ===\` and nothing else.`

/**
 * Mine reusable page-object methods out of a closed/saved MCP session's recorded
 * actions, for the silent page-mining flow (Phase D — see engine/page-miner.ts). Unlike
 * the test-generating functions above, this NEVER emits a test file, runs NO lint, and
 * has NO retry — a single one-shot completion using the CALLER's own Anthropic client
 * (the session's own client/modelId, so the reaper needs no separate credentials).
 * `parseTsPageBlocks` is lenient by design (see below): a malformed or empty response
 * just yields no page edits rather than throwing, since this path must never surface an
 * error to the user.
 */
export async function extractPagesFromSession(input: {
  actions: SessionAction[]
  summary: string
  app: string
  anthropic: Anthropic
  modelId: string
}): Promise<TsPageAppend[]> {
  const actionList = input.actions
    .map((a, i) => `${i + 1}. ${a.tool}(${JSON.stringify(a.input)})`)
    .join('\n')

  const userPrompt = `App: ${input.app}

What the session verified (author's summary):
${input.summary || '(none provided)'}

Recorded browser actions, in order:
${actionList}

Mine any reusable page-object methods this session needs that don't already exist.`

  const system =
    PAGE_MINING_SYSTEM +
    (await tsConventions(input.app)) +
    `

For THIS task specifically: do NOT include a test.spec.ts block at all. Output ONLY
"=== FILE: pages/<app>/<screen>.page.ts (append) ===" / "(new)" blocks for methods the
recorded session needs that aren't already covered — or respond with EXACTLY \`=== NONE ===\`
and nothing else when the existing page-object API already covers everything the session did.`

  const message = await input.anthropic.messages.create({
    model: input.modelId,
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  })
  return parseTsPageBlocks(extractText(message))
}

/**
 * Lenient parse for the page-mining response: zero blocks is a perfectly normal result
 * (nothing new to mine), and the model's `=== NONE ===` sentinel (case/whitespace
 * tolerant) is treated the same as zero blocks. Unlike `parseTsArtifacts`, this never
 * throws — malformed output just yields []. A block's mode follows the same header-suffix
 * rule (` (append)` / ` (new)` / unsuffixed-with-`export class` falls back to `'new'`,
 * otherwise it's dropped rather than erroring).
 */
export function parseTsPageBlocks(text: string): TsPageAppend[] {
  const cleaned = stripFences(text).trim()
  if (/^===\s*NONE\s*===$/i.test(cleaned) || cleaned === '') return []

  const matches = [...cleaned.matchAll(FILE_MARKER_RE)]
  if (matches.length === 0) return []

  const blocks = matches.map((m, i) => {
    const header = m[1].trim()
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : cleaned.length
    return { header, body: stripFences(cleaned.slice(start, end)) }
  })

  const out: TsPageAppend[] = []
  for (const b of blocks) {
    if (!b.body) continue
    const isAppend = /\(append\)\s*$/.test(b.header)
    const isNew = /\(new\)\s*$/.test(b.header)
    const path = b.header.replace(/\s*\((?:append|new)\)\s*$/, '').trim()
    if (!path) continue

    if (isAppend) {
      out.push({ path, mode: 'append', body: b.body })
    } else if (isNew || b.body.includes('export class')) {
      out.push({ path, mode: 'new', body: b.body })
    } else {
      out.push({ path, mode: 'append', body: b.body })
    }
  }
  return out
}

// ─── Python (pytest) codegen — framework-native two-artifact contract ────────
//
// Generates specs for the vendored automation-hub/python/ pytest framework (see
// lib/pom-index.ts). Tests are fluent chains of page-object methods only; any selector
// the model needs that has no existing page method comes back as a separate "page
// append" artifact (new methods to add to a pages/<app>/*.py file) rather than being
// inlined into the test. Gating on whether Python generation is configured
// (isPythonEnabled()) is the routes' job, not this module's — these functions always
// attempt generation; the POM index is simply empty (and omitted from the prompt) when
// no vendored pages exist yet for the app.

/** One page file's worth of new methods to append verbatim to its class body. */
export interface PyPageAppend {
  /** Path relative to automation-hub/python/, e.g. "pages/<app>/login_page.py". */
  path: string
  /** New method source, each line already indented 4 spaces (class-body ready). */
  methods: string
}

/** The two-artifact output of every Python codegen function: the test + any page appends. */
export interface PyArtifacts {
  /** Full contents of the fluent-chain test file. */
  test: string
  /** Zero or more new-method blocks, one per page file that needed additions. */
  pageAppends: PyPageAppend[]
}

/**
 * Split a model response into the two-artifact contract: the FIRST `=== FILE: ... ===`
 * block is always the test file; any subsequent blocks (marked with the literal suffix
 * ` (append)`) are new page-object methods for the named page file. Defensively strips
 * markdown fences per block in case the model wraps one despite instructions. Throws if
 * no `=== FILE: ... ===` marker is found at all, or if the test block doesn't contain
 * `import pytest`.
 */
export function parsePyArtifacts(text: string): PyArtifacts {
  const cleaned = stripFences(text)
  const matches = [...cleaned.matchAll(FILE_MARKER_RE)]
  if (matches.length === 0) {
    throw new Error('Model did not return any "=== FILE: ... ===" blocks')
  }

  const blocks = matches.map((m, i) => {
    const header = m[1].trim()
    const start = m.index! + m[0].length
    const end = i + 1 < matches.length ? matches[i + 1].index! : cleaned.length
    return { header, body: stripFences(cleaned.slice(start, end)) }
  })

  const test = blocks[0].body
  if (!test.includes('import pytest')) {
    throw new Error('Model did not return a valid test file (missing "import pytest")')
  }

  const pageAppends: PyPageAppend[] = blocks.slice(1).map((b) => ({
    path: b.header.replace(/\s*\(append\)\s*$/, '').trim(),
    methods: b.body,
  }))

  return { test, pageAppends }
}

/**
 * Substrings that mean a test file is reaching past the page-object layer and touching
 * raw Playwright selectors/waits/assertions directly — those belong in page methods, not
 * in the fluent test chain. `pytest.raises(...)` is allowed (it never matches `expect(`).
 * The last three patterns are the Python side of the ONE-PAGE-PER-TEST rule: a test must
 * never import a page module directly, and its test method must take exactly one
 * non-`self` fixture argument (a second, comma-separated param is the violation).
 */
const LINT_VIOLATION_PATTERNS: RegExp[] = [
  /\bpage\.locator\(/,
  /\.get_by_role\(/,
  /\.get_by_text\(/,
  /\.get_by_label\(/,
  /\.dispatch_event\(/,
  /\bexpect\(/,
  /\bsync_playwright\b/,
  /\.goto\(/,
  /^from pages\./,
  /^import pages\b/,
  /^def\s+test_\w+\s*\(\s*self\s*,\s*\w+\s*,/,
]

/**
 * Lint a Python TEST artifact for raw-selector violations of the fluent-chain rule, plus
 * the one-page-per-test rule (no `from pages.`/`import pages`, and exactly one non-`self`
 * fixture argument on the test method). Returns the offending source lines (trimmed), or
 * [] when clean. Only meant to run against the test artifact — page-append artifacts are
 * expected to contain selectors.
 */
export function lintFluentTest(test: string): string[] {
  const violations: string[] = []
  for (const rawLine of test.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (LINT_VIOLATION_PATTERNS.some((re) => re.test(line))) {
      violations.push(line)
    }
  }
  return violations
}

function pyRetryInstruction(violations: string[]): string {
  return `The test file breaks the fluent-chain rule — it contains raw selectors/waits/assertions that must live in page objects instead of the test:\n\n${violations.map((v) => `  ${v}`).join('\n')}\n\nMove this logic into new or existing page-object methods (emit new ones as a "(append)" block) and rewrite the test as a pure fluent chain of page methods only. Re-emit the FULL output using the same "=== FILE: ... ===" format — the complete test file plus any page-append blocks.`
}

/**
 * Run one Claude call, parse it into PyArtifacts, and lint the test artifact via
 * `generateArtifactsWithRetry` — one automatic retry (as a new assistant+user turn
 * quoting the violations) before throwing.
 */
async function generatePyArtifactsWithRetry(
  client: Anthropic,
  modelId: string,
  system: string,
  messages: Anthropic.MessageParam[],
): Promise<PyArtifacts> {
  let history = messages
  let lastText = ''
  const runOnce = async (retryInstr?: string): Promise<string> => {
    if (retryInstr) {
      history = [...history, { role: 'assistant', content: lastText }, { role: 'user', content: retryInstr }]
    }
    const message = await client.messages.create({ model: modelId, max_tokens: 8192, system, messages: history })
    lastText = extractText(message)
    return lastText
  }
  return generateArtifactsWithRetry(runOnce, parsePyArtifacts, lintFluentTest, pyRetryInstruction)
}

/**
 * Non-Anthropic equivalent of generatePyArtifactsWithRetry — runModel() is single-turn
 * (no assistant/tool_use message history), so the retry re-sends the full instruction
 * with the rejected attempt and violations quoted inline instead of as prior turns.
 */
async function generatePyArtifactsWithRetryViaRunModel(
  modelId: string,
  system: string,
  userPrompt: string,
): Promise<PyArtifacts> {
  const { runModel } = await import('@/lib/ai')
  let lastText = ''
  const runOnce = async (retryInstr?: string): Promise<string> => {
    if (!retryInstr) {
      lastText = await runModel(modelId, system, userPrompt, { maxTokens: 8192 })
      return lastText
    }
    const retryPrompt = `${userPrompt}

---
YOUR PREVIOUS RESPONSE (rejected):
${lastText}

${retryInstr}`
    lastText = await runModel(modelId, system, retryPrompt, { maxTokens: 8192 })
    return lastText
  }
  return generateArtifactsWithRetry(runOnce, parsePyArtifacts, lintFluentTest, pyRetryInstruction)
}

const PYTHON_SYSTEM_PROMPT = `You convert a recorded browser-automation session into a framework-native pytest test
plus any new page-object methods it needs, for the vendored automation-hub/python/ pytest
framework.

Rules:
- Reproduce the flow from the recorded actions in order (navigate, click, type, etc.) —
  but ONLY by calling page-object methods; never inline the raw actions as selectors.
- Turn what the session verified into real page-object assertion methods.
- Keep it deterministic and runnable as-is; no comments explaining the conversion.`

/** Generate framework-native pytest artifacts from a session's actions. Throws on API failure. */
export async function generateSpecPython(input: GenerateSpecInput): Promise<PyArtifacts> {
  const client = new Anthropic({ apiKey: input.apiKey })

  const actionList = input.actions
    .map((a, i) => `${i + 1}. ${a.tool}(${JSON.stringify(a.input)})`)
    .join('\n')

  const userPrompt = `Test title: ${input.title}

What the session verified (author's summary):
${input.summary || '(none provided)'}

Recorded browser actions, in order:
${actionList}

Write the pytest artifacts.`

  return generatePyArtifactsWithRetry(
    client,
    input.modelId,
    PYTHON_SYSTEM_PROMPT + pythonConventions(input.app),
    [{ role: 'user', content: userPrompt }],
  )
}

const PYTHON_FROM_TESTCASE_SYSTEM = `You convert a manual test case into a framework-native pytest test plus any new
page-object methods it needs, for the vendored automation-hub/python/ pytest framework.

The input is a tester's objective and step list (each step is usually an action and an
expected result). Translate it into a test that performs the actions and turns the expected
results into real page-object assertions — via page methods only, never raw selectors
inlined in the test. You don't know exact selectors — infer reasonable accessible names
from the step text when writing NEW page methods.`

/** Generate framework-native pytest artifacts directly from a manual test case (no live browser drive). */
export async function generateSpecPythonFromTestcase(input: {
  apiKey: string
  modelId: string
  provider?: string
  title: string
  objective: string
  steps: string
  /** Dashboard app slug this automation targets (drives framework conventions). */
  app?: string
}): Promise<PyArtifacts> {
  const userPrompt = `Test title: ${input.title}\n\nObjective: ${input.objective}\n\nSteps:\n${input.steps}\n\nWrite the pytest artifacts.`
  const system = PYTHON_FROM_TESTCASE_SYSTEM + pythonConventions(input.app)
  if ((input.provider ?? 'anthropic') === 'anthropic') {
    const client = new Anthropic({ apiKey: input.apiKey })
    return generatePyArtifactsWithRetry(client, input.modelId, system, [{ role: 'user', content: userPrompt }])
  }
  return generatePyArtifactsWithRetryViaRunModel(input.modelId, system, userPrompt)
}

const REVISE_PY_SYSTEM = `You revise an existing framework-native pytest test (vendored automation-hub/python/
pytest framework) per the user's instruction, returning the updated two-artifact output.
Preserve everything the instruction doesn't ask to change. The test must remain a pure
fluent chain of page-object methods — if the instruction needs an action/assertion with no
existing page method, add a NEW method via a page-append block instead of inlining a
selector into the test.`

/** Revise an existing Python test per a natural-language instruction (editor AI assist). */
export async function revisePySpec(input: {
  apiKey: string
  modelId: string
  provider?: string
  currentTest: string
  pageFiles: Array<{ path: string; content: string }>
  instruction: string
  /** Dashboard app slug this automation targets (drives framework conventions). */
  app?: string
}): Promise<PyArtifacts> {
  const pageFilesSection = input.pageFiles.length
    ? input.pageFiles.map((f) => `### ${f.path}\n${f.content}`).join('\n\n')
    : '(none provided)'
  const userPrompt = `Current test file:

${input.currentTest}

Page objects it imports:
${pageFilesSection}

Instruction: ${input.instruction}

Re-emit the full output (test file, plus any page-append blocks needed) using the
"=== FILE: ... ===" format.`
  const system = REVISE_PY_SYSTEM + pythonConventions(input.app)
  if ((input.provider ?? 'anthropic') === 'anthropic') {
    const client = new Anthropic({ apiKey: input.apiKey })
    return generatePyArtifactsWithRetry(client, input.modelId, system, [{ role: 'user', content: userPrompt }])
  }
  return generatePyArtifactsWithRetryViaRunModel(input.modelId, system, userPrompt)
}

/**
 * Resolve a default Anthropic API key + Claude model the same way the automation routes
 * do (see e.g. src/app/api/[app]/automation/[project]/improve/route.ts's pickClaudeModel),
 * for callers like translateSpecToPython() that don't receive credentials as input.
 * Dynamically imports the main app's settings/model modules to keep the normal case
 * (explicit apiKey/modelId passed in) fully decoupled from the Next.js app.
 */
async function resolveDefaultClaudeCreds(): Promise<{ apiKey: string; modelId: string }> {
  const [{ getSetting }, { getModelsWithStatusAsync }] = await Promise.all([
    import('@/lib/settings'),
    import('@/lib/ai'),
  ])
  const [apiKey, models] = await Promise.all([
    getSetting('global', 'ANTHROPIC_API_KEY'),
    getModelsWithStatusAsync(),
  ])
  const enabledClaude = models.filter((m) => m.provider === 'anthropic' && m.enabled)
  const modelId = enabledClaude[0]?.id
  if (!apiKey || !modelId) {
    throw new Error('No Claude model available — add an Anthropic API key in Settings')
  }
  // Mirrors the routes' resolveId(): the bare haiku alias needs the dated id for the API.
  return { apiKey, modelId: modelId === 'claude-haiku-4-5' ? 'claude-haiku-4-5-20251001' : modelId }
}

const TRANSLATE_TO_PYTHON_SYSTEM = `You translate an existing TypeScript @playwright/test spec into a framework-native
two-artifact pytest test for the vendored automation-hub/python/ pytest framework.
Preserve semantics exactly — the same navigations, actions, and assertions — only the
language and framework conventions change. The test must end up as a pure fluent chain of
page-object methods; any raw selector/assertion the TS spec used that has no existing page
method becomes a NEW method in a page-append block instead of being inlined into the test.`

/** Translate a saved TypeScript @playwright/test spec into the framework-native pytest equivalent. */
export async function translateSpecToPython(tsSpec: string, app: string): Promise<PyArtifacts> {
  const { apiKey, modelId } = await resolveDefaultClaudeCreds()
  const client = new Anthropic({ apiKey })
  const userPrompt = `TypeScript spec to translate:\n\n${tsSpec}\n\nWrite the equivalent pytest artifacts.`
  return generatePyArtifactsWithRetry(
    client,
    modelId,
    TRANSLATE_TO_PYTHON_SYSTEM + pythonConventions(app),
    [{ role: 'user', content: userPrompt }],
  )
}
