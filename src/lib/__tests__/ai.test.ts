import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  stripFences,
  parseJsonResponse,
  isRetryableError,
  withRetry,
  makeBugReportValidator,
  getModelsWithStatus,
} from '@/lib/ai'
import type { GeneratedBugReport } from '@/lib/ai'
import type { BugVariantConfig } from '@/lib/bug-format'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('stripFences', () => {
  it('strips a fenced block with no language tag', () => {
    expect(stripFences('```\nhello world\n```')).toBe('hello world')
  })

  it('strips an unfenced string unchanged (aside from trimming)', () => {
    expect(stripFences('  hello world  ')).toBe('hello world')
  })

  it('strips a ```markdown-tagged code block', () => {
    expect(stripFences('```markdown\n# Heading\n\ncontent\n```')).toBe('# Heading\n\ncontent')
  })
})

describe('parseJsonResponse', () => {
  it('parses plain JSON', () => {
    expect(parseJsonResponse<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in a ```json fence', () => {
    const text = '```json\n{"a":1}\n```'
    expect(parseJsonResponse<{ a: number }>(text)).toEqual({ a: 1 })
  })

  it('throws on prose-prefixed fenced JSON — the strip regex only matches a fence at the very start of the string', () => {
    // Deviation note: parseJsonResponse only strips a fence anchored to the start
    // (^```...) and the end (...```$). Text with prose *before* the opening fence
    // is NOT unwrapped, so JSON.parse receives the leftover prose + fence marker
    // and throws. This is the actual implementation behavior, not an assumption.
    const text = 'Here is the JSON:\n```json\n{"a":1}\n```'
    expect(() => parseJsonResponse(text)).toThrow()
  })

  it('throws on garbage input', () => {
    expect(() => parseJsonResponse('not json at all')).toThrow()
  })
})

describe('isRetryableError', () => {
  it('is true for a 429-style message', () => {
    expect(isRetryableError(new Error('Request failed with status 429'))).toBe(true)
  })

  it('is true for a 500-style message', () => {
    expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true)
  })

  it('is true for a 529-style "overloaded" message (the numeric regex only covers 429/500/502/503/504, so this matches via the "overloaded" phrase, not the "529" digits)', () => {
    expect(isRetryableError(new Error('529 {"type":"overloaded_error","message":"Overloaded"}'))).toBe(true)
  })

  it('is false for a 400-style message', () => {
    expect(isRetryableError(new Error('400 Bad Request'))).toBe(false)
  })

  it('is true for common network-transient phrasings', () => {
    expect(isRetryableError(new Error('fetch failed'))).toBe(true)
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true)
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true)
  })
})

describe('withRetry', () => {
  it('succeeds after one transient retryable failure', async () => {
    vi.useFakeTimers()
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(fn, 3, 10)
    await vi.advanceTimersByTimeAsync(2000)

    await expect(promise).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('rethrows the last error after exhausting all retry attempts', async () => {
    vi.useFakeTimers()
    const err = new Error('500 Internal Server Error')
    const fn = vi.fn().mockRejectedValue(err)

    const promise = withRetry(fn, 2, 10)
    const assertion = expect(promise).rejects.toThrow('500 Internal Server Error')
    await vi.advanceTimersByTimeAsync(2000)
    await assertion

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws a non-retryable error immediately, without retrying', async () => {
    const err = new Error('400 Bad Request')
    const fn = vi.fn().mockRejectedValue(err)

    await expect(withRetry(fn, 3, 1000)).rejects.toThrow('400 Bad Request')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('makeBugReportValidator', () => {
  const minimalVariant: BugVariantConfig = {
    fields: { environment: false, priority: false, bugType: false, severity: false },
    jiraLabels: [],
    jiraFieldSyncs: {},
  }

  const validBody = [
    'Summary of the bug.',
    '**Steps to Reproduce:**',
    '1. Do the thing.',
    '**Expected Result:**',
    'Nothing breaks.',
    '**Actual Result:**',
    'It breaks.',
  ].join('\n')

  it('passes for a minimal valid report matching a minimal BugVariantConfig', () => {
    const validate = makeBugReportValidator(minimalVariant)
    const report: GeneratedBugReport = {
      title: 'Save button stays disabled after all fields are filled',
      feature: 'orders',
      priority: '',
      bug_type: '',
      body: validBody,
      layer: 'frontend',
    }
    expect(validate(report)).toBe(true)
  })

  it('returns false (not a throw) when a required typed field is missing — the implementation treats this as a shape mismatch', () => {
    // Deviation note: makeBugReportValidator's type guard returns false (rather
    // than throwing) when the basic shape check (title/feature/body as strings)
    // fails. It only *throws* for the richer checks below (missing body sections,
    // non-sentence title) once the basic shape already passed.
    const validate = makeBugReportValidator(minimalVariant)
    const report = { feature: 'orders', body: validBody } // title missing
    expect(validate(report)).toBe(false)
  })

  it('throws when the body is missing a section required by the enabled fields', () => {
    const vcWithPriority: BugVariantConfig = {
      fields: { environment: false, priority: true, bugType: false, severity: false },
      jiraLabels: [],
      jiraFieldSyncs: {},
    }
    const validate = makeBugReportValidator(vcWithPriority)
    const report = {
      title: 'Save button stays disabled after all fields are filled',
      feature: 'orders',
      priority: 'P2 – High',
      body: 'Summary only, no structured sections here.',
    }
    expect(() => validate(report)).toThrow(/missing required section/i)
  })

  it('throws when the title is a kebab-case/single-word slug instead of a sentence', () => {
    const validate = makeBugReportValidator(minimalVariant)
    const report = {
      title: 'save-button-disabled-bug',
      feature: 'orders',
      body: validBody,
    }
    expect(() => validate(report)).toThrow(/natural language sentence/i)
  })
})

describe('getModelsWithStatus', () => {
  it('marks a model enabled when its required env key is present', () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key-value')
    const models = getModelsWithStatus()
    const gemini = models.find((m) => m.id === 'gemini-2.5-flash')
    expect(gemini?.enabled).toBe(true)
    expect(gemini?.disabledReason).toBeUndefined()
  })

  it('marks a model disabled when its required env key is absent', () => {
    vi.stubEnv('GROQ_API_KEY', '')
    const models = getModelsWithStatus()
    const groqModel = models.find((m) => m.id === 'llama-3.3-70b-versatile')
    expect(groqModel?.enabled).toBe(false)
    expect(groqModel?.disabledReason).toContain('GROQ_API_KEY')
  })
})
