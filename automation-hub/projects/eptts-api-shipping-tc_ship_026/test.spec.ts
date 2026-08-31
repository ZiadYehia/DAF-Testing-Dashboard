/**
 * TC_SHIP_026 — shipping with an empty eventTimeZoneOffset is refused
 *
 * Feature: api-shipping
 *
 * One project per test case, so this case can be replayed on its own and its pass/fail
 * syncs to exactly this test case in the feature's Execution tab. The body lives in
 * automation-hub/lib/eptts-cases/ so 400 projects share one implementation.
 */
import { defineCase } from '../../lib/eptts-cases'

defineCase('TC_SHIP_026')
