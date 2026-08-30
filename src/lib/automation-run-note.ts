/**
 * Builds the machine-authored execution note recorded when an automation run
 * linked to a dashboard test case fails. Shared by the two sync paths —
 * src/app/api/[app]/automation/[project]/run/route.ts (single-project run) and
 * src/lib/automation-regression.ts (regression sweep) — so the note format
 * can't drift between them.
 */
import type { RunResult } from '@automation-hub/types'

/** ANSI color/style escape codes (e.g. `[31m`) left in captured runner output. */
const ANSI_RE = /\[[0-9;]*m/g

const NO_DETAIL = 'Automation run failed (no error detail captured)'

/**
 * First non-blank line of a (possibly ANSI-colored, possibly multi-line) error
 * string, trimmed. Falls back to a generic message when there's nothing usable.
 */
function firstMeaningfulLine(raw: string | undefined): string {
  if (!raw) return NO_DETAIL
  const line = raw
    .replace(ANSI_RE, '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return line || NO_DETAIL
}

/** Marks the machine-authored line so it can be recognised and replaced later. */
export const AUTOMATION_NOTE_PREFIX = '[automation '
const MACHINE_PREFIX = AUTOMATION_NOTE_PREFIX

/**
 * `[automation <run timestamp>] <first error line>` — a single-line,
 * machine-authored note. Never called for a `pass` result: a human
 * observation on a test case must survive a green run untouched.
 */
export function buildAutomationFailureNote(result: Pick<RunResult, 'ts' | 'error'>): string {
  return `${MACHINE_PREFIX}${result.ts}] ${firstMeaningfulLine(result.error)}`
}

// The merge itself lives in src/lib/execution.ts (appendExecutionNoteLine): it
// has to resolve the test-case version and re-read the current note inside the
// same lock as the write. Doing it here would read the legacy flat namespace
// while the write resolved to the latest version, silently dropping the
// tester's note.
