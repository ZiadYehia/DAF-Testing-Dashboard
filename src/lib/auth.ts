import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { hash, verify as bcryptVerify } from '@node-rs/bcrypt'
import { randomUUID } from 'crypto'
import { getDataSource } from './db'
import { getApp } from './apps'
import type { IUser, ISession, IAppMembership } from './entities'
import { resolvePermissions, ALL_PERMISSIONS, type PermissionKey } from './permissions'

const COOKIE_NAME = 'sid'
const SESSION_DAYS = 30
const BCRYPT_ROUNDS = 12

// DB failures inside auth must surface as 503, never be conflated with a 401/404 auth failure.
function dbUnavailable(err: unknown) {
  return Object.assign(new Error('DB_UNAVAILABLE', { cause: err }), { status: 503 })
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET env var is not set')
  return new TextEncoder().encode(secret)
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcryptVerify(password, passwordHash)
}

export type SessionUser = Pick<IUser, 'id' | 'email' | 'name' | 'role'>

export async function createSession(userId: number, role: string): Promise<void> {
  const ds = await getDataSource()
  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await ds.getRepository<ISession>('Session').insert({ id: sessionId, userId, expiresAt })

  const token = await new SignJWT({ sid: sessionId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  })
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return

  try {
    const { payload } = await jwtVerify(token, getSecret())
    const sid = payload.sid as string | undefined
    if (sid) {
      const ds = await getDataSource()
      await ds.getRepository<ISession>('Session').delete(sid)
    }
  } catch { /* expired or tampered — still clear cookie */ }

  cookieStore.set(COOKIE_NAME, '', { maxAge: 0 })
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  let sid: string
  try {
    const { payload } = await jwtVerify(token, getSecret())
    sid = payload.sid as string
    if (!sid) return null
  } catch {
    return null
  }

  let session: ISession | null
  let user: IUser | null
  try {
    const ds = await getDataSource()
    session = await ds.getRepository<ISession>('Session').findOne({ where: { id: sid } })
    if (!session || session.expiresAt < new Date()) {
      if (session) await ds.getRepository<ISession>('Session').delete(sid)
      return null
    }

    user = await ds.getRepository<IUser>('User').findOne({ where: { id: session.userId } })
  } catch (err) {
    throw dbUnavailable(err)
  }
  if (!user) return null

  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

// Returns the user if credentials are valid, null otherwise
export async function loginUser(email: string, password: string): Promise<SessionUser | null> {
  const ds = await getDataSource()
  const user = await ds.getRepository<IUser>('User').findOne({ where: { email } })
  if (!user) return null
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null
  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

// Throws { status: 401 } if not logged in
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw Object.assign(new Error('UNAUTHENTICATED'), { status: 401 })
  return user
}

// Throws { status: 403 } if not a global admin
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') throw Object.assign(new Error('FORBIDDEN'), { status: 403 })
  return user
}

export type AppAccess = { user: SessionUser; appRole: string; permissions: Set<PermissionKey> }

// Throws 401 if not logged in, { status: 404 } if no membership (hides app existence). Admin bypasses with full permissions.
export async function requireAppMember(appSlug: string): Promise<AppAccess> {
  const user = await requireAuth()

  if (user.role === 'admin') {
    return { user, appRole: 'admin', permissions: new Set(ALL_PERMISSIONS) }
  }

  let membership: IAppMembership | null
  try {
    const ds = await getDataSource()
    membership = await ds.getRepository<IAppMembership>('AppMembership').findOne({
      where: { userId: user.id, appSlug },
    })
  } catch (err) {
    throw dbUnavailable(err)
  }

  if (!membership) throw Object.assign(new Error('NOT_FOUND'), { status: 404 })

  return {
    user,
    appRole: membership.role,
    permissions: resolvePermissions(membership.role, membership.permissions),
  }
}

// Same as requireAppMember, plus throws { status: 403 } if the membership lacks the given permission.
export async function requireAppPermission(appSlug: string, permission: PermissionKey): Promise<AppAccess> {
  const access = await requireAppMember(appSlug)
  if (!access.permissions.has(permission)) {
    throw Object.assign(new Error('FORBIDDEN'), { status: 403 })
  }
  return access
}

export type AppGuardResult =
  | { ok: true; access: AppAccess }
  | { ok: false; response: NextResponse }

// Shared body for the guardApp/guardAppMember route-handler helpers below: run the
// given access check, then confirm the app itself still exists (getApp), reproducing
// the try/requireApp*/catch/getApp block that used to be copy-pasted at the top of
// nearly every /api/[app]/** handler. Preserves that block's exact response shapes:
// { error: 'Not found' } with the thrown error's status (defaulting to 404) on auth
// failure, { error: 'App not found' } with 404 when the app slug doesn't resolve.
async function guardAppWith(appSlug: string, check: () => Promise<AppAccess>): Promise<AppGuardResult> {
  try {
    const access = await check()
    if (!getApp(appSlug)) {
      return { ok: false, response: NextResponse.json({ error: 'App not found' }, { status: 404 }) }
    }
    return { ok: true, access }
  } catch (err: any) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: err.status ?? 404 }) }
  }
}

// Route-handler guard: requireAppPermission + getApp existence check, collapsed into
// one call. Use as: const guard = await guardApp(app, 'bugs.view'); if (!guard.ok) return guard.response
export function guardApp(appSlug: string, permission: PermissionKey): Promise<AppGuardResult> {
  return guardAppWith(appSlug, () => requireAppPermission(appSlug, permission))
}

// Same as guardApp, but for sites that only need membership (requireAppMember), not a specific permission.
export function guardAppMember(appSlug: string): Promise<AppGuardResult> {
  return guardAppWith(appSlug, () => requireAppMember(appSlug))
}
