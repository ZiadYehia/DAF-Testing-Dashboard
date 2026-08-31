/**
 * TS_RTRV_005 — returned products become available again at the manufacturer
 *
 * Feature: api-return-receiving
 *
 * One project per test case, so this case can be replayed on its own and its pass/fail
 * syncs to exactly this test case in the feature's Execution tab. The body lives in
 * automation-hub/lib/eptts-cases/ so 400 projects share one implementation.
 */
import { defineCase } from '../../lib/eptts-cases'

defineCase('TS_RTRV_005')
