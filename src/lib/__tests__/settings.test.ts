import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  getDataSource: vi.fn(),
}))

import { getDataSource } from '@/lib/db'
import {
  isSecretKey,
  maskSecretValue,
  getSetting,
  setSetting,
  getSettingsForScope,
  APP_DEFAULTS,
} from '@/lib/settings'
import { isEncrypted, encryptSecret, __resetKeyCache } from '@/lib/secret-crypto'

const mockGetDataSource = vi.mocked(getDataSource)

// A stable 32-byte key (hex) for tests exercising real encrypt/decrypt.
const KEY_HEX = 'a'.repeat(64)

beforeEach(() => {
  __resetKeyCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  __resetKeyCache()
})

/** Minimal fake repo backed by an in-memory row list, matching the shape settings.ts uses. */
function makeFakeRepo(initialRows: Array<{ scope: string; key: string; value: string }> = []) {
  const rows = initialRows.map((r) => ({ ...r }))
  return {
    rows,
    findOne: vi.fn(async ({ where }: { where: { scope: string; key: string } }) => {
      return rows.find((r) => r.scope === where.scope && r.key === where.key) ?? null
    }),
    find: vi.fn(async ({ where }: { where: { scope: string } }) => {
      return rows.filter((r) => r.scope === where.scope)
    }),
    save: vi.fn(async (row: { scope: string; key: string; value: string }) => {
      const existing = rows.find((r) => r.scope === row.scope && r.key === row.key)
      if (existing) {
        Object.assign(existing, row)
        return existing
      }
      rows.push({ ...row })
      return row
    }),
  }
}

describe('isSecretKey', () => {
  it('is true for keys ending in the recognized secret suffixes', () => {
    expect(isSecretKey('GEMINI_API_KEY')).toBe(true)
    expect(isSecretKey('JIRA_API_TOKEN')).toBe(true)
    expect(isSecretKey('JIRA_PAT')).toBe(true)
    expect(isSecretKey('DB_SECRET')).toBe(true)
    expect(isSecretKey('ADMIN_PASSWORD')).toBe(true)
  })

  it('is true for the AI_PROVIDER_KEY_ prefix', () => {
    expect(isSecretKey('AI_PROVIDER_KEY_CUSTOM_PROVIDER')).toBe(true)
  })

  it('is false for JIRA_PROJECT_KEY (bare _KEY, not _API_KEY)', () => {
    expect(isSecretKey('JIRA_PROJECT_KEY')).toBe(false)
  })

  it('is false for JIRA_BOARD_ID', () => {
    expect(isSecretKey('JIRA_BOARD_ID')).toBe(false)
  })
})

describe('maskSecretValue', () => {
  it('returns an empty string for an empty value', () => {
    expect(maskSecretValue('')).toBe('')
  })

  it('masks a short value (<=8 chars) with just the mask prefix', () => {
    expect(maskSecretValue('abcd1234')).toBe('••••')
  })

  it('masks a long value with the prefix plus the last 4 characters', () => {
    expect(maskSecretValue('sk-abcdefghij1234')).toBe('••••1234')
  })
})

describe('getSetting DB-down fallback', () => {
  it('falls back to process.env when the DB is unavailable', async () => {
    mockGetDataSource.mockRejectedValue(new Error('connection refused'))
    vi.stubEnv('GEMINI_API_KEY', 'env-value-123')

    const result = await getSetting('global', 'GEMINI_API_KEY')
    expect(result).toBe('env-value-123')
  })

  it('falls back to APP_DEFAULTS when the DB is unavailable and no env var is set', async () => {
    mockGetDataSource.mockRejectedValue(new Error('connection refused'))
    // testerName has an APP_DEFAULTS entry and is not read from process.env.
    const result = await getSetting('some-app', 'testerName')
    expect(result).toBe(APP_DEFAULTS.testerName)
  })

  it('falls back to null when the DB is unavailable, no env var, and no default', async () => {
    mockGetDataSource.mockRejectedValue(new Error('connection refused'))
    vi.stubEnv('SOME_UNKNOWN_KEY', '')
    delete process.env.SOME_UNKNOWN_KEY

    const result = await getSetting('global', 'SOME_UNKNOWN_KEY')
    expect(result).toBeNull()
  })
})

describe('getSetting with encrypted rows', () => {
  it('returns the decrypted value for an enc:v1: row', async () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const encrypted = encryptSecret('super-secret-token')
    const repo = makeFakeRepo([{ scope: 'global', key: 'JIRA_API_TOKEN', value: encrypted }])
    mockGetDataSource.mockResolvedValue({ getRepository: () => repo } as never)

    const result = await getSetting('global', 'JIRA_API_TOKEN')
    expect(result).toBe('super-secret-token')
  })

  it('returns a plaintext row value unchanged', async () => {
    const repo = makeFakeRepo([{ scope: 'global', key: 'JIRA_BASE_URL', value: 'https://example.atlassian.net' }])
    mockGetDataSource.mockResolvedValue({ getRepository: () => repo } as never)

    const result = await getSetting('global', 'JIRA_BASE_URL')
    expect(result).toBe('https://example.atlassian.net')
  })

  it('falls through to env when the row is encrypted but the key is missing', async () => {
    // Encrypt while a key is configured, then simulate the key having disappeared.
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const encrypted = encryptSecret('super-secret-token')
    __resetKeyCache()
    vi.unstubAllEnvs()
    vi.stubEnv('GEMINI_API_KEY', 'fallback-env-value')

    const repo = makeFakeRepo([{ scope: 'global', key: 'GEMINI_API_KEY', value: encrypted }])
    mockGetDataSource.mockResolvedValue({ getRepository: () => repo } as never)

    const result = await getSetting('global', 'GEMINI_API_KEY')
    expect(result).toBe('fallback-env-value')
  })
})

describe('setSetting encryption', () => {
  it('encrypts values for secret keys before saving', async () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const repo = makeFakeRepo()
    mockGetDataSource.mockResolvedValue({ getRepository: () => repo } as never)

    await setSetting('global', 'JIRA_API_TOKEN', 'raw-token-value')

    expect(repo.save).toHaveBeenCalled()
    const saved = repo.rows.find((r) => r.key === 'JIRA_API_TOKEN')
    expect(saved).toBeDefined()
    expect(isEncrypted(saved!.value)).toBe(true)
    expect(saved!.value).not.toBe('raw-token-value')
  })

  it('stores non-secret keys as plaintext', async () => {
    const repo = makeFakeRepo()
    mockGetDataSource.mockResolvedValue({ getRepository: () => repo } as never)

    await setSetting('global', 'JIRA_BASE_URL', 'https://example.atlassian.net')

    const saved = repo.rows.find((r) => r.key === 'JIRA_BASE_URL')
    expect(saved!.value).toBe('https://example.atlassian.net')
  })

  it('stores an empty string unencrypted even for secret keys', async () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const repo = makeFakeRepo()
    mockGetDataSource.mockResolvedValue({ getRepository: () => repo } as never)

    await setSetting('global', 'JIRA_API_TOKEN', '')

    const saved = repo.rows.find((r) => r.key === 'JIRA_API_TOKEN')
    expect(saved!.value).toBe('')
  })
})

describe('getSettingsForScope with encrypted rows', () => {
  it('decrypts secret rows in the overlay', async () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const encrypted = encryptSecret('overlay-secret')
    const repo = makeFakeRepo([{ scope: 'global', key: 'JIRA_API_TOKEN', value: encrypted }])
    mockGetDataSource.mockResolvedValue({ getRepository: () => repo } as never)

    const result = await getSettingsForScope('global')
    expect(result.JIRA_API_TOKEN).toBe('overlay-secret')
  })

  it('keeps the env baseline when a secret row fails to decrypt', async () => {
    vi.stubEnv('APP_ENCRYPTION_KEY', KEY_HEX)
    const encrypted = encryptSecret('overlay-secret')
    // Key disappears before getSettingsForScope runs — decryption of the non-empty
    // stored value fails, so the overlay must not clobber the env baseline.
    __resetKeyCache()
    vi.unstubAllEnvs()
    vi.stubEnv('JIRA_API_TOKEN', 'env-baseline-token')

    const repo = makeFakeRepo([{ scope: 'global', key: 'JIRA_API_TOKEN', value: encrypted }])
    mockGetDataSource.mockResolvedValue({ getRepository: () => repo } as never)

    const result = await getSettingsForScope('global')
    expect(result.JIRA_API_TOKEN).toBe('env-baseline-token')
  })
})
