import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { hash, verify as bcryptVerify } from '@node-rs/bcrypt'
import { randomUUID, randomBytes } from 'crypto'
import { getDataSource } from './db'
import { getApp } from './apps'
import type { IUser, ISession, IAppMembership } from './entities'
import { ALL_PERMISSIONS, type PermissionKey } from './permissions'
import { resolveAppPermissions } from './role-permissions-server'

const COOKIE_NAME = 'sid'
const SESSION_DAYS = 30
const BCRYPT_ROUNDS = 12

// Precomputed bcrypt hash of an arbitrary password (12 rounds, matching
// BCRYPT_ROUNDS), generated once via:
//   node -e "require('@node-rs/bcrypt').hash('timing-equalizer', 12).then(console.log)"
// Used so the unknown-email path in loginUser pays the same bcrypt-verify
// cost as the known-email path, closing a user-enumeration timing oracle
// (an unknown email would otherwise return near-instantly, while a known
// email always takes as long as a bcrypt compare).
const DUMMY_PASSWORD_HASH = '$2y$12$Q3F1iWsj6WHsV7gtjmkN3.HZn9G/DKg1uID0U3zg/F23prQiSF5Am'

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

// Generates a strong random password (>=16 chars) suitable for admin-created
// accounts. Uses crypto.randomBytes (never Math.random) for CSPRNG output,
// base64url-encoded, with visually-ambiguous characters (0/O, 1/l/I, -/_)
// stripped so the result is easy to transcribe.
export function generatePassword(): string {
  const AMBIGUOUS = /[0O1lI\-_]/g
  let password = ''
  while (password.length < 20) {
    password += randomBytes(24).toString('base64url').replace(AMBIGUOUS, '')
  }
  return password.slice(0, 20)
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
  if (!user || user.deletedAt) return null

  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

// Returns the user if credentials are valid, null otherwise
export async function loginUser(email: string, password: string): Promise<SessionUser | null> {
  const ds = await getDataSource()
  const user = await ds.getRepository<IUser>('User').findOne({ where: { email } })
  if (!user) {
    // Pay the same bcrypt-verify cost as the known-email path below, so
    // response timing doesn't reveal whether the email exists.
    await verifyPassword(password, DUMMY_PASSWORD_HASH)
    return null
  }
  const valid = await verifyPassword(password, user.passwordHash)
  // Retired users must be rejected exactly like an invalid password: the
  // bcrypt verify above already ran (regardless of deletedAt), so this
  // check adds no timing signal that would distinguish a retired account
  // from a wrong-password attempt on an active one.
  if (!valid || user.deletedAt) return null
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
    permissions: await resolveAppPermissions(membership.role, membership.permissions),
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
    if (!(await getApp(appSlug))) {
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
