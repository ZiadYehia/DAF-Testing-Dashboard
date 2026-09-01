/**
 * EPTTS test-case registry — one Playwright test per Hub project.
 *
 * WHY THIS EXISTS
 *
 * The Automation Hub links a project to exactly ONE dashboard test case
 * (`ProjectMeta.linkedTestcase`), and a replay syncs that one case's pass/fail back to
 * the feature's Execution tab. So a project containing 47 tests can only ever report a
 * status for one of them — the other 46 are invisible to the dashboard, and there is no
 * way to replay a single case on its own.
 *
 * Every test case therefore gets its own project. To avoid 400 copies of the same
 * plumbing, the case bodies live here in one registry and each project's `test.spec.ts`
 * is a two-line shim:
 *
 *     import { defineCase } from '../../lib/eptts-cases'
 *     defineCase('TC_AUTH_001')
 *
 * That keeps one project per case (individually replayable, individually reported) while
 * the logic stays in one reviewable place.
 *
 * NOT per-case, deliberately: `eptts-api-smoke` and `eptts-api-e2e-returns`. Those are a
 * contract smoke and an end-to-end journey — they verify that the steps compose, which is
 * a property no single test case describes, and the journey's steps must run in order
 * sharing state. They keep their own multi-test specs and are not linked to one case.
 */
import { test } from '@playwright/test'
import { disposeApi } from '../eptts-api'
import { writeApiArtifacts, resetExchanges } from '../eptts-api-log'
import { AUTH_CASES } from './authentication'
import { COMMISSION_CASES } from './commission'
import { PACKING_CASES, UNPACKING_CASES } from './packing'
import { DESTRUCTION_CASES } from './destruction'
import { DISPENSING_CASES } from './dispensing'
import { PARTIAL_DISPENSING_CASES } from './partial-dispensing'
import { SHIPPING_CASES, RECEIVING_CASES } from './shipping'
import { RETURN_CASES, RETURN_RECEIVING_CASES } from './returns'

/** One executable test case, keyed by its spreadsheet ID. */
export interface ApiCase {
  /** Spreadsheet TestCase ID — must match data/eptts-web/features/<feature>/ verbatim. */
  id: string
  /** Feature slug the case belongs to, for the Hub's linkedTestcase. */
  feature: string
  /** Objective, shown as the Playwright test title after the ID. */
  title: string
  /**
   * Set when the platform currently fails this case. Becomes `test.fail(true, reason)`:
   * the assertion still runs, so the suite stays green while the gap exists and reports
   * an "unexpected pass" the moment it is fixed.
   */
  expectFail?: string
  /** Set when the case cannot run at all; becomes `test.fixme(true, reason)`. */
  skip?: string
  /** Async submit-and-poll cases need the longer timeout. */
  slow?: boolean
  run: () => Promise<void>
}

/** Every registered case, id -> definition. */
export const CASES: Record<string, ApiCase> = {}

function register(cases: ApiCase[]): void {
  for (const c of cases) {
    if (CASES[c.id]) throw new Error(`duplicate test case id "${c.id}"`)
    CASES[c.id] = c
  }
}

register(AUTH_CASES)
register(COMMISSION_CASES)
register(PACKING_CASES)
register(UNPACKING_CASES)
register(DESTRUCTION_CASES)
register(DISPENSING_CASES)
register(PARTIAL_DISPENSING_CASES)
register(SHIPPING_CASES)
register(RECEIVING_CASES)
register(RETURN_CASES)
register(RETURN_RECEIVING_CASES)

/** Ids of every registered case — used by the project generator. */
export function registeredIds(): string[] {
  return Object.keys(CASES)
}

/**
 * Emit the single Playwright test for one case. Called from a project's test.spec.ts.
 *
 * Throws on an unknown id rather than silently emitting nothing, so a renamed case fails
 * loudly instead of leaving a project that always "passes" with zero tests.
 */
export function defineCase(id: string): void {
  const c = CASES[id]
  if (!c) {
    throw new Error(
      `unknown test case "${id}" — registered ids: ${registeredIds().join(', ')}. ` +
        `Add it to automation-hub/lib/eptts-cases/ or fix the project's spec.`,
    )
  }

  test(`${c.id} — ${c.title}`, async () => {
    if (c.slow) test.slow()
    if (c.skip) test.fixme(true, c.skip)
    if (c.expectFail) test.fail(true, c.expectFail)
    resetExchanges()
    try {
      await c.run()
    } finally {
      // In `finally` so a failing case still produces its request/response log — that is
      // exactly when someone needs to see what was actually sent.
      await writeApiArtifacts(`${c.id} — ${c.title}`)
    }
  })

  // One project runs one case, so disposing here is safe and keeps contexts from leaking
  // between replays.
  test.afterAll(async () => { await disposeApi() })
}
