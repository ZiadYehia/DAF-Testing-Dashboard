'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Pencil, Archive, RotateCcw, ExternalLink, Eye, EyeOff, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AppConfig } from '@/lib/app-types'
import { appLogoKey } from '@/lib/app-types'
import { invalidateApps } from '@/lib/use-apps'
import { ReadinessBadge } from '@/components/shared/ReadinessBadge'

function CapabilityChips({ caps }: { caps: AppConfig['capabilities'] }) {
  const active = [
    caps.testCaseWriter && 'Test-case writer',
    caps.featureWizard && 'Feature wizard',
    caps.moduleKnowledge && 'Module knowledge',
  ].filter(Boolean) as string[]
  if (active.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {active.map((c) => (
        <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{c}</span>
      ))}
    </div>
  )
}

export default function AdminAppsPage() {
  const router = useRouter()
  const [apps, setApps] = useState<AppConfig[]>([])
  const [logos, setLogos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportSummary, setExportSummary] = useState<{
    filesWritten: number
    filesDeleted: number
    countsByEntity: Record<string, number>
    orphanedBinaries: string[]
  } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/apps')
    if (res.status === 401 || res.status === 403) { router.push('/login'); return }
    if (!res.ok) { toast.error('Failed to load apps'); setLoading(false); return }
    const data = await res.json()
    setApps(data.apps ?? [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/api/logo').then(r => r.ok ? r.json() : {}).then(setLogos).catch(() => {})
  }, [])

  async function setEnabled(slug: string, enabled: boolean) {
    setBusy(slug)
    const res = enabled
      ? await fetch(`/api/admin/apps/${slug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true }),
        })
      : await fetch(`/api/admin/apps/${slug}`, { method: 'DELETE' })
    setBusy(null)
    if (res.ok) {
      invalidateApps()
      toast.success(enabled ? 'App restored' : 'App archived')
      load()
    } else {
      toast.error('Action failed')
    }
  }

  async function exportToFiles() {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        toast.error(data?.error ?? 'Export failed')
        return
      }
      setExportSummary(data.summary)
      toast.success(`Exported ${data.summary.filesWritten} file(s) to data/`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  function renderCard(app: AppConfig) {
    const logo = logos[appLogoKey(app.slug)]
    return (
      <Card key={app.slug} size="sm" className={app.enabled ? '' : 'opacity-70'}>
        <CardContent className="pt-3 pb-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-lg">
              {logo
                ? <img src={logo} alt="" className="h-7 w-7 object-contain rounded" />
                : <span>{app.icon}</span>}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{app.name}</span>
                <code className="text-xs text-muted-foreground">/{app.slug}</code>
                {app.enabled
                  ? <Badge variant="secondary" className="text-xs">Active</Badge>
                  : <Badge variant="outline" className="text-xs">Archived</Badge>}
                <ReadinessBadge app={app.slug} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {app.platform || '—'} · {app.type}
              </p>
              {app.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{app.description}</p>
              )}
              <CapabilityChips caps={app.capabilities} />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {app.enabled && (
                <Button variant="ghost" size="xs" nativeButton={false} render={<Link href={`/${app.slug}`} />} title="Open app">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="outline" size="xs" nativeButton={false} render={<Link href={`/admin/apps/${app.slug}/edit`} />}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              {app.enabled ? (
                <Button variant="outline" size="xs" disabled={busy === app.slug}
                  onClick={() => setEnabled(app.slug, false)}>
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </Button>
              ) : (
                <Button variant="outline" size="xs" disabled={busy === app.slug}
                  onClick={() => setEnabled(app.slug, true)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const active = apps.filter((a) => a.enabled)
  const archived = apps.filter((a) => !a.enabled)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Apps</h1>
          <p className="text-sm text-muted-foreground">
            Add, edit and archive the apps shown in the dashboard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={exporting} onClick={exportToFiles}>
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export to files'}
          </Button>
          <Button nativeButton={false} render={<Link href="/admin/apps/new" />}>
            <Plus className="h-4 w-4" />
            Add app
          </Button>
        </div>
      </div>

      {exportSummary && (
        <Card size="sm">
          <CardContent className="pt-3 pb-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">
              Export complete — {exportSummary.filesWritten} file(s) written, {exportSummary.filesDeleted} pruned.
            </p>
            <p>
              {Object.entries(exportSummary.countsByEntity).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </p>
            {exportSummary.orphanedBinaries.length > 0 && (
              <p>
                Orphaned binaries (left on disk, owning row deleted): {exportSummary.orphanedBinaries.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : (
        <>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No active apps — add one to get started.</p>
          ) : (
            <div className="space-y-2">{active.map(renderCard)}</div>
          )}

          {archived.length > 0 && (
            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showArchived ? 'Hide archived' : `View archived (${archived.length})`}
              </Button>
              {showArchived && (
                <div className="space-y-2 mt-2">{archived.map(renderCard)}</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
