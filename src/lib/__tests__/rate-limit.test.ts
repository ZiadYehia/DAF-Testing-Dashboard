import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit, recordFailure, clearRateLimit, __clearAll, LOGIN_RATE_LIMIT } from '@/lib/rate-limit'

beforeEach(() => {
  vi.useFakeTimers()
  __clearAll()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('checkRateLimit / recordFailure', () => {
  it('allows up to max failures, then blocks', () => {
    const key = 'login:1.2.3.4:user@example.com'

    for (let i = 0; i < LOGIN_RATE_LIMIT.max; i++) {
      expect(checkRateLimit(key).allowed).toBe(true)
      recordFailure(key)
    }

    const result = checkRateLimit(key)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('does not consume the counter on a plain check (non-consuming)', () => {
    const key = 'login:1.2.3.4:user@example.com'

    checkRateLimit(key)
    checkRateLimit(key)
    checkRateLimit(key)

    // Only recordFailure() increments — repeated checks alone never block.
    expect(checkRateLimit(key).allowed).toBe(true)
  })

  it('retryAfterSeconds decreases as time advances', () => {
    const key = 'login:1.2.3.4:user@example.com'

    for (let i = 0; i < LOGIN_RATE_LIMIT.max; i++) {
      recordFailure(key)
    }

    const first = checkRateLimit(key).retryAfterSeconds
    vi.advanceTimersByTime(60_000)
    const second = checkRateLimit(key).retryAfterSeconds

    expect(second).toBeLessThan(first)
  })

  it('re-allows once the window has expired', () => {
    const key = 'login:1.2.3.4:user@example.com'

    for (let i = 0; i < LOGIN_RATE_LIMIT.max; i++) {
      recordFailure(key)
    }
    expect(checkRateLimit(key).allowed).toBe(false)

    vi.advanceTimersByTime(LOGIN_RATE_LIMIT.windowMs + 1)

    expect(checkRateLimit(key).allowed).toBe(true)
  })

  it('treats an expired-window failure as a fresh window rather than continuing to accumulate', () => {
    const key = 'login:1.2.3.4:user@example.com'

    for (let i = 0; i < LOGIN_RATE_LIMIT.max; i++) {
      recordFailure(key)
    }
    vi.advanceTimersByTime(LOGIN_RATE_LIMIT.windowMs + 1)

    recordFailure(key)

    // Should be a fresh window with a single failure recorded, well under max.
    expect(checkRateLimit(key).allowed).toBe(true)
  })

  it('isolates buckets per key', () => {
    const keyA = 'login:1.2.3.4:userA@example.com'
    const keyB = 'login:5.6.7.8:userB@example.com'

    for (let i = 0; i < LOGIN_RATE_LIMIT.max; i++) {
      recordFailure(keyA)
    }

    expect(checkRateLimit(keyA).allowed).toBe(false)
    expect(checkRateLimit(keyB).allowed).toBe(true)
  })

  it('clearRateLimit resets a blocked key back to allowed', () => {
    const key = 'login:1.2.3.4:user@example.com'

    for (let i = 0; i < LOGIN_RATE_LIMIT.max; i++) {
      recordFailure(key)
    }
    expect(checkRateLimit(key).allowed).toBe(false)

    clearRateLimit(key)

    expect(checkRateLimit(key).allowed).toBe(true)
  })

  it('respects custom opts instead of the LOGIN_RATE_LIMIT default', () => {
    const key = 'custom-key'
    const opts = { max: 2, windowMs: 1_000 }

    recordFailure(key, opts)
    expect(checkRateLimit(key, opts).allowed).toBe(true)
    recordFailure(key, opts)
    expect(checkRateLimit(key, opts).allowed).toBe(false)

    vi.advanceTimersByTime(1_001)
    expect(checkRateLimit(key, opts).allowed).toBe(true)
  })
})
