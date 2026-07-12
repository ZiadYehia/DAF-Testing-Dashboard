'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { AppSelect } from '@/components/shared/AppSelect'
import { titleCase, cn } from '@/lib/utils'
import {
  RefreshCw,
  Loader2,
  Search,
  ExternalLink,
  EllipsisVertical,
  Columns3,
  Settings2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BugSummary } from '@/lib/bugs'
import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@/lib/board-config'

type BoardBug = BugSummary & { jira_status?: string | null; jira_url?: string | null }

interface Transition {
  id: string
  name: string
  toStatus: string
}

function bugKey(bug: BoardBug): string {
  return `${bug.feature}/${bug.slug}`
}

function isDraftBug(bug: BoardBug): boolean {
  return bug.status === 'draft' || !bug.jira_key
}

interface BugCardProps {
  bug: BoardBug
  bugsBase: string
  transitions: Transition[] | 'loading' | undefined
  onOpenMenu: () => void
  onMove: (transition: Transition) => void
  moving: boolean
}

function BugCard({ bug, bugsBase, transitions, onOpenMenu, onMove, moving }: BugCardProps) {
  return (
    <Card className="shrink-0 gap-2 py-3">
      <CardContent className="px-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`${bugsBase}/${bug.feature}/${bug.slug}`}
            className="min-w-0 flex-1 break-words text-sm font-medium leading-snug hover:text-primary hover:underline"
          >
            {bug.title}
          </Link>
          {bug.jira_key && (
            <DropdownMenu onOpenChange={(open) => { if (open) onOpenMenu() }}>
              <DropdownMenuTrigger
                disabled={moving}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {moving ? <Loader2 className="h-4 w-4 animate-spin" /> : <EllipsisVertical className="h-4 w-4" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Move to…</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {transitions === 'loading' || transitions === undefined ? (
                  <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
                ) : transitions.length === 0 ? (
                  <DropdownMenuItem disabled>No transitions available</DropdownMenuItem>
                ) : (
                  transitions.map((t) => (
                    <DropdownMenuItem key={t.id} onClick={() => onMove(t)}>
                      {t.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={bug.priority} />
          {bug.severity && <span className="text-xs text-muted-foreground">{bug.severity}</span>}
          {bug.bug_type && (
            <span className="inline-flex max-w-full items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              <span className="truncate">{bug.bug_type}</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <span className="truncate">{titleCase(bug.feature)}</span>
          </span>
          {bug.jira_key ? (
            bug.jira_url ? (
              <a
                href={bug.jira_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                {bug.jira_key} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">{bug.jira_key}</span>
            )
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">Not reported</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface ColumnProps {
  label: string
  bugs: BoardBug[]
  accent?: boolean
  retest?: boolean
  bugsBase: string
  transitionsCache: Record<string, Transition[] | 'loading'>
  moving: string | null
  onOpenMenu: (jiraKey: string) => void
  onMove: (bug: BoardBug, transition: Transition) => void
}

function BoardColumn({ label, bugs, retest, bugsBase, transitionsCache, moving, onOpenMenu, onMove }: ColumnProps) {
  return (
    <div
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded-lg border p-2',
        retest && 'border-primary/60 ring-1 ring-primary/40 bg-primary/5'
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold truncate">{label}</h3>
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
            retest ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          {retest ? `${bugs.length} to retest` : bugs.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto pr-0.5" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        {bugs.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No bugs</p>
        ) : (
          bugs.map((b) => (
            <BugCard
              key={bugKey(b)}
              bug={b}
              bugsBase={bugsBase}
              transitions={b.jira_key ? transitionsCache[b.jira_key] : undefined}
              onOpenMenu={() => { if (b.jira_key) onOpenMenu(b.jira_key) }}
              onMove={(t) => onMove(b, t)}
              moving={moving === bugKey(b)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function BoardPage() {
  const params = useParams()
  const pathname = usePathname()
  const app = params?.app as string
  const parts = pathname?.split('/') ?? []
  const appIdx = parts.indexOf(app)
  const boardIdx = parts.indexOf('board', appIdx)
  const moduleSlug = boardIdx > appIdx + 1 ? parts[appIdx + 1] : null
  const boardBase = moduleSlug ? `/${app}/${moduleSlug}/board` : `/${app}/board`
  const bugsBase = boardBase.replace('/board', '/bugs')

  const [bugs, setBugs] = useState<BoardBug[]>([])
  const [config, setConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'synced' | 'cached'>('idle')
  const [search, setSearch] = useState('')
  const [filterFeature, setFilterFeature] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [myJiraId, setMyJiraId] = useState<string | null>(null)
  const [transitionsCache, setTransitionsCache] = useState<Record<string, Transition[] | 'loading'>>({})
  const [moving, setMoving] = useState<string | null>(null)

  const bugsUrl = moduleSlug ? `/api/${app}/bugs?module=${moduleSlug}` : `/api/${app}/bugs`
  const syncUrl = moduleSlug ? `/api/${app}/board/sync?module=${moduleSlug}` : `/api/${app}/board/sync`

  const runSync = useCallback(async () => {
    if (!app) return
    setSyncing(true)
    try {
      const res = await fetch(syncUrl, { method: 'POST' })
      if (!res.ok) throw new Error('sync failed')
      const data: BoardBug[] = await res.json()
      if (!Array.isArray(data)) throw new Error('sync failed')
      setBugs(data)
      setSyncState('synced')
    } catch {
      toast.error('Jira sync failed — showing cached statuses')
      setSyncState('cached')
    } finally {
      setSyncing(false)
    }
  }, [app, syncUrl])

  useEffect(() => {
    if (!app) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch(bugsUrl).then((r) => r.json()),
      fetch(`/api/${app}/board-config`).then((r) => r.json()),
      fetch(`/api/${app}/board/me`).then((r) => r.json()).catch(() => ({ identifier: null })),
    ]).then(([bugsData, configData, meData]: [BoardBug[], { config: BoardConfig }, { identifier: string | null }]) => {
      if (cancelled) return
      setBugs(Array.isArray(bugsData) ? bugsData : [])
      setConfig(configData.config ?? DEFAULT_BOARD_CONFIG)
      setMyJiraId(meData?.identifier ?? null)
      setLoading(false)
      runSync()
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, bugsUrl])

  async function loadTransitions(jiraKey: string) {
    setTransitionsCache((prev) => {
      if (prev[jiraKey] !== undefined) return prev
      return { ...prev, [jiraKey]: 'loading' }
    })
    try {
      const res = await fetch(`/api/${app}/board/transitions?key=${jiraKey}`)
      if (!res.ok) throw new Error('failed')
      const data: { transitions: Transition[] } = await res.json()
      setTransitionsCache((prev) => ({ ...prev, [jiraKey]: data.transitions ?? [] }))
    } catch {
      setTransitionsCache((prev) => ({ ...prev, [jiraKey]: [] }))
      toast.error('Failed to load available transitions')
    }
  }

  async function handleMove(bug: BoardBug, transition: Transition) {
    const key = bugKey(bug)
    const prevStatus = bug.jira_status ?? null
    setMoving(key)
    setBugs((prev) => prev.map((b) => (bugKey(b) === key ? { ...b, jira_status: transition.toStatus } : b)))
    try {
      const res = await fetch(`/api/${app}/board/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: bug.feature, slug: bug.slug, transitionId: transition.id }),
      })
      if (!res.ok) throw new Error('failed')
      const data: { bug: BoardBug } = await res.json()
      setBugs((prev) => prev.map((b) => (bugKey(b) === key ? { ...b, ...data.bug } : b)))
      toast.success(`Moved to ${transition.toStatus}`)
    } catch {
      setBugs((prev) => prev.map((b) => (bugKey(b) === key ? { ...b, jira_status: prevStatus } : b)))
      toast.error('Failed to move — reverted')
    } finally {
      setMoving(null)
    }
  }

  const features = [...new Set(bugs.map((b) => b.feature))].sort()

  const filtered = bugs.filter((b) => {
    // "Reported by me": reported bugs must have been reported by the Jira account
    // configured in Settings. Local drafts (not in Jira yet) are always shown.
    if (scope === 'mine' && myJiraId && !isDraftBug(b) && b.jira_reporter !== myJiraId) return false
    if (filterFeature !== 'all' && b.feature !== filterFeature) return false
    if (filterPriority !== 'all' && !b.priority.includes(filterPriority)) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const haystack = `${b.title} ${b.slug} ${b.feature} ${b.jira_key ?? ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const draftBugs = filtered.filter(isDraftBug)
  const reportedBugs = filtered.filter((b) => !isDraftBug(b))

  function bugsForStatus(status: string): BoardBug[] {
    return reportedBugs.filter((b) => (b.jira_status ?? '').toLowerCase() === status.toLowerCase())
  }

  const matchedKeys = new Set(config.columns.flatMap((status) => bugsForStatus(status).map(bugKey)))
  const otherBugs = reportedBugs.filter((b) => !matchedKeys.has(bugKey(b)))

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-96 w-72 shrink-0" />)}
        </div>
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
            <Columns3 className="h-5 w-5 text-primary" />
            Retest Board
          </h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            {bugs.length} bug{bugs.length !== 1 ? 's' : ''}
            <span aria-hidden>·</span>
            {syncing ? (
              <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Syncing…</span>
            ) : syncState === 'synced' ? (
              'Synced just now'
            ) : syncState === 'cached' ? (
              'Showing cached statuses'
            ) : null}
          </p>
        </div>
        <Button variant="outline" className="gap-2 shrink-0" onClick={runSync} disabled={syncing}>
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {config.columns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Columns3 className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium">Board not configured</p>
            <Link href={`/${app}/settings`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Settings2 className="h-3.5 w-3.5" />
              Choose which Jira statuses appear as columns
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Bug scope">
              <button
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  scope === 'mine' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setScope('mine')}
              >
                Reported by me
              </button>
              <button
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  scope === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setScope('all')}
              >
                All bugs
              </button>
            </div>
            <div className="relative w-[220px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, slug, feature, key…"
                className="h-8 pl-8 text-sm"
              />
            </div>
            <AppSelect
              options={[
                { value: 'all', label: 'All Features' },
                ...features.map((f) => ({ value: f, label: titleCase(f) })),
              ]}
              value={filterFeature}
              onChange={setFilterFeature}
              className="w-[150px]"
              size="sm"
            />
            <AppSelect
              options={[
                { value: 'all', label: 'All Priorities' },
                ...(['P1', 'P2', 'P3', 'P4'] as const).map((p) => ({ value: p, label: p })),
              ]}
              value={filterPriority}
              onChange={setFilterPriority}
              className="w-[140px]"
              size="sm"
            />
            {(filterFeature !== 'all' || filterPriority !== 'all' || search) && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                onClick={() => { setFilterFeature('all'); setFilterPriority('all'); setSearch('') }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Columns */}
          <div className="flex gap-4 overflow-x-auto pb-2">
            {config.showDraftColumn && (
              <BoardColumn
                label="Draft — not in Jira"
                bugs={draftBugs}
                bugsBase={bugsBase}
                transitionsCache={transitionsCache}
                moving={moving}
                onOpenMenu={loadTransitions}
                onMove={handleMove}
              />
            )}
            {config.columns.map((status) => (
              <BoardColumn
                key={status}
                label={status}
                bugs={bugsForStatus(status)}
                retest={!!config.retestStatus && config.retestStatus.toLowerCase() === status.toLowerCase()}
                bugsBase={bugsBase}
                transitionsCache={transitionsCache}
                moving={moving}
                onOpenMenu={loadTransitions}
                onMove={handleMove}
              />
            ))}
            {otherBugs.length > 0 && (
              <BoardColumn
                label="Other"
                bugs={otherBugs}
                bugsBase={bugsBase}
                transitionsCache={transitionsCache}
                moving={moving}
                onOpenMenu={loadTransitions}
                onMove={handleMove}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
