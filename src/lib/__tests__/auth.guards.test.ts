import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SignJWT } from 'jose'

vi.mock('@/lib/db', () => ({
  getDataSource: vi.fn(),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))
vi.mock('@/lib/apps', () => ({
  getApp: vi.fn(),
}))

import { getDataSource } from '@/lib/db'
import { cookies } from 'next/headers'
import { getApp } from '@/lib/apps'
import {
  requireAuth,
  requireAdmin,
  requireAppMember,
  requireAppPermission,
  getSession,
  guardApp,
  guardAppMember,
} from '@/lib/auth'

const SESSION_SECRET = 'test-secret-at-least-32-chars-long!!'
const COOKIE_NAME = 'sid'

const mockGetDataSource = vi.mocked(getDataSource)
const mockCookies = vi.mocked(cookies)
const mockGetApp = vi.mocked(getApp)

// ─── Fixtures ──────────────────────────────────────────────────────────────

const fakeSessionRepo = { findOne: vi.fn(), delete: vi.fn() }
const fakeUserRepo = { findOne: vi.fn() }
const fakeMembershipRepo = { findOne: vi.fn() }

const REPOS: Record<string, unknown> = {
  Session: fakeSessionRepo,
  User: fakeUserRepo,
  AppMembership: fakeMembershipRepo,
}

let currentCookieValue: string | undefined

function setCookie(value: string | undefined) {
  currentCookieValue = value
}

async function mintToken(sid: string, opts: { role?: string; userId?: string; expiresIn?: string; secret?: string } = {}) {
  const secretBytes = new TextEncoder().encode(opts.secret ?? SESSION_SECRET)
  return new SignJWT({ sid, role: opts.role ?? 'qa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(opts.userId ?? '1')
    .setExpirationTime(opts.expiresIn ?? '30d')
    .sign(secretBytes)
}

const FAKE_USER = { id: 1, email: 'user@example.com', name: 'Test User', role: 'qa', passwordHash: 'x', createdAt: new Date(), updatedAt: null }
const FAKE_ADMIN = { ...FAKE_USER, id: 2, role: 'admin' }

function validSessionRow(sid: string, overrides: Partial<{ userId: number; expiresAt: Date }> = {}) {
  return {
    id: sid,
    userId: overrides.userId ?? 1,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
    createdAt: new Date(),
  }
}

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', SESSION_SECRET)
  currentCookieValue = undefined
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === COOKIE_NAME && currentCookieValue ? { name, value: currentCookieValue } : undefined),
    set: vi.fn(),
  } as any)
  mockGetDataSource.mockResolvedValue({
    getRepository: (name: string) => REPOS[name],
  } as any)
  mockGetApp.mockResolvedValue({ slug: 'testapp', name: 'Test App' } as any)
  fakeSessionRepo.findOne.mockReset()
  fakeSessionRepo.delete.mockReset()
  fakeUserRepo.findOne.mockReset()
  fakeMembershipRepo.findOne.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

// ─── requireAuth ───────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('throws a 401 error when there is no session cookie', async () => {
    setCookie(undefined)
    await expect(requireAuth()).rejects.toMatchObject({ status: 401 })
  })
})

// ─── getSession ────────────────────────────────────────────────────────────

describe('getSession', () => {
  it('returns null for a garbage/tampered token', async () => {
    setCookie('this.is.not-a-valid-jwt')
    await expect(getSession()).resolves.toBeNull()
  })

  it('returns null for a token signed with the wrong secret (tampered)', async () => {
    const token = await mintToken('sid-1', { secret: 'a-completely-different-secret-value!!' })
    setCookie(token)
    await expect(getSession()).resolves.toBeNull()
  })

  it('returns null when the session row has expired', async () => {
    const token = await mintToken('sid-expired')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-expired', { expiresAt: new Date(Date.now() - 60_000) }))

    await expect(getSession()).resolves.toBeNull()
    expect(fakeSessionRepo.delete).toHaveBeenCalledWith('sid-expired')
  })

  it('throws a 503 error when the repo layer throws (DB failure must never look like 401/404)', async () => {
    const token = await mintToken('sid-db-down')
    setCookie(token)
    fakeSessionRepo.findOne.mockRejectedValue(new Error('connection reset'))

    await expect(getSession()).rejects.toMatchObject({ status: 503 })
  })

  it('returns the session user for a valid token + live session + existing user', async () => {
    const token = await mintToken('sid-ok')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-ok'))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)

    await expect(getSession()).resolves.toEqual({
      id: FAKE_USER.id,
      email: FAKE_USER.email,
      name: FAKE_USER.name,
      role: FAKE_USER.role,
    })
  })
})

// ─── requireAdmin ──────────────────────────────────────────────────────────

describe('requireAdmin', () => {
  it('throws a 403 error for a non-admin role', async () => {
    const token = await mintToken('sid-qa')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-qa'))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)

    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 })
  })

  it('returns the user when role is admin', async () => {
    const token = await mintToken('sid-admin', { userId: '2' })
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-admin', { userId: 2 }))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_ADMIN)

    await expect(requireAdmin()).resolves.toMatchObject({ role: 'admin' })
  })
})

// ─── requireAppMember ──────────────────────────────────────────────────────

describe('requireAppMember', () => {
  it('grants an admin all ALL_PERMISSIONS without checking membership', async () => {
    const token = await mintToken('sid-admin', { userId: '2' })
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-admin', { userId: 2 }))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_ADMIN)

    const access = await requireAppMember('testapp')
    expect(access.appRole).toBe('admin')
    expect(access.permissions.has('settings.edit')).toBe(true)
    expect(fakeMembershipRepo.findOne).not.toHaveBeenCalled()
  })

  it('throws a 404 error when there is no membership row (hides app existence)', async () => {
    const token = await mintToken('sid-qa')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-qa'))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)
    fakeMembershipRepo.findOne.mockResolvedValue(null)

    await expect(requireAppMember('testapp')).rejects.toMatchObject({ status: 404 })
  })

  it('resolves permissions via resolvePermissions() for an existing membership', async () => {
    const token = await mintToken('sid-qa')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-qa'))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)
    fakeMembershipRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      appSlug: 'testapp',
      role: 'developer',
      permissions: null,
      createdAt: new Date(),
    })

    const access = await requireAppMember('testapp')
    expect(access.appRole).toBe('developer')
    expect(access.permissions.has('bugs.view')).toBe(true)
    expect(access.permissions.has('settings.edit')).toBe(false)
  })
})

// ─── requireAppPermission ──────────────────────────────────────────────────

describe('requireAppPermission', () => {
  it('throws a 403 error when the member lacks the permission', async () => {
    const token = await mintToken('sid-custom')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-custom'))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)
    fakeMembershipRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      appSlug: 'testapp',
      role: 'custom',
      permissions: JSON.stringify(['bugs.view']),
      createdAt: new Date(),
    })

    await expect(requireAppPermission('testapp', 'bugs.edit')).rejects.toMatchObject({ status: 403 })
  })

  it('grants access when the member has the permission', async () => {
    const token = await mintToken('sid-custom')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-custom'))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)
    fakeMembershipRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      appSlug: 'testapp',
      role: 'custom',
      permissions: JSON.stringify(['bugs.view']),
      createdAt: new Date(),
    })

    const access = await requireAppPermission('testapp', 'bugs.view')
    expect(access.permissions.has('bugs.view')).toBe(true)
  })
})

// ─── guardApp / guardAppMember ─────────────────────────────────────────────

describe('guardApp / guardAppMember', () => {
  it('guardApp: returns ok:false with the thrown status and body {error: "Not found"} when auth throws', async () => {
    setCookie(undefined) // no session -> requireAuth() throws 401

    const result = await guardApp('testapp', 'bugs.view')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toEqual({ error: 'Not found' })
    }
  })

  it('guardApp: returns 404 {error: "App not found"} when getApp resolves to undefined', async () => {
    const token = await mintToken('sid-qa')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-qa'))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)
    fakeMembershipRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      appSlug: 'testapp',
      role: 'qa',
      permissions: null,
      createdAt: new Date(),
    })
    mockGetApp.mockResolvedValue(undefined)

    const result = await guardApp('testapp', 'bugs.view')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(404)
      await expect(result.response.json()).resolves.toEqual({ error: 'App not found' })
    }
  })

  it('guardApp: happy path returns {ok: true, access}', async () => {
    const token = await mintToken('sid-qa')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-qa'))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)
    fakeMembershipRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      appSlug: 'testapp',
      role: 'qa',
      permissions: null,
      createdAt: new Date(),
    })

    const result = await guardApp('testapp', 'bugs.view')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.access.appRole).toBe('qa')
      expect(result.access.permissions.has('bugs.view')).toBe(true)
    }
  })

  it('guardAppMember: happy path returns {ok: true, access} without a specific permission check', async () => {
    const token = await mintToken('sid-qa')
    setCookie(token)
    fakeSessionRepo.findOne.mockResolvedValue(validSessionRow('sid-qa'))
    fakeUserRepo.findOne.mockResolvedValue(FAKE_USER)
    fakeMembershipRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      appSlug: 'testapp',
      role: 'developer',
      permissions: null,
      createdAt: new Date(),
    })

    const result = await guardAppMember('testapp')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.access.appRole).toBe('developer')
    }
  })
})
