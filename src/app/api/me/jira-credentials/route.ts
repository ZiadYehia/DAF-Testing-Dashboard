import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getSetting, setSetting, maskSecretValue, MASK_PREFIX } from '@/lib/settings'

export const runtime = 'nodejs'

/**
 * Per-user Jira credentials (settings scope `user:<id>`, keys JIRA_EMAIL +
 * JIRA_API_TOKEN). When both are set for the signed-in user, bug reporting
 * and the board's "Reported by me" filter resolve against that user's own
 * Jira account instead of the global Jira config — see getJiraAuth in
 * src/lib/jira.ts for the resolution rule (partial config is ignored).
 */

const JIRA_FETCH_TIMEOUT_MS = 15_000

export async function GET() {
  let userId: number
  try {
    userId = (await requireAuth()).id
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: 'Not authenticated' }, { status })
  }

  const scope = `user:${userId}`
  const [email, apiToken] = await Promise.all([
    getSetting(scope, 'JIRA_EMAIL'),
    getSetting(scope, 'JIRA_API_TOKEN'),
  ])
  const emailValue = email ?? ''
  const tokenValue = apiToken ?? ''

  return NextResponse.json({
    email: emailValue,
    apiToken: maskSecretValue(tokenValue),
    configured: Boolean(emailValue && tokenValue),
  })
}

export async function PUT(req: NextRequest) {
  let userId: number
  try {
    userId = (await requireAuth()).id
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    return NextResponse.json({ error: 'Not authenticated' }, { status })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string
      apiToken?: string
      test?: boolean
    }
    // Distinguish "field omitted" (leave the stored value untouched) from
    // "field sent as empty string" (an explicit clear). The client omits the
    // token whenever it still holds the masked GET value — treating omitted as
    // "" here would blank the saved token on every save/test (the wipe bug).
    const emailProvided = typeof body.email === 'string'
    const tokenProvided = typeof body.apiToken === 'string'
    const email = emailProvided ? body.email!.trim() : ''
    const apiToken = tokenProvided ? body.apiToken! : ''

    // A masked value (from a GET response) must never be written back over the real one.
    if (tokenProvided && apiToken.startsWith(MASK_PREFIX)) {
      return NextResponse.json(
        { error: 'Masked value — enter the full token to update' },
        { status: 400 }
      )
    }

    const scope = `user:${userId}`

    // ── Test connection: validate only, NEVER persist ──────────────────────
    // Uses the just-typed values when present, otherwise the stored ones, so a
    // user can test the saved token without re-typing it. Reports success only
    // when Jira actually accepts the credentials — no silent pass on blanks.
    if (body.test) {
      const [storedEmail, storedToken] = await Promise.all([
        getSetting(scope, 'JIRA_EMAIL'),
        getSetting(scope, 'JIRA_API_TOKEN'),
      ])
      const effEmail = (emailProvided && email) ? email : (storedEmail ?? '')
      const effToken = (tokenProvided && apiToken) ? apiToken : (storedToken ?? '')
      if (!effEmail || !effToken) {
        return NextResponse.json(
          { error: 'Enter your Atlassian email and API token before testing' },
          { status: 400 }
        )
      }
      const baseUrl = (await getSetting('global', 'JIRA_BASE_URL'))?.replace(/\/$/, '')
      if (!baseUrl) {
        return NextResponse.json(
          { error: 'Jira base URL is not configured — an admin must set it up in Settings first' },
          { status: 400 }
        )
      }
      try {
        const authHeader = `Basic ${Buffer.from(`${effEmail}:${effToken}`).toString('base64')}`
        const res = await fetch(`${baseUrl}/rest/api/2/myself`, {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          signal: AbortSignal.timeout(JIRA_FETCH_TIMEOUT_MS),
        })
        if (!res.ok) {
          return NextResponse.json(
            { error: `Jira rejected these credentials (HTTP ${res.status})` },
            { status: 400 }
          )
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not reach Jira'
        return NextResponse.json({ error: message }, { status: 400 })
      }
      return NextResponse.json({ ok: true, verified: true })
    }

    // ── Save: only write the fields that were actually provided ────────────
    const writes: Promise<unknown>[] = []
    if (emailProvided) writes.push(setSetting(scope, 'JIRA_EMAIL', email))
    if (tokenProvided) writes.push(setSetting(scope, 'JIRA_API_TOKEN', apiToken))
    await Promise.all(writes)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
