/**
 * TS_RTRV_004 — receiving a mix of returned SSCCs and SGTINs in one request
 *
 * Feature: api-return-receiving
 *
 * One project per test case, so this case can be replayed on its own and its pass/fail
 * syncs to exactly this test case in the feature's Execution tab. The body lives in
 * automation-hub/lib/eptts-cases/ so 400 projects share one implementation.
 */
import { defineCase } from '../../lib/eptts-cases'

defineCase('TS_RTRV_004')
