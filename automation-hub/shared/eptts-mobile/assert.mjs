/**
 * Minimal assertion helpers — replaces jest's `expect` for hand-written
 * Appium specs (the harness has no bundled assertion library). Both throw a
 * plain Error, which the harness's runSpec catches and reports as a failed
 * run.
 */

/** Throws `msg` if `cond` is falsy. */
export function ok(cond, msg) {
  if (!cond) throw new Error(msg ?? 'Assertion failed')
}

/** Throws if `actual` !== `expected`. */
export function equal(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}
