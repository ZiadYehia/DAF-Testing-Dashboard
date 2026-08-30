// In-memory, fixed-window rate limiter. Single-instance deployment only —
// buckets live in process memory, so a multi-instance deployment (multiple
// replicas, serverless, etc.) needs a shared store (e.g. Redis)
// instead of this module to enforce a consistent limit across instances.

const buckets = new Map<string, { count: number; windowStart: number }>()

export const LOGIN_RATE_LIMIT = { max: 5, windowMs: 15 * 60_000 }

export type RateLimitOptions = { max: number; windowMs: number }

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

// Non-consuming check: does NOT increment the counter. Callers should call
// recordFailure() separately on an actual failed attempt.
export function checkRateLimit(key: string, opts: RateLimitOptions = LOGIN_RATE_LIMIT): RateLimitResult {
  const bucket = buckets.get(key)
  const now = Date.now()

  if (!bucket || now - bucket.windowStart >= opts.windowMs) {
    // No bucket yet, or the window has expired — treated as fresh/allowed.
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (bucket.count < opts.max) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const retryAfterSeconds = Math.ceil((bucket.windowStart + opts.windowMs - now) / 1000)
  return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 0) }
}

// Records a failed attempt, incrementing the bucket's counter. Resets the
// window if the previous one has expired.
export function recordFailure(key: string, opts: RateLimitOptions = LOGIN_RATE_LIMIT): void {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart >= opts.windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
  } else {
    bucket.count += 1
  }

  // Lazily sweep expired entries so the map doesn't grow unbounded. No
  // timers/intervals — this only runs on the (rare) write path once the
  // map has grown large.
  if (buckets.size > 1000) {
    for (const [bucketKey, value] of buckets) {
      if (now - value.windowStart >= opts.windowMs) {
        buckets.delete(bucketKey)
      }
    }
  }
}

// Clears a single key's bucket, e.g. after a successful login.
export function clearRateLimit(key: string): void {
  buckets.delete(key)
}

// Test-only helper to reset all rate-limit state between test cases.
export function __clearAll(): void {
  buckets.clear()
}
