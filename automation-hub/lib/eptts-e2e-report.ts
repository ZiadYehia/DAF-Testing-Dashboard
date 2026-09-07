/**
 * Demo-friendly step reporting for the EPTTS end-to-end lifecycle journey.
 *
 * WHY A REPORTER AND NOT JUST console.log
 *
 * The journey's whole claim is "the business state actually changed, not merely that the
 * API said 202". Someone watching a demo has to be able to see that claim being made and
 * met, per step, without reading the spec. So every verification is printed as a row
 * carrying all six things the reader needs:
 *
 *   operation · acting role · the EPC acted on · expected state · actual state · PASS/FAIL
 *
 * and every row is also kept in a ledger so the run can close with one table summarising
 * the whole lifecycle. `printFinalSummary()` prints that.
 *
 * TWO RULES THIS FOLLOWS
 *
 * 1. **The actual value is always printed, pass or fail.** A row that only shows a value
 *    when it is wrong cannot be used as evidence that the state was checked at all.
 * 2. **Assertions are soft.** One step reports every field it got wrong in a single run
 *    instead of stopping at the first, which is the difference between "custody did not
 *    move" and "custody did not move AND the pack is still in transit AND it left its
 *    container" — three facts that together name the defect. The journey is
 *    `describe.serial`, so a step with a failed soft assertion still aborts everything
 *    after it; nothing runs on top of state that was never established.
 */
import { expect } from '@playwright/test'
import {
  packOf, glnFor, platformRoleFor, sameSscc, ssccUrnToDigits,
  type Role, type PackState,
} from './eptts-api'

const WIDTH = 104

/** One field-level claim about the business state, with the evidence either way. */
export interface FieldCheck {
  field: string
  expected: string
  actual: string
  pass: boolean
}

interface Step {
  n: string
  title: string
  role: Role
  operation: string
  /** One-line prose statement of the state this step is supposed to produce. */
  expectedState: string
  epcs: string[]
  /** Filled in by recordSubmission — how the platform acknowledged the write. */
  submission: string
  checks: { subject: string; fields: FieldCheck[] }[]
}

const ledger: Step[] = []
let current: Step | null = null
/**
 * Subject of the last `verifyFact` row, so consecutive facts about the same thing share
 * one table instead of each reprinting the subject and column headings. Six one-row
 * tables titled "MANUFACTURER B2B token" is noise, not evidence.
 */
let lastFactSubject: string | null = null

function line(ch = '─'): string {
  return ch.repeat(WIDTH)
}
/**
 * Fit `s` into an `n`-wide column, ALWAYS leaving at least one space of separation.
 *
 * The obvious `s.length > n` version leaves none when the string is exactly `n` long, and
 * the columns here routinely are: "return-ship → manufacturer" is 26 characters in a
 * 26-wide column, so the summary printed `manufacturerstatus=in_transit` and the reader
 * could not tell where the operation ended and the state began.
 */
function pad(s: string, n: number): string {
  const max = n - 1
  return (s.length > max ? s.slice(0, max - 1) + '…' : s).padEnd(n)
}
/** SGTINs are long and all differ in the tail, so keep the tail when shortening. */
function shortEpc(epc: string): string {
  if (epc.length <= 54) return epc
  return epc.slice(0, 26) + '…' + epc.slice(-24)
}
function roleLabel(role: Role): string {
  return `${role.toUpperCase()} (platform role: ${platformRoleFor(role)}, GLN ${glnFor(role)})`
}
function asList(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v]
}

/**
 * Open a step. Everything printed until the next beginStep belongs to it.
 *
 * `expectedState` is prose on purpose: it is the sentence the demo audience hears before
 * the numbers appear, and it is what the closing summary shows in its EXPECTED column.
 */
export function beginStep(o: {
  n: string
  title: string
  role: Role
  operation: string
  expectedState: string
  epcs: string[]
}): void {
  current = { ...o, submission: '(not submitted)', checks: [] }
  ledger.push(current)
  lastFactSubject = null

  console.log('')
  console.log(line('═'))
  console.log(` STEP ${o.n} — ${o.title.toUpperCase()}`)
  console.log(line('═'))
  console.log(` ROLE       ${roleLabel(o.role)}`)
  console.log(` OPERATION  ${o.operation}`)
  console.log(` EPC(s)     ${o.epcs.map(shortEpc).join('\n            ')}`)
  console.log(` EXPECTED   ${o.expectedState}`)
}

/** Record how the platform acknowledged the write (HTTP status + polled message status). */
export function recordSubmission(text: string): void {
  if (current) current.submission = text
  console.log(` SUBMITTED  ${text}`)
}

/** A step that performs no write — a read-only check or a precondition. */
export function recordNoSubmission(text: string): void {
  if (current) current.submission = text
  console.log(` SOURCE     ${text}`)
}

/** What a pack must look like after a step. Only the fields given are checked. */
export interface StateExpectation {
  /** VerifyProduct answers 200 for an unknown pack, so this is a real check, not a formality. */
  verified?: boolean
  /** Lifecycle state, lowercase. A list means "any of these" where the contract is not pinned. */
  status?: string | string[]
  /** GLN that must now hold the pack — the custody check. */
  custodyGln?: string | string[]
  /** SSCC **URN**, converted for comparison; `null` asserts the pack is loose. */
  parentSscc?: string | null
  batchNumber?: string
  expiryDate?: string
  gtin?: string
  isRecalled?: boolean
}

/**
 * Read a pack back and check it against `expected`, printing every field either way.
 *
 * This is the step that makes the journey mean anything: it goes to POST /VerifyProduct,
 * which takes ONE SGTIN and returns that pack's own state, so there is no paging window
 * and no guessing about which record belongs to our submission.
 */
export async function verifyPack(
  role: Role, epc: string, expected: StateExpectation, subject?: string,
): Promise<PackState | null> {
  const result = await packOf(role, epc)
  const p = result.pack
  const fields: FieldCheck[] = []
  const add = (field: string, want: string, got: string, pass: boolean) =>
    fields.push({ field, expected: want, actual: got, pass })

  if (expected.verified !== undefined) {
    add('verified', String(expected.verified), String(result.verified), result.verified === expected.verified)
  }

  if (!p) {
    add(
      'pack record', 'readable via VerifyProduct',
      `null (verified=${result.verified}, alerts=[${result.alerts.join(', ')}])`, false,
    )
  } else {
    if (expected.status !== undefined) {
      const want = asList(expected.status)
      add('status', want.join(' or '), String(p.status), want.includes(p.status))
    }
    if (expected.custodyGln !== undefined) {
      const want = asList(expected.custodyGln)
      add('currentGln (custodian)', want.join(' or '), String(p.currentGln), want.includes(String(p.currentGln)))
    }
    if (expected.parentSscc !== undefined) {
      if (expected.parentSscc === null) {
        add('parentSscc', 'null (loose — in no container)', String(p.parentSscc ?? 'null'), !p.parentSscc)
      } else {
        // parentSscc comes back as the 18-digit GS1 element string, NOT the URN the events
        // carry. Comparing the two forms directly makes a working aggregation look broken.
        add('parentSscc', ssccUrnToDigits(expected.parentSscc), String(p.parentSscc ?? 'null'),
          sameSscc(expected.parentSscc, p.parentSscc))
      }
    }
    if (expected.gtin !== undefined) add('gtin', expected.gtin, String(p.gtin), p.gtin === expected.gtin)
    if (expected.batchNumber !== undefined) {
      add('batchNumber (lot)', expected.batchNumber, String(p.batchNumber), p.batchNumber === expected.batchNumber)
    }
    if (expected.expiryDate !== undefined) {
      // The platform may echo the date as a full timestamp; compare on the date part.
      const got = String(p.expiryDate ?? 'null')
      add('expiryDate', expected.expiryDate, got, got.slice(0, 10) === expected.expiryDate)
    }
    if (expected.isRecalled !== undefined) {
      add('isRecalled', String(expected.isRecalled), String(p.isRecalled), p.isRecalled === expected.isRecalled)
    }
  }

  const label = subject ?? shortEpc(epc)
  if (current) current.checks.push({ subject: label, fields })

  lastFactSubject = null
  console.log(line())
  console.log(` VERIFY     POST /VerifyProduct as ${role.toUpperCase()} — ${label}`)
  console.log(`   ${pad('FIELD', 24)}${pad('EXPECTED', 34)}${pad('ACTUAL', 34)}RESULT`)
  for (const f of fields) {
    console.log(`   ${pad(f.field, 24)}${pad(f.expected, 34)}${pad(f.actual, 34)}${f.pass ? 'PASS' : 'FAIL'}`)
  }

  // Soft so one step reports every field it got wrong, not just the first.
  for (const f of fields) {
    expect.soft(
      f.pass,
      `STEP ${current?.n ?? '?'} ${current?.title ?? ''} — ${label}: ` +
      `${f.field} expected ${f.expected}, actual ${f.actual}`,
    ).toBe(true)
  }
  return p
}

/**
 * Record a check that is not a pack read — an authenticated identity, a master-data
 * precondition, an audit-trail read. Same six columns, so the demo table stays uniform.
 */
export function verifyFact(
  field: string, expectedStr: string, actualStr: string, pass: boolean, subject = '',
): void {
  const fields: FieldCheck[] = [{ field, expected: expectedStr, actual: actualStr, pass }]
  if (current) current.checks.push({ subject, fields })
  const heading = subject || field
  if (heading !== lastFactSubject) {
    console.log(line())
    console.log(` VERIFY     ${heading}`)
    console.log(`   ${pad('FIELD', 24)}${pad('EXPECTED', 34)}${pad('ACTUAL', 34)}RESULT`)
    lastFactSubject = heading
  }
  console.log(`   ${pad(field, 24)}${pad(expectedStr, 34)}${pad(actualStr, 34)}${pass ? 'PASS' : 'FAIL'}`)
  expect.soft(pass, `${subject || field}: expected ${expectedStr}, actual ${actualStr}`).toBe(true)
}

/** Every field check the run has made so far, flattened. */
function allFields(): FieldCheck[] {
  return ledger.flatMap((s) => s.checks.flatMap((c) => c.fields))
}

/** One compact line of the state a step actually landed on, for the summary table. */
function actualDigest(s: Step): string {
  const interesting = ['status', 'currentGln (custodian)', 'parentSscc']
  const seen = new Map<string, string>()
  for (const c of s.checks) {
    for (const f of c.fields) {
      if (!interesting.includes(f.field)) continue
      const key = f.field.split(' ')[0]
      if (!seen.has(key)) seen.set(key, f.actual)
    }
  }
  if (seen.size === 0) {
    const first = s.checks[0]?.fields[0]
    return first ? `${first.field}=${first.actual}` : '(no read-back)'
  }
  const parent = seen.get('parentSscc')
  return [
    seen.has('status') ? `status=${seen.get('status')}` : '',
    seen.has('currentGln') ? `gln=${seen.get('currentGln')}` : '',
    parent ? `parent=${parent === 'null' ? 'none' : parent}` : '',
  ].filter(Boolean).join(' ')
}

/**
 * Close the run with the whole lifecycle in one table.
 *
 * Printed from an afterAll hook so it appears even when a step fails — a demo audience
 * needs to see how far the lifecycle got, and a failed run is exactly when that matters.
 */
export function printFinalSummary(header: string): void {
  const fields = allFields()
  const failed = fields.filter((f) => !f.pass)

  console.log('')
  console.log(line('═'))
  console.log(` ${header}`)
  console.log(line('═'))
  console.log(` ${pad('STEP', 6)}${pad('ROLE', 15)}${pad('OPERATION', 28)}${pad('VERIFIED STATE (ACTUAL)', 46)}RESULT`)
  console.log(line())
  for (const s of ledger) {
    const stepFields = s.checks.flatMap((c) => c.fields)
    const bad = stepFields.filter((f) => !f.pass).length
    const verdict = stepFields.length === 0 ? 'NO CHECK' : bad === 0 ? 'PASS' : `FAIL (${bad})`
    console.log(
      ` ${pad(s.n, 6)}${pad(s.role.toUpperCase(), 15)}${pad(s.title, 28)}${pad(actualDigest(s), 46)}${verdict}`,
    )
  }
  console.log(line())
  console.log(` steps: ${ledger.length}   state verifications: ${fields.length}   ` +
    `passed: ${fields.length - failed.length}   failed: ${failed.length}`)
  if (failed.length) {
    console.log('')
    console.log(' FAILED VERIFICATIONS')
    for (const f of failed) {
      console.log(`   ${pad(f.field, 24)}expected ${f.expected}  ·  actual ${f.actual}`)
    }
  }
  console.log(line('═'))
}
