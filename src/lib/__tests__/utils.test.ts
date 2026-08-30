import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { slugify, capitalize, titleCase, formatDate, formatDateTime } from '@/lib/utils'

// Note: src/lib/utils.ts also exports `cn` (a clsx/tailwind-merge wrapper) — not
// covered here since it's a trivial passthrough of two well-tested third-party
// libraries and wasn't part of the requested coverage list.

// formatDate/formatDateTime use toLocaleDateString with no explicit timeZone, so
// they render in the host's local zone. Pin TZ=UTC for the duration of this file
// so the fixed-ISO-string assertions are deterministic regardless of the machine
// running the suite.
let previousTz: string | undefined
beforeAll(() => {
  previousTz = process.env.TZ
  process.env.TZ = 'UTC'
})
afterAll(() => {
  process.env.TZ = previousTz
})

describe('slugify', () => {
  it('lowercases and hyphenates non-alphanumeric runs', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('collapses consecutive non-alphanumeric characters into one hyphen', () => {
    expect(slugify('Order   Create!!  Flow')).toBe('order-create-flow')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --Leading and Trailing--  ')).toBe('leading-and-trailing')
  })
})

describe('capitalize', () => {
  it('uppercases the first character only', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('leaves an already-capitalized string unchanged', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })

  it('returns an empty string unchanged', () => {
    expect(capitalize('')).toBe('')
  })
})

describe('titleCase', () => {
  it('replaces hyphens with spaces and capitalizes each word', () => {
    expect(titleCase('order-create-flow')).toBe('Order Create Flow')
  })

  it('capitalizes each word in a space-separated string', () => {
    expect(titleCase('already spaced words')).toBe('Already Spaced Words')
  })
})

describe('formatDate', () => {
  it('returns an em dash for null input', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('formats a fixed ISO string as "Mon D, YYYY"', () => {
    expect(formatDate('2026-03-05T00:00:00.000Z')).toBe('Mar 5, 2026')
  })
})

describe('formatDateTime', () => {
  it('returns an em dash for null input', () => {
    expect(formatDateTime(null)).toBe('—')
  })

  it('formats a fixed ISO string including hour/minute', () => {
    const result = formatDateTime('2026-03-05T15:30:00.000Z')
    // Exact hour depends on the runner's local timezone (toLocaleDateString uses
    // the local zone), so assert on the date portion and the presence of a time.
    expect(result).toMatch(/^Mar 5, 2026, \d{1,2}:\d{2}\s?(AM|PM)$/)
  })
})
