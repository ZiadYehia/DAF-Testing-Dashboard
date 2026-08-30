import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  getDataSource: vi.fn(),
}))

import { getDataSource } from '@/lib/db'
import { getJiraAuth } from '@/lib/jira'
import { __resetKeyCache } from '@/lib/secret-crypto'

const mockGetDataSource = vi.mocked(getDataSource)

beforeEach(() => {
  __resetKeyCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  __resetKeyCache()
})

/** Minimal fake repo backed by an in-memory row list, matching settings.ts's usage
 *  (same shape as the helper in settings.test.ts). Rows are stored plaintext —
 *  decryptSecret passes plaintext values through unchanged, so no encryption
 *  setup is needed to exercise getJiraAuth's resolution logic. */
function makeFakeRepo(rows: Array<{ scope: string; key: string; value: string }>) {
  return {
    findOne: vi.fn(async ({ where }: { where: { scope: string; key: string } }) => {
      return rows.find((r) => r.scope === where.scope && r.key === where.key) ?? null
    }),
  }
}

function mockRows(rows: Array<{ scope: string; key: string; value: string }>) {
  const repo = makeFakeRepo(rows)
  mockGetDataSource.mockResolvedValue({ getRepository: () => repo } as never)
}

describe('getJiraAuth — per-user Jira credential resolution (no global fallback)', () => {
  it('resolves the user\'s own credentials when both JIRA_EMAIL and JIRA_API_TOKEN are set for that user', async () => {
    mockRows([
      { scope: 'user:3', key: 'JIRA_EMAIL', value: 'alice@example.com' },
      { scope: 'user:3', key: 'JIRA_API_TOKEN', value: 'alice-token' },
    ])

    const auth = await getJiraAuth(3)
    expect(auth).toBe(`Basic ${Buffer.from('alice@example.com:alice-token').toString('base64')}`)
  })

  it('resolves a different user\'s own credentials independently (no cross-user bleed)', async () => {
    mockRows([
      { scope: 'user:3', key: 'JIRA_EMAIL', value: 'alice@example.com' },
      { scope: 'user:3', key: 'JIRA_API_TOKEN', value: 'alice-token' },
      { scope: 'user:7', key: 'JIRA_EMAIL', value: 'bob@example.com' },
      { scope: 'user:7', key: 'JIRA_API_TOKEN', value: 'bob-token' },
    ])

    const auth = await getJiraAuth(7)
    expect(auth).toBe(`Basic ${Buffer.from('bob@example.com:bob-token').toString('base64')}`)
  })

  it('throws when the user has only email set (partial config is rejected, not half-applied)', async () => {
    mockRows([
      { scope: 'user:3', key: 'JIRA_EMAIL', value: 'alice@example.com' },
      // No JIRA_API_TOKEN row for user:3 — config is incomplete.
    ])

    await expect(getJiraAuth(3)).rejects.toThrow('Jira account not configured')
  })

  it('throws when the user has only apiToken set (partial config is rejected, not half-applied)', async () => {
    mockRows([
      { scope: 'user:3', key: 'JIRA_API_TOKEN', value: 'alice-token' },
      // No JIRA_EMAIL row for user:3 — config is incomplete.
    ])

    await expect(getJiraAuth(3)).rejects.toThrow('Jira account not configured')
  })

  it('throws when the user has no Jira config at all, even if a global config exists (no identity fallback)', async () => {
    mockRows([
      { scope: 'global', key: 'JIRA_EMAIL', value: 'global@example.com' },
      { scope: 'global', key: 'JIRA_API_TOKEN', value: 'global-token' },
      { scope: 'global', key: 'JIRA_PAT', value: 'global-pat' },
    ])

    await expect(getJiraAuth(42)).rejects.toThrow('Jira account not configured')
  })

  it('throws when neither the user nor anyone else has any Jira config', async () => {
    mockRows([])

    await expect(getJiraAuth(3)).rejects.toThrow('Jira account not configured')
  })
})
