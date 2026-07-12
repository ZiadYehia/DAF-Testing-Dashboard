'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { titleCase, formatDate } from '@/lib/utils'
import { useApp } from '@/lib/use-apps'
import { usePermissions } from '@/lib/use-permissions'
import type { PermissionKey } from '@/lib/permissions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ReadinessBadge } from '@/components/shared/ReadinessBadge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  FlaskConical,
  ImageIcon,
  Plus,
  CheckCircle2,
  Clock,
  ExternalLink,
  BookOpen,
  Archive,
  RotateCcw,
  Eye,
  EyeOff,
} from 'lucide-react'

interface FeatureSummary {
  name: string
  hasWorkflow: boolean
  hasTestcases: boolean
  testcaseCount: number
  screenshotCount: number
  lastModified: string | null
  jiraKey?: string
  storyKey?: string
  module?: string | null
  archived?: boolean
}

interface ModuleSummary {
  slug: string
  pathPrefix: string
}

function FeatureCard({
  f,
  app,
  base,
  hasTestCaseWriter,
  canArchive,
  onArchive,
  archived = false,
  onRestore,
  restoring = false,
}: {
  f: FeatureSummary
  app: string
  base: string
  hasTestCaseWriter: boolean
  canArchive: boolean
  onArchive: (name: string) => void
  archived?: boolean
  onRestore?: (name: string) => void
  restoring?: boolean
}) {
  return (
    <Link key={f.name} href={`${base}/${f.name}`}>
      <Card
        className={
          archived
            ? 'h-full border-border/60 opacity-60 hover:opacity-80 transition-opacity'
            : 'hover-lift cursor-pointer h-full border-border/60 hover:border-primary/50 hover:bg-primary/[0.05] hover:shadow-md transition-all duration-150'
        }
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FlaskConical className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm leading-snug truncate">{titleCase(f.name)}</h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ReadinessBadge app={app} feature={f.name} />
              {archived && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">Archived</Badge>
              )}
              {f.jiraKey && (
                <Badge variant="outline" className="gap-1 text-[10px] font-mono px-1.5 py-0.5 text-muted-foreground">
                  <ExternalLink className="h-2.5 w-2.5" />
                  {f.jiraKey}
                </Badge>
              )}
              {!archived && canArchive && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  title="Archive feature"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onArchive(f.name)
                  }}
                >
                  <Archive className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {f.hasWorkflow && (
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Workflow
              </Badge>
            )}
            {f.hasTestcases ? (
              <Badge variant="secondary" className="text-xs">
                {f.testcaseCount} test cases
              </Badge>
            ) : !hasTestCaseWriter ? (
              <Badge variant="outline" className="text-xs opacity-40">No test cases · Soon</Badge>
            ) : null}
            {f.screenshotCount > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <ImageIcon className="h-3 w-3" />
                {f.screenshotCount}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDate(f.lastModified)}
            </div>
            {archived && onRestore && (
              <Button
                variant="outline"
                size="xs"
                disabled={restoring}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onRestore(f.name)
                }}
              >
                <RotateCcw className="h-3 w-3" />
                {restoring ? 'Restoring…' : 'Restore'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function FeaturesPage() {
  const params = useParams()
  const pathname = usePathname()
  const app = params?.app as string
  const parts = pathname?.split('/') ?? []
  const appIdx = parts.indexOf(app)
  const featuresIdx = parts.indexOf('features', appIdx)
  const prefix = featuresIdx > appIdx + 1 ? parts[appIdx + 1] : ''
  const base = `/${app}${prefix ? `/${prefix}` : ''}/features`
  const appConfig = useApp(app)
  const hasTestCaseWriter = appConfig?.capabilities.testCaseWriter ?? false
  const hasFeatureWizard = appConfig?.capabilities.featureWizard ?? false

  const { can } = usePermissions(app)
  const canArchive = can('features.delete' as PermissionKey)

  const [features, setFeatures] = useState<FeatureSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [storyMap, setStoryMap] = useState<Map<string, string>>(new Map())
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [restoringName, setRestoringName] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!app) return
    // Resolve the module whose pathPrefix matches the URL segment (derived above).
    // For apps without modules, or when no module matches, fetch all features.
    let moduleParam: string | undefined
    try {
      const modulesRes = await fetch(`/api/${app}/modules`)
      if (modulesRes.ok) {
        const modules: ModuleSummary[] = await modulesRes.json()
        const matchedModule = modules.find((m) => m.pathPrefix === prefix)
        moduleParam = matchedModule?.slug
      }
    } catch {
      // fall through with no module filter
    }

    const qs = new URLSearchParams({ includeArchived: '1' })
    if (moduleParam) qs.set('module', moduleParam)
    const res = await fetch(`/api/${app}/features?${qs.toString()}`)
    if (!res.ok) { toast.error('Failed to load features'); setLoading(false); return }
    const data: FeatureSummary[] = await res.json()
    setFeatures(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [app, prefix])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!app) return
    fetch(`/api/${app}/stories?source=local`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.stories)) {
          setStoryMap(new Map(data.stories.map((s: { key: string; summary: string }) => [s.key, s.summary])))
        }
      })
      .catch(() => {})
  }, [app])

  const confirmArchive = async () => {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      const res = await fetch(`/api/${app}/features/${archiveTarget}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Feature archived')
      setArchiveTarget(null)
      await load()
    } catch {
      toast.error('Failed to archive feature')
    } finally {
      setArchiving(false)
    }
  }

  const restoreFeature = async (name: string) => {
    setRestoringName(name)
    try {
      const res = await fetch(`/api/${app}/features/${name}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('Feature restored')
      await load()
    } catch {
      toast.error('Failed to restore feature')
    } finally {
      setRestoringName(null)
    }
  }

  const active = features.filter((f) => !f.archived).sort((a, b) => {
    if (!a.lastModified) return 1
    if (!b.lastModified) return -1
    return b.lastModified.localeCompare(a.lastModified)
  })
  const archived = features.filter((f) => f.archived).sort((a, b) => {
    if (!a.lastModified) return 1
    if (!b.lastModified) return -1
    return b.lastModified.localeCompare(a.lastModified)
  })

  // Group active features by storyKey; features without one go to ungrouped
  const grouped = new Map<string, FeatureSummary[]>()
  const ungrouped: FeatureSummary[] = []
  for (const f of active) {
    if (f.storyKey) {
      const bucket = grouped.get(f.storyKey) ?? []
      bucket.push(f)
      grouped.set(f.storyKey, bucket)
    } else {
      ungrouped.push(f)
    }
  }

  const totalTestcases = active.reduce((acc, f) => acc + f.testcaseCount, 0)
  const withTestcases = active.filter((f) => f.hasTestcases).length

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Features &amp; Test Cases</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading ? 'Loading…' : (
              <>
                {active.length} features
                {hasTestCaseWriter
                  ? <> · {totalTestcases} test cases · {withTestcases} with test cases</>
                  : <span className="opacity-40"> · test cases coming soon</span>
                }
              </>
            )}
          </p>
        </div>
        {hasFeatureWizard ? (
        <Link
          href={`${base}/new`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Feature</span>
          <span className="sm:hidden">New</span>
        </Link>
        ) : (
        <Link
          href={`${base}/new`}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-40 pointer-events-none select-none"
          aria-disabled="true"
          tabIndex={-1}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Feature</span>
          <span className="sm:hidden">New</span>
          <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight h-4 bg-white/20 text-white border-0">Soon</Badge>
        </Link>
        )}
      </div>

      {/* Feature Grid */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <FlaskConical className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold">No features yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first feature to get started</p>
            </div>
            {hasFeatureWizard ? (
            <Link
              href={`${base}/new`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Feature
            </Link>
            ) : (
            <Link
              href={`${base}/new`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-40 pointer-events-none select-none"
              aria-disabled="true"
              tabIndex={-1}
            >
              <Plus className="h-4 w-4" />
              Create Feature
              <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight h-4 bg-white/20 text-white border-0">Soon</Badge>
            </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Story groups */}
          {Array.from(grouped.entries()).map(([key, groupFeatures]) => (
            <div key={key} className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-sm font-semibold text-primary">{key}</span>
                {storyMap.has(key) && (
                  <span className="text-sm text-muted-foreground truncate">{storyMap.get(key)}</span>
                )}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">
                  {groupFeatures.length} feature{groupFeatures.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {groupFeatures.map((f) => (
                  <FeatureCard
                    key={f.name}
                    f={f}
                    app={app}
                    base={base}
                    hasTestCaseWriter={hasTestCaseWriter}
                    canArchive={canArchive}
                    onArchive={setArchiveTarget}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Ungrouped */}
          {ungrouped.length > 0 && (
            <div className="space-y-3">
              {grouped.size > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground px-2">Ungrouped</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {ungrouped.map((f) => (
                  <FeatureCard
                    key={f.name}
                    f={f}
                    app={app}
                    base={base}
                    hasTestCaseWriter={hasTestCaseWriter}
                    canArchive={canArchive}
                    onArchive={setArchiveTarget}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Archived features */}
      {!loading && archived.length > 0 && (
        <div className="pt-2">
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showArchived ? 'Hide archived' : `View archived (${archived.length})`}
          </Button>
          {showArchived && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 mt-2">
              {archived.map((f) => (
                <FeatureCard
                  key={f.name}
                  f={f}
                  app={app}
                  base={base}
                  hasTestCaseWriter={hasTestCaseWriter}
                  canArchive={canArchive}
                  onArchive={setArchiveTarget}
                  archived
                  onRestore={canArchive ? restoreFeature : undefined}
                  restoring={restoringName === f.name}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive feature?</DialogTitle>
            <DialogDescription>
              It disappears from the list but keeps all test cases, knowledge, and execution history.
              You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setArchiveTarget(null)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmArchive} disabled={archiving} className="gap-1.5">
              <Archive className="h-3.5 w-3.5" />
              {archiving ? 'Archiving…' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
