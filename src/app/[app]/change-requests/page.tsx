'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  GitPullRequestArrow,
  ExternalLink,
  RefreshCw,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { ChangeRequestDialog, type ChangeRequestRecord } from '@/components/change-requests/ChangeRequestDialog'
import { usePermissions } from '@/lib/use-permissions'
import { useModels } from '@/hooks/useModels'
import { formatDate, titleCase } from '@/lib/utils'

type CrRow = ChangeRequestRecord & { jira_url?: string | null; parent_url?: string | null }

export default function ChangeRequestsPage() {
  const params = useParams()
  const pathname = usePathname()
  const app = params?.app as string

  // Same module-derivation pattern as bugs/page.tsx: the `[prefix]` dynamic
  // segment sits directly after the app slug when this route is reached via
  // a module's wrapper page (`[app]/[prefix]/change-requests`).
  const parts = pathname?.split('/') ?? []
  const appIdx = parts.indexOf(app)
  const crIdx = parts.indexOf('change-requests', appIdx)
  const moduleSlug = crIdx > appIdx + 1 ? parts[appIdx + 1] : null
  const crBase = moduleSlug ? `/${app}/${moduleSlug}/change-requests` : `/${app}/change-requests`

  const { can, loading: permsLoading } = usePermissions(app)
  const { selectedModel } = useModels()

  const [rows, setRows] = useState<CrRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<number | null>(null)
  const [editTarget, setEditTarget] = useState<CrRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CrRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    if (!app) return
    setLoading(true)
    const url = moduleSlug ? `/api/${app}/change-requests?module=${moduleSlug}` : `/api/${app}/change-requests`
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load Change Requests'))))
      .then((data: CrRow[]) => setRows(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Failed to load Change Requests'))
      .finally(() => setLoading(false))
  }, [app, moduleSlug])

  useEffect(() => {
    load()
  }, [load])

  const handleEdit = (row: CrRow) => {
    setEditTarget(row)
    setDialogOpen(true)
  }

  const handleSaved = (cr: ChangeRequestRecord) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === cr.id)
      if (idx === -1) return [{ ...cr, jira_url: null, parent_url: null }, ...prev]
      const next = [...prev]
      next[idx] = { ...next[idx], ...cr }
      return next
    })
  }

  const handleSync = async (row: CrRow) => {
    setSyncingId(row.id)
    try {
      const res = await fetch(`/api/${app}/change-requests/${row.id}/sync`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Sync failed')
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...data } : r)))
      toast.success('Synced from Jira.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/${app}/change-requests/${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Delete failed')
      }
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      toast.success('Change Request deleted.')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          {moduleSlug && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{titleCase(moduleSlug)} Module</p>}
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitPullRequestArrow className="h-6 w-6" />
            Change Requests
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {rows.length} total. File one here with the parent story/epic key, or from the Module Knowledge
            stories view when a call changes scope already captured in a story or epic.
          </p>
        </div>
        {!permsLoading && can('changerequests.create') && (
          <Link href={`${crBase}/new`}>
            <Button className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New CR</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        )}
      </div>

      <Card className="overflow-hidden border-border/60">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <GitPullRequestArrow className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium">No Change Requests yet</p>
              <p className="text-xs max-w-sm text-center">
                Use &quot;New CR&quot; above, or open a story or epic from Module Knowledge and use its &quot;New CR&quot; action.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Summary</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Change Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Priority</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">Jira Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Parent</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell">CR Issue</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/40 hover:bg-accent/50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-medium line-clamp-1">{row.summary}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{formatDate(row.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-muted-foreground text-xs">{row.changeType || '—'}</span>
                      </td>
                      <td className="px-4 py-3"><PriorityBadge priority={row.priority} /></td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-muted-foreground text-xs">{row.jiraStatus ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {row.parent_url ? (
                          <a
                            href={row.parent_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {row.parentKey} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">{row.parentKey}</span>
                        )}
                        <span className="block text-[10px] text-muted-foreground/80 capitalize">{row.parentType}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {row.crKey && row.jira_url ? (
                          <a
                            href={row.jira_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {row.crKey} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : row.crKey ? (
                          <span className="text-muted-foreground text-xs">{row.crKey}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not pushed</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!permsLoading && can('changerequests.view') && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Sync from Jira"
                              disabled={!row.crKey || syncingId === row.id}
                              onClick={() => handleSync(row)}
                            >
                              {syncingId === row.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          {!permsLoading && can('changerequests.edit') && (
                            <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => handleEdit(row)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!permsLoading && can('changerequests.delete') && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Delete"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ChangeRequestDialog
        app={app}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditTarget(null)
        }}
        model={selectedModel}
        changeRequest={editTarget}
        module={moduleSlug}
        onSaved={handleSaved}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.summary ?? ''}"?`}
        description="Removes the local Change Request record only — the Jira issue (if one was created) is left intact."
        confirmWord="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
