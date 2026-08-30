import { describe, it, expect } from 'vitest'
import { isDbConnectionError, withDbRetry } from '../db'

function connError(code?: string, message = 'Connection is closed.') {
  const err = new Error(message) as Error & { code?: string }
  if (code) err.code = code
  return err
}

describe('isDbConnectionError', () => {
  it('matches known driver codes', () => {
    for (const code of ['ENOTOPEN', 'ECONNCLOSED', 'ESOCKET', 'ECONNRESET', 'ETIMEOUT']) {
      expect(isDbConnectionError(connError(code, 'whatever'))).toBe(true)
    }
  })

  it('matches connection-state messages without a code', () => {
    expect(isDbConnectionError(connError(undefined, 'Connection not yet open.'))).toBe(true)
    expect(isDbConnectionError(connError(undefined, 'Connection is closing'))).toBe(true)
    expect(isDbConnectionError(connError(undefined, 'Connection is closed.'))).toBe(true)
  })

  it('matches wrapped QueryFailedError via driverError', () => {
    const wrapped = new Error('query failed') as Error & { driverError?: unknown }
    wrapped.driverError = connError('ENOTOPEN', 'Connection not yet open.')
    expect(isDbConnectionError(wrapped)).toBe(true)
  })

  it('rejects ordinary SQL errors and non-errors', () => {
    expect(isDbConnectionError(new Error("Invalid column name 'foo'"))).toBe(false)
    expect(isDbConnectionError(null)).toBe(false)
    expect(isDbConnectionError('Connection is closed.')).toBe(false)
  })
})

describe('withDbRetry', () => {
  it('returns the first result when the call succeeds', async () => {
    let calls = 0
    const result = await withDbRetry(async () => {
      calls++
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(1)
  })

  it('retries once on a connection error', async () => {
    let calls = 0
    const result = await withDbRetry(async () => {
      calls++
      if (calls === 1) throw connError('ENOTOPEN', 'Connection not yet open.')
      return 'recovered'
    })
    expect(result).toBe('recovered')
    expect(calls).toBe(2)
  })

  it('does not retry non-connection errors', async () => {
    let calls = 0
    await expect(
      withDbRetry(async () => {
        calls++
        throw new Error('constraint violation')
      })
    ).rejects.toThrow('constraint violation')
    expect(calls).toBe(1)
  })

  it('rethrows when the retry also fails', async () => {
    let calls = 0
    await expect(
      withDbRetry(async () => {
        calls++
        throw connError('ECONNCLOSED')
      })
    ).rejects.toThrow('Connection is closed.')
    expect(calls).toBe(2)
  })
})
