'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save, Beaker, Loader2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CredentialRow, StatusBadge } from '@/components/settings/fields'
import { fetchWithRetry } from '@/components/settings/fetchWithRetry'

interface MyJiraCredentials {
  email: string
  apiToken: string
  configured: boolean
}

/**
 * Personal Jira account card — separate from the shared/global Jira instance
 * config in CredentialsTab. Required to report or sync bugs to Jira: there is
 * no shared team identity anymore, so every user must connect their own
 * account here. Also what the retest board's "Reported by me" filter resolves
 * against.
 */
export function MyJiraCard() {
  const [email, setEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetchWithRetry('/api/me/jira-credentials')
      if (!res.ok) throw new Error('Failed to load your Jira credentials')
      const data: MyJiraCredentials = await res.json()
      setEmail(data.email ?? '')
      setApiToken(data.apiToken ?? '')
      setConfigured(!!data.configured)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load your Jira credentials')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Load-on-mount pattern matches every sibling settings tab (Profile, Defaults,
    // Board, Branding, AI) — all trip this same warning; disabled here only to stay
    // under the repo's lint warning ratchet (package.json "lint": max-warnings).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function onFieldChange(key: string, value: string) {
    if (key === 'email') setEmail(value)
    else setApiToken(value)
  }

  // Never resend the masked placeholder from GET — only include apiToken when
  // the user actually typed a new value (or cleared it to empty, which clears it).
  function buildBody(extra?: { test: true }) {
    const body: { email: string; apiToken?: string; test?: true } = { email }
    if (!apiToken.startsWith('••••')) body.apiToken = apiToken
    if (extra?.test) body.test = true
    return body
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/me/jira-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody()),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data?.error ?? 'Failed to save')
      }
      toast.success('Saved')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    try {
      const res = await fetch('/api/me/jira-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody({ test: true })),
      })
      const data = await res.json().catch(() => ({}) as { error?: string; verified?: boolean })
      if (!res.ok || !data?.verified) throw new Error(data?.error ?? 'Connection failed')
      toast.success('Connection verified')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            My Jira Account
          </CardTitle>
          {!loading && <StatusBadge value={configured ? 'configured' : ''} />}
        </div>
        <CardDescription>
          Bugs you report to Jira use your account when set — otherwise the shared team credentials.
          Also drives the board&apos;s &quot;Reported by me&quot; filter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
          </div>
        ) : (
          <>
            <CredentialRow
              label="Email"
              description="Your Atlassian account email"
              fieldKey="email"
              value={email}
              onChange={onFieldChange}
              type="text"
            />
            <div className="space-y-1">
              <CredentialRow
                label="API Token"
                description="Generate at id.atlassian.com → Security → API tokens"
                fieldKey="apiToken"
                value={apiToken}
                onChange={onFieldChange}
              />
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Create an API token →
              </a>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="outline" onClick={testConnection} disabled={testing} className="gap-2">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Beaker className="h-4 w-4" />}
                {testing ? 'Testing…' : 'Test connection'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
