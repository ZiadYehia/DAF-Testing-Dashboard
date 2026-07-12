/**
 * LOCKED framework file — not editable from the dashboard UI/API.
 *
 * Test-data helpers shared by every TS page object and fluent test. TS mirror of
 * python/autotest_framework/src/utils/data.py's `unique_suffix`.
 */

/**
 * Digits unique per call — timestamp tail + 3 random digits (parallel-safe).
 * Used to build unique names/identifiers in generated tests, e.g.
 * `` `QA Sample Item ${uniqueSuffix()}` ``.
 *
 * Note: the Python original takes the last 8 digits of a SECONDS timestamp
 * (`time.time()`); this takes the last 8 digits of a MILLISECONDS timestamp
 * (`Date.now()`) — same intent (a fast-changing tail that avoids collisions
 * across parallel workers), not a bit-identical port, since Node has no
 * built-in seconds-resolution clock call.
 */
export function uniqueSuffix(): string {
  const tail = Date.now().toString().slice(-8)
  const rand = Math.floor(100 + Math.random() * 900)
  return `${tail}${rand}`
}
