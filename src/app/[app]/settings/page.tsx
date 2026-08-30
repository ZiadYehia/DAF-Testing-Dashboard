'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Settings2, Lock, LockOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AiSettingsTab } from '@/components/settings/AiSettingsTab'
import { ProfileSettingsTab } from '@/components/settings/ProfileSettingsTab'
import { CredentialsTab } from '@/components/settings/CredentialsTab'
import { MyJiraCard } from '@/components/settings/MyJiraCard'
import { MyAiKeysCard } from '@/components/settings/MyAiKeysCard'
import { AutomationSettingsTab } from '@/components/settings/AutomationSettingsTab'
import { BoardSettingsTab } from '@/components/settings/BoardSettingsTab'
import { DefaultsSettingsTab } from '@/components/settings/DefaultsSettingsTab'
import { BrandingSettingsTab } from '@/components/settings/BrandingSettingsTab'
import { fetchWithRetry } from '@/components/settings/fetchWithRetry'
import { usePermissions } from '@/lib/use-permissions'
import type { PermissionKey } from '@/lib/permissions'
import { Card, CardContent } from '@/components/ui/card'

type GlobalSettings = Record<string, string>

// Ordered tab definitions — order here drives both TabsList rendering and
// the dynamic defaultValue (first tab the current role can see).
const SETTINGS_TABS: { value: string; key: PermissionKey }[] = [
  { value: 'profile', key: 'settings.tab.profile' },
  { value: 'credentials', key: 'settings.tab.credentials' },
  { value: 'ai', key: 'settings.tab.ai' },
  { value: 'board', key: 'settings.tab.board' },
  { value: 'automation', key: 'settings.tab.automation' },
  { value: 'defaults', key: 'settings.tab.defaults' },
  { value: 'branding', key: 'settings.tab.branding' },
]

export default function SettingsPage() {
  const params = useParams()
  const app = params?.app as string

  // Per-tab permission gating — which settings tabs a role can see is driven
  // by the settings.tab.* permission catalog, not a hardcoded role check.
  const { can, loading: permsLoading } = usePermissions(app)
  const visibleTabs = SETTINGS_TABS.filter((t) => can(t.key))
  const defaultTab = visibleTabs[0]?.value

  // Edit lock — settings always open locked; user must explicitly unlock to edit.
  // Client-side only (no persistence, relocks on reload); server-side permissions
  // already gate who can actually save.
  const [locked, setLocked] = useState(true)

  // Global credentials/AI settings are admin-only (GET/PUT /api/settings requires
  // admin). Detect role up front so those tabs render read-only with a notice
  // instead of failing with a raw 403 on save.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setIsAdmin(data?.user?.role === 'admin')
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Global credentials — shared GET/PUT /api/settings state, handed to any tab
  // that edits global keys (Credentials, Automation) so they don't fork state.
  const [globals, setGlobals] = useState<GlobalSettings>({})
  const [loadingGlobals, setLoadingGlobals] = useState(true)

  const loadGlobals = useCallback(async () => {
    setLoadingGlobals(true)
    try {
      const res = await fetchWithRetry('/api/settings')
      if (!res.ok) throw new Error('Failed to load credentials')
      const data: GlobalSettings = await res.json()
      setGlobals(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load credentials')
    } finally {
      setLoadingGlobals(false)
    }
  }, [])

  useEffect(() => {
    // Non-admins get 403 from GET /api/settings — skip the fetch (and its error
    // toast); the admin-only tabs render a read-only notice instead.
    if (isAdmin === true) loadGlobals()
    else if (isAdmin === false) setLoadingGlobals(false)
  }, [isAdmin, loadGlobals])

  function updateGlobal(key: string, value: string) {
    setGlobals((prev) => ({ ...prev, [key]: value }))
  }

  const adminOnlyNotice =
    isAdmin === false ? (
      <p className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        These settings are global and managed by admins — read-only for your role.
      </p>
    ) : null

  async function saveGlobalKeys(keys: string[], setSaving: (v: boolean) => void) {
    setSaving(true)
    try {
      // Skip fields still holding the masked value from GET (untouched) — resending
      // them would be rejected by the API (and would never carry the real secret anyway).
      const toSave = keys.filter((key) => !(globals[key] ?? '').startsWith('••••'))
      await Promise.all(
        toSave.map((key) =>
          fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: globals[key] ?? '' }),
          }).then((r) => {
            if (!r.ok) throw new Error(`Failed to save ${key}`)
          })
        )
      )
      toast.success('Saved successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Settings2 className="h-6 w-6 text-primary mt-0.5" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Credentials, integrations, and test case defaults</p>
          {locked && (
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">
              Locked — click Unlock to make changes
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => setLocked((l) => !l)}
        >
          {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          {locked ? 'Unlock to edit' : 'Lock'}
        </Button>
      </div>

      {permsLoading ? null : defaultTab ? (
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {can('settings.tab.profile') && <TabsTrigger value="profile">App Profile</TabsTrigger>}
          {can('settings.tab.credentials') && <TabsTrigger value="credentials">Credentials &amp; Integrations</TabsTrigger>}
          {can('settings.tab.ai') && <TabsTrigger value="ai">AI &amp; Models</TabsTrigger>}
          {can('settings.tab.board') && <TabsTrigger value="board">Board</TabsTrigger>}
          {can('settings.tab.automation') && <TabsTrigger value="automation">Automation</TabsTrigger>}
          {can('settings.tab.defaults') && <TabsTrigger value="defaults">Test Case &amp; Bug Report Defaults</TabsTrigger>}
          {can('settings.tab.branding') && <TabsTrigger value="branding">Branding</TabsTrigger>}
        </TabsList>

        {/* ── Tab: App Profile (structured intake) ── */}
        {can('settings.tab.profile') && (
        <TabsContent value="profile">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>
            <ProfileSettingsTab app={app} />
          </div>
          </fieldset>
        </TabsContent>
        )}

        {/* ── Tab: AI & Models ── */}
        {can('settings.tab.ai') && (
        <TabsContent value="ai">
          <div className="space-y-4 pt-4">
            {/* Personal AI keys — editable by every role once unlocked, independent
                of the admin-only global model/provider/feature policy below. */}
            <fieldset disabled={locked} className="contents min-w-0">
              <div className={locked ? 'opacity-75' : ''}>
                <MyAiKeysCard />
              </div>
            </fieldset>

            <fieldset disabled={locked || isAdmin === false} className="contents min-w-0">
              <div className={`space-y-4 ${locked || isAdmin === false ? 'opacity-75' : ''}`}>
                {adminOnlyNotice}
                <AiSettingsTab app={app} />
              </div>
            </fieldset>
          </div>
        </TabsContent>
        )}

        {/* ── Tab: Retest Board ── */}
        {can('settings.tab.board') && (
        <TabsContent value="board">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>
            <BoardSettingsTab app={app} />
          </div>
          </fieldset>
        </TabsContent>
        )}

        {/* ── Tab 1: Credentials ── */}
        {can('settings.tab.credentials') && (
        <TabsContent value="credentials">
          <div className="space-y-4 pt-4">
            {/* Personal Jira account — editable by every role once unlocked,
                independent of the admin-only global credentials below. */}
            <fieldset disabled={locked} className="contents min-w-0">
              <div className={locked ? 'opacity-75' : ''}>
                <MyJiraCard />
              </div>
            </fieldset>

            <fieldset disabled={locked || isAdmin === false} className="contents min-w-0">
              <div className={`space-y-4 ${locked || isAdmin === false ? 'opacity-75' : ''}`}>
                {adminOnlyNotice}
                <CredentialsTab
                  globals={globals}
                  loading={loadingGlobals}
                  onChange={updateGlobal}
                  saveKeys={saveGlobalKeys}
                />
              </div>
            </fieldset>
          </div>
        </TabsContent>
        )}

        {/* ── Tab: Automation ── */}
        {can('settings.tab.automation') && (
        <TabsContent value="automation">
          <fieldset disabled={locked || isAdmin === false} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked || isAdmin === false ? 'opacity-75' : ''}`}>
            {adminOnlyNotice}
            <AutomationSettingsTab
              globals={globals}
              loading={loadingGlobals}
              onChange={updateGlobal}
              saveKeys={saveGlobalKeys}
            />
          </div>
          </fieldset>
        </TabsContent>
        )}

        {/* ── Tab 3: Branding ── */}
        {can('settings.tab.branding') && (
        <TabsContent value="branding">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>
            <BrandingSettingsTab />
          </div>
          </fieldset>
        </TabsContent>
        )}

        {/* ── Tab 2: Test Case & Bug Report Defaults ── */}
        {can('settings.tab.defaults') && (
        <TabsContent value="defaults">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>
            <DefaultsSettingsTab app={app} />
          </div>
          </fieldset>
        </TabsContent>
        )}
      </Tabs>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have access to any settings for this app.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
