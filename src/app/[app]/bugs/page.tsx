'use client'

import { useState, useEffect } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { StatsCard } from '@/components/shared/StatsCard'
import { formatDate, titleCase } from '@/lib/utils'
import { Bug, CheckCircle2, Clock, ExternalLink, Plus, Search, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AppSelect } from '@/components/shared/AppSelect'
import type { BugSummary } from '@/lib/bugs'

interface BugStats { total: number; draft: number; reported: number }

type SortColumn = 'title' | 'feature' | 'priority' | 'status' | 'reported' | 'jira'

function priorityRank(priority: string): number {
  const m = priority.match(/P(\d)/)
  return m ? parseInt(m[1], 10) : Infinity
}

export default function BugsPage() {
  const params = useParams()
  const pathname = usePathname()
  const app = params?.app as string
  const parts = pathname?.split('/') ?? []
  const appIdx = parts.indexOf(app)
  const bugsIdx = parts.indexOf('bugs', appIdx)
  const moduleSlug = bugsIdx > appIdx + 1 ? parts[appIdx + 1] : null
  const bugsBase = moduleSlug ? `/${app}/${moduleSlug}/bugs` : `/${app}/bugs`

  const [bugs, setBugs] = useState<(BugSummary & { jira_url?: string | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterFeature, setFilterFeature] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterLayer, setFilterLayer] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [availableFeatures, setAvailableFeatures] = useState<{ name: string; module: string | null }[]>([])
  const [changingFeature, setChangingFeature] = useState<string | null>(null)

  useEffect(() => {
    const url = moduleSlug ? `/api/${app}/bugs?module=${moduleSlug}` : `/api/${app}/bugs`
    fetch(url)
      .then((r) => r.json())
      .then((data: (BugSummary & { jira_url?: string | null })[]) => { setBugs(Array.isArray(data) ? data : []); setLoading(false) })

    // Always fetch all features so we can filter per-bug by module
    fetch(`/api/${app}/features`)
      .then((r) => r.json())
      .then((data: { name: string; module?: string | null }[]) =>
        setAvailableFeatures(data.map((f) => ({ name: f.name, module: f.module ?? null })))
      )
  }, [app, moduleSlug])

  // Returns only the features in the same module as the given bug
  const featuresForBug = (bug: BugSummary) => {
    const bugModule = availableFeatures.find((f) => f.name === bug.feature)?.module ?? null
    const same = availableFeatures.filter((f) => f.module === bugModule)
    return same.length > 0 ? same : availableFeatures
  }

  const handleFeatureChange = async (bug: BugSummary & { jira_url?: string | null }, newFeature: string) => {
    if (newFeature === bug.feature) return
    const key = `${bug.feature}/${bug.slug}`
    setChangingFeature(key)
    try {
      const res = await fetch(`/api/${app}/bugs/${bug.feature}/${bug.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: newFeature }),
      })
      if (!res.ok) throw new Error('Failed')
      setBugs((prev) => prev.map((b) =>
        b.feature === bug.feature && b.slug === bug.slug ? { ...b, feature: newFeature } : b
      ))
      toast.success('Feature updated')
    } catch {
      toast.error('Failed to update feature')
    } finally {
      setChangingFeature(null)
    }
  }

  const features = [...new Set(bugs.map((b) => b.feature))].sort()
  const severities = [...new Set(bugs.map((b) => b.severity).filter(Boolean))].sort()
  const types = [...new Set(bugs.map((b) => b.bug_type).filter(Boolean))].sort()
  const layers = [...new Set(bugs.map((b) => b.layer).filter(Boolean))].sort()
  const stats: BugStats = {
    total: bugs.length,
    draft: bugs.filter((b) => b.status === 'draft').length,
    reported: bugs.filter((b) => b.status === 'reported').length,
  }

  const searchQuery = search.trim().toLowerCase()
  const filtered = bugs.filter((b) => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false
    if (filterFeature !== 'all' && b.feature !== filterFeature) return false
    if (filterPriority !== 'all' && !b.priority.includes(filterPriority)) return false
    if (filterSeverity !== 'all' && b.severity !== filterSeverity) return false
    if (filterType !== 'all' && b.bug_type !== filterType) return false
    if (filterLayer !== 'all' && b.layer !== filterLayer) return false
    if (searchQuery) {
      const haystack = [b.title, b.slug, b.feature, b.jira_key].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(searchQuery)) return false
    }
    return true
  })

  const sorted = sortColumn ? [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortColumn) {
      case 'title': cmp = a.title.localeCompare(b.title); break
      case 'feature': cmp = a.feature.localeCompare(b.feature); break
      case 'priority': cmp = priorityRank(a.priority) - priorityRank(b.priority); break
      case 'status': cmp = a.status.localeCompare(b.status); break
      case 'reported':
        // Drafts (no reported_at) always sort last, regardless of direction
        if (!a.reported_at && !b.reported_at) { cmp = 0; break }
        if (!a.reported_at) return 1
        if (!b.reported_at) return -1
        cmp = a.reported_at.localeCompare(b.reported_at)
        break
      case 'jira':
        if (!a.jira_key && !b.jira_key) cmp = 0
        else if (!a.jira_key) cmp = 1
        else if (!b.jira_key) cmp = -1
        else cmp = a.jira_key.localeCompare(b.jira_key)
        break
    }
    return sortDir === 'asc' ? cmp : -cmp
  }) : filtered

  const hasActiveFilters = filterStatus !== 'all' || filterFeature !== 'all' || filterPriority !== 'all' ||
    filterSeverity !== 'all' || filterType !== 'all' || filterLayer !== 'all' || search !== ''

  const toggleSort = (col: SortColumn) => {
    if (sortColumn !== col) { setSortColumn(col); setSortDir('asc') }
    else if (sortDir === 'asc') { setSortDir('desc') }
    else { setSortColumn(null); setSortDir('asc') }
  }

  const sortIcon = (col: SortColumn) => {
    if (sortColumn !== col) return null
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 inline ml-1" />
      : <ArrowDown className="h-3 w-3 inline ml-1" />
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
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
          <h1 className="text-2xl font-bold tracking-tight">Bug Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">{stats.total} total · {stats.draft} open · {stats.reported} reported to Jira</p>
        </div>
        <Link href={`${bugsBase}/new`} className="shrink-0">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Bug</span>
            <span className="sm:hidden">New</span>
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatsCard title="Total Bugs" value={stats.total} icon={<Bug className="h-4 w-4" />} />
        <StatsCard title="Open (Draft)" value={stats.draft} highlight={stats.draft > 0} icon={<Clock className="h-4 w-4" />} />
        <StatsCard title="Reported to Jira" value={stats.reported} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-56 flex-grow sm:flex-grow-0">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bugs..."
            className="pl-8"
          />
        </div>
        <AppSelect
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'reported', label: 'Reported' },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
          className="w-[130px]"
        />
        <AppSelect
          options={[
            { value: 'all', label: 'All Features' },
            ...features.map((f) => ({ value: f, label: titleCase(f) })),
          ]}
          value={filterFeature}
          onChange={setFilterFeature}
          className="w-[130px]"
        />
        <AppSelect
          options={[
            { value: 'all', label: 'All Priorities' },
            ...(['P1', 'P2', 'P3', 'P4'] as const).map((p) => ({ value: p, label: p })),
          ]}
          value={filterPriority}
          onChange={setFilterPriority}
          className="w-[130px]"
        />
        <AppSelect
          options={[
            { value: 'all', label: 'All Severities' },
            ...severities.map((s) => ({ value: s, label: s })),
          ]}
          value={filterSeverity}
          onChange={setFilterSeverity}
          className="w-[130px]"
        />
        <AppSelect
          options={[
            { value: 'all', label: 'All Types' },
            ...types.map((t) => ({ value: t, label: t })),
          ]}
          value={filterType}
          onChange={setFilterType}
          className="w-[130px]"
        />
        <AppSelect
          options={[
            { value: 'all', label: 'All Layers' },
            ...layers.map((l) => ({ value: l, label: titleCase(l) })),
          ]}
          value={filterLayer}
          onChange={setFilterLayer}
          className="w-[130px]"
        />
        {hasActiveFilters && (
          <button className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            onClick={() => {
              setFilterStatus('all'); setFilterFeature('all'); setFilterPriority('all')
              setFilterSeverity('all'); setFilterType('all'); setFilterLayer('all')
              setSearch('')
            }}>
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Bug Table */}
      <Card className="overflow-hidden border-border/60">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-muted-foreground">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Bug className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium">No bugs match the current filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('title')}>
                      Title{sortIcon('title')}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('feature')}>
                      Feature{sortIcon('feature')}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('priority')}>
                      Priority{sortIcon('priority')}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('status')}>
                      Status{sortIcon('status')}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden md:table-cell cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('reported')}>
                      Reported{sortIcon('reported')}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden lg:table-cell cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('jira')}>
                      Jira{sortIcon('jira')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((b) => (
                    <tr key={`${b.feature}/${b.slug}`}
                      className="border-b border-border/40 hover:bg-accent/50 transition-colors group">
                      <td className="px-4 py-3">
                        <Link href={`${bugsBase}/${b.feature}/${b.slug}`}
                          className="font-medium hover:text-primary transition-colors line-clamp-1 group-hover:underline">
                          {b.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {(() => { const opts = featuresForBug(b); return opts.length > 1 ? (
                          <AppSelect
                            variant="inline"
                            options={opts.map((f) => ({ value: f.name, label: titleCase(f.name) }))}
                            value={b.feature}
                            onChange={(v) => handleFeatureChange(b, v)}
                            disabled={changingFeature === `${b.feature}/${b.slug}`}
                            loading={changingFeature === `${b.feature}/${b.slug}`}
                          />
                        ) : (
                          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">{titleCase(b.feature)}</span>
                        )})()}
                      </td>
                      <td className="px-4 py-3"><PriorityBadge priority={b.priority} /></td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-muted-foreground text-xs">{b.bug_type || '—'}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(b.reported_at)}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {b.jira_key && b.jira_url ? (
                          <a href={b.jira_url}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            {b.jira_key} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : b.jira_key ? (
                          <span className="text-muted-foreground text-xs">{b.jira_key}</span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
