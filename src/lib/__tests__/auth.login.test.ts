import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  getDataSource: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))
vi.mock('@node-rs/bcrypt', () => ({
  hash: vi.fn(),
  verify: vi.fn(),
}))

import { getDataSource } from '@/lib/db'
import { verify as bcryptVerify } from '@node-rs/bcrypt'
import { loginUser } from '@/lib/auth'

const mockGetDataSource = vi.mocked(getDataSource)
const mockBcryptVerify = vi.mocked(bcryptVerify)

const fakeUserRepo = { findOne: vi.fn() }

const FAKE_USER = {
  id: 1,
  email: 'user@example.com',
  name: 'Test User',
  role: 'qa',
  passwordHash: '$2y$12$knownUserHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  createdAt: new Date(),
  updatedAt: null,
}

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'test-secret-at-least-32-chars-long!!')
  mockGetDataSource.mockResolvedValue({
    getRepository: () => fakeUserRepo,
  } as any)
  fakeUserRepo.findOne.mockReset()
  mockBcryptVerify.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('loginUser', () => {
  it('returns null for an unknown email, still performing exactly one bcrypt verify against the dummy hash (timing equalization)', async () => {
    fakeUserRepo.findOne.mockResolvedValue(null)
    mockBcryptVerify.mockResolvedValue(false)

    const result = await loginUser('nobody@example.com', 'whatever-password')

    expect(result).toBeNull()
    expect(mockBcryptVerify).toHaveBeenCalledTimes(1)

    const [, hashArg] = mockBcryptVerify.mock.calls[0]
    expect(typeof hashArg).toBe('string')
    const hashStr = hashArg as string
    expect(hashStr.startsWith('$2')).toBe(true)
    expect(hashStr).not.toBe(FAKE_USER.passwordHash)
  })

  it('returns null for a known email with the wrong password, verifying against the user\'s own hash', async () => {
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)
    mockBcryptVerify.mockResolvedValue(false)

    const result = await loginUser(FAKE_USER.email, 'wrong-password')

    expect(result).toBeNull()
    expect(mockBcryptVerify).toHaveBeenCalledTimes(1)
    expect(mockBcryptVerify).toHaveBeenCalledWith('wrong-password', FAKE_USER.passwordHash)
  })

  it('returns the session-user shape for a known email with the correct password', async () => {
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)
    mockBcryptVerify.mockResolvedValue(true)

    const result = await loginUser(FAKE_USER.email, 'correct-password')

    expect(mockBcryptVerify).toHaveBeenCalledWith('correct-password', FAKE_USER.passwordHash)
    expect(result).toEqual({
      id: FAKE_USER.id,
      email: FAKE_USER.email,
      name: FAKE_USER.name,
      role: FAKE_USER.role,
    })
  })
})
