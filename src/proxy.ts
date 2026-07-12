import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

interface SessionPayload {
  sid: string
  role: string
}

// Fast, non-authoritative check: JWT signature + shape only, no DB session lookup.
// Server layouts/route handlers remain the authoritative gate.
async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  const secret = process.env.SESSION_SECRET
  if (!secret) return null // fail closed if misconfigured, without crashing
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const session = await verifySession(request.cookies.get('sid')?.value)

  if (!session && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (pathname.startsWith('/admin') && session?.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
