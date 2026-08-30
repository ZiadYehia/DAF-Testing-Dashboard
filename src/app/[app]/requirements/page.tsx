'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppSelect } from '@/components/shared/AppSelect'
import { ModelSelector } from '@/components/shared/ModelSelector'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileText, ChevronDown, BookOpen, LayoutList, Rows3, Plus, Sparkles, Trash2, Loader2 } from 'lucide-react'
import { useModels } from '@/hooks/useModels'

// Parse a markdown table row into cells
function parseRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-|:]+\|$/.test(line.trim())
}

const STATUS_OPTIONS = ['Not Started', 'Test Case Design', 'Execution', 'Confirmation Test', 'Done']
const PRIORITY_OPTIONS = ['P1', 'P2', 'P3', 'P4']

const STATUS_STYLES: Record<string, string> = {
  'Done':                'bg-emerald-100 text-emerald-800 border-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20',
  'Test Case Design':    'bg-amber-100 text-amber-800 border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
  'Execution':           'bg-violet-100 text-violet-800 border-violet-200/70 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/20',
  'Confirmation Test':   'bg-blue-100 text-blue-700 border-blue-200/70 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/20',
  'Not Started':         'bg-zinc-100 text-zinc-600 border-zinc-200/70 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/20',
}

const PRIORITY_STYLES: Record<string, string> = {
  P1: 'bg-red-100 text-red-700 border-red-200/70 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  P2: 'bg-orange-100 text-orange-700 border-orange-200/70 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20',
  P3: 'bg-amber-100 text-amber-700 border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
  P4: 'bg-zinc-100 text-zinc-600 border-zinc-200/70 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/20',
}

function badgeStyle(map: Record<string, string>, value: string): string {
  return map[value] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200/70 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/20'
}

interface FrProposal {
  id: string
  requirement: string
  module: string
  priority: string
  include: boolean
}

const EMPTY_ADD_FORM = { id: '', requirement: '', module: '', priority: 'P2', status: 'Not Started', storyKey: '' }


export default function RequirementsPage() {
  const params = useParams()
  const pathname = usePathname()
  const app = params?.app as string
  const parts = pathname?.split('/') ?? []
  const appIdx = parts.indexOf(app)
  const reqIdx = parts.indexOf('requirements', appIdx)
  const moduleSlug = reqIdx > appIdx + 1 ? parts[appIdx + 1] : null

  const [content, setContent] = useState<string | null>(null)
  const [rows, setRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [statusIdx, setStatusIdx] = useState(-1)
  const [priorityIdx, setPriorityIdx] = useState(-1)
  const [idIdx, setIdIdx] = useState(-1)
  const [saving, setSaving] = useState<number | null>(null)

  const [storyLinks, setStoryLinks] = useState<Record<string, string>>({})
  const [storyOptions, setStoryOptions] = useState<{ key: string; summary: string }[]>([])
  const [grouped, setGrouped] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(`req-grouped-${app}`) === '1' } catch { return false }
  })
  const [linkDialogFor, setLinkDialogFor] = useState<string | null>(null)
  const [linkDialogValue, setLinkDialogValue] = useState('')
  const [savingLink, setSavingLink] = useState<string | null>(null)
  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = localStorage.getItem(`req-collapsed-${app}`)
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [features, setFeatures] = useState<{ name: string; storyKey?: string }[]>([])

  const { models } = useModels()
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [addSaving, setAddSaving] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitStory, setSplitStory] = useState('')
  const [splitModel, setSplitModel] = useState('')
  const [splitGuidance, setSplitGuidance] = useState('')
  const [splitLoading, setSplitLoading] = useState(false)
  const [splitSaving, setSplitSaving] = useState(false)
  const [proposals, setProposals] = useState<FrProposal[] | null>(null)
  const [deleteFor, setDeleteFor] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const reqUrl = moduleSlug ? `/api/${app}/requirements?module=${moduleSlug}` : `/api/${app}/requirements`
    const res = await fetch(reqUrl)
    if (!res.ok) return
    const { content: raw } = await res.json() as { content: string }
    setContent(raw)
    const lines = raw.split('\n').filter((l: string) => l.trim().startsWith('|'))
    const tableRows = lines.filter((l: string) => !isSeparatorRow(l))
    if (tableRows.length < 2) {
      setRows([])
      return
    }
    const hdrs = parseRow(tableRows[0])
    setHeaders(hdrs)
    setStatusIdx(hdrs.findIndex((h) => h.toLowerCase().includes('status')))
    setPriorityIdx(hdrs.findIndex((h) => h.toLowerCase().includes('priority')))
    setIdIdx(hdrs.findIndex((h) => h.toLowerCase() === 'id'))
    setRows(tableRows.slice(1).map(parseRow))
  }, [app, moduleSlug])

  const loadLinks = useCallback(() => {
    fetch(`/api/${app}/requirements/story-links`)
      .then((r) => r.json())
      .then((d: { links: Record<string, string> }) => setStoryLinks(d.links ?? {}))
      .catch(() => {})
  }, [app])

  useEffect(() => {
    load()
    loadLinks()
    fetch(`/api/${app}/stories?source=local`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.stories)) setStoryOptions(d.stories) })
      .catch(() => {})
    const loadFeatures = async () => {
      // Resolve the module whose pathPrefix matches the URL segment so the
      // feature chips only show this module's features.
      let moduleParam: string | undefined
      if (moduleSlug) {
        try {
          const res = await fetch(`/api/${app}/modules`)
          if (res.ok) {
            const modules = await res.json() as { slug: string; pathPrefix: string }[]
            moduleParam = modules.find((m) => m.pathPrefix === moduleSlug)?.slug
          }
        } catch {}
      }
      try {
        const res = await fetch(`/api/${app}/features${moduleParam ? `?module=${encodeURIComponent(moduleParam)}` : ''}`)
        const d = await res.json()
        if (Array.isArray(d)) setFeatures(d.map((f: { name: string; storyKey?: string }) => ({ name: f.name, storyKey: f.storyKey })))
      } catch {}
    }
    loadFeatures()
  }, [load, loadLinks, app, moduleSlug])

  useEffect(() => {
    const firstEnabled = models.find((m) => m.enabled)
    if (firstEnabled) setSplitModel((prev) => prev || firstEnabled.id)
  }, [models])

  useEffect(() => {
    try { localStorage.setItem(`req-grouped-${app}`, grouped ? '1' : '0') } catch {}
  }, [grouped, app])

  useEffect(() => {
    try { localStorage.setItem(`req-collapsed-${app}`, JSON.stringify([...collapsedStories])) } catch {}
  }, [collapsedStories, app])

  const update = async (rowIndex: number, field: 'status' | 'priority', value: string) => {
    setSaving(rowIndex)
    setRows((prev) => prev.map((row, i) => {
      if (i !== rowIndex) return row
      const copy = [...row]
      const idx = field === 'status' ? statusIdx : priorityIdx
      copy[idx] = value
      return copy
    }))
    try {
      const res = await fetch(`/api/${app}/requirements`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, field, value, module: moduleSlug }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`${field === 'status' ? 'Status' : 'Priority'} updated`)
    } catch {
      toast.error('Failed to save change')
      load()
    }
    setSaving(null)
  }

  const saveStoryLink = async (frId: string, value: string) => {
    const prev = { ...storyLinks }
    setStoryLinks((s) => {
      const c = { ...s }
      if (value) c[frId] = value; else delete c[frId]
      return c
    })
    setSavingLink(frId)
    try {
      const res = await fetch(`/api/${app}/requirements/story-links`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frId, storyKey: value }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(value ? 'User story linked' : 'User story removed')
    } catch {
      setStoryLinks(prev)
      toast.error('Failed to save change')
    }
    setSavingLink(null)
    setLinkDialogFor(null)
  }

  const postRows = async (
    newRows: { id: string; requirement: string; module?: string; priority?: string; status?: string }[],
    storyKey: string
  ): Promise<{ added: string[]; skipped: string[] } | null> => {
    const res = await fetch(`/api/${app}/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: newRows, module: moduleSlug, storyKey: storyKey || undefined }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to add requirements')
      return null
    }
    return data as { added: string[]; skipped: string[] }
  }

  const addFr = async () => {
    if (!addForm.id.trim() || !addForm.requirement.trim()) {
      toast.error('ID and requirement are required')
      return
    }
    setAddSaving(true)
    const result = await postRows(
      [{
        id: addForm.id.trim(),
        requirement: addForm.requirement.trim(),
        module: addForm.module.trim(),
        priority: addForm.priority,
        status: addForm.status,
      }],
      addForm.storyKey
    )
    setAddSaving(false)
    if (!result) return
    if (result.added.length === 0) {
      toast.error(`${addForm.id.trim()} already exists`)
      return
    }
    toast.success(`${result.added[0]} added`)
    setAddOpen(false)
    setAddForm(EMPTY_ADD_FORM)
    load()
    loadLinks()
  }

  const runSplit = async () => {
    if (!splitStory.trim()) {
      toast.error('Pick a user story first')
      return
    }
    setSplitLoading(true)
    setProposals(null)
    try {
      const res = await fetch(`/api/${app}/requirements/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyKey: splitStory.trim(), model: splitModel, module: moduleSlug, guidance: splitGuidance }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to split story')
      const items = (data.proposals ?? []) as Omit<FrProposal, 'include'>[]
      setProposals(items.map((p) => ({ ...p, include: true })))
      if (items.length === 0) toast.info('The model returned no requirements for this story.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to split story')
    }
    setSplitLoading(false)
  }

  const saveProposals = async () => {
    const included = (proposals ?? []).filter((p) => p.include)
    if (included.length === 0) {
      toast.error('Select at least one requirement')
      return
    }
    if (included.some((p) => !p.id.trim() || !p.requirement.trim())) {
      toast.error('Every selected FR needs an ID and a requirement')
      return
    }
    setSplitSaving(true)
    const result = await postRows(
      included.map((p) => ({ id: p.id.trim(), requirement: p.requirement.trim(), module: p.module.trim(), priority: p.priority })),
      splitStory.trim()
    )
    setSplitSaving(false)
    if (!result) return
    if (result.skipped.length > 0) {
      toast.warning(`${result.added.length} added, ${result.skipped.length} skipped (duplicate IDs: ${result.skipped.join(', ')})`)
    } else {
      toast.success(`${result.added.length} FR${result.added.length !== 1 ? 's' : ''} added and linked to ${splitStory.trim()}`)
    }
    setSplitOpen(false)
    setProposals(null)
    setSplitGuidance('')
    load()
    loadLinks()
  }

  const deleteFr = async () => {
    if (!deleteFor) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/${app}/requirements`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frId: deleteFor, module: moduleSlug }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to delete requirement')
      }
      toast.success(`${deleteFor} deleted`)
      setDeleteFor(null)
      load()
      loadLinks()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete requirement')
    }
    setDeleting(false)
  }

  if (content === null) {
    return (
      <div className="space-y-4 fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const doneCount = rows.filter((r) => r[statusIdx] === 'Done').length
  const notStartedCount = rows.filter((r) => r[statusIdx] === 'Not Started').length
  const linkedCount = idIdx >= 0 ? rows.filter((r) => storyLinks[r[idIdx]]).length : 0
  const storyMap = new Map(storyOptions.map((s) => [s.key, s.summary]))
  const featuresByStory = new Map<string, string[]>()
  features.forEach((f) => {
    if (f.storyKey) {
      const arr = featuresByStory.get(f.storyKey) ?? []
      arr.push(f.name)
      featuresByStory.set(f.storyKey, arr)
    }
  })
  const colSpan = headers.length + (idIdx >= 0 ? 1 : 0) + 1

  // Build grouped buckets (preserving original row index)
  const groups = new Map<string, { row: string[]; ri: number }[]>()
  const ungrouped: { row: string[]; ri: number }[] = []
  if (grouped && idIdx >= 0) {
    rows.forEach((row, ri) => {
      const sk = storyLinks[row[idIdx]]
      if (sk) {
        const bucket = groups.get(sk) ?? []
        bucket.push({ row, ri })
        groups.set(sk, bucket)
      } else {
        ungrouped.push({ row, ri })
      }
    })
  }

  const renderRow = (cells: string[], ri: number) => (
    <tr
      key={ri}
      className={`border-b border-border/40 hover:bg-accent/50 transition-colors even:bg-muted/20 ${saving === ri ? 'opacity-60' : ''}`}
    >
      {cells.map((cell, ci) => (
        <td key={ci} className="px-4 py-3 text-sm">
          {ci === statusIdx ? (
            <AppSelect
              variant="inline"
              options={STATUS_OPTIONS.map((o) => ({ value: o, label: o, badgeClassName: badgeStyle(STATUS_STYLES, o) }))}
              value={cell}
              onChange={(v) => update(ri, 'status', v)}
              triggerBadgeClassName={badgeStyle(STATUS_STYLES, cell)}
            />
          ) : ci === priorityIdx ? (
            <AppSelect
              variant="inline"
              options={PRIORITY_OPTIONS.map((o) => ({ value: o, label: o, badgeClassName: badgeStyle(PRIORITY_STYLES, o) }))}
              value={cell}
              onChange={(v) => update(ri, 'priority', v)}
              triggerBadgeClassName={badgeStyle(PRIORITY_STYLES, cell)}
            />
          ) : (
            <span className={ci === 0 ? 'font-mono text-xs font-medium text-foreground' : 'text-foreground/80'}>{cell}</span>
          )}
        </td>
      ))}
      {idIdx >= 0 && (
        <td className={`px-4 py-3 text-sm ${savingLink === cells[idIdx] ? 'opacity-60' : ''}`}>
          {storyLinks[cells[idIdx]] ? (
            <button
              onClick={() => { setLinkDialogFor(cells[idIdx]); setLinkDialogValue(storyLinks[cells[idIdx]]) }}
              className="inline-flex items-center gap-1"
            >
              <Badge
                variant="outline"
                className="gap-1 text-[10px] font-mono px-1.5 py-0.5 text-violet-700 border-violet-200 bg-violet-50 dark:text-violet-400 dark:border-violet-800 dark:bg-violet-950/30 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <BookOpen className="h-2.5 w-2.5" />
                {storyLinks[cells[idIdx]]}
              </Badge>
            </button>
          ) : (
            <button
              onClick={() => { setLinkDialogFor(cells[idIdx]); setLinkDialogValue('') }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="h-3 w-3" /> Link story
            </button>
          )}
        </td>
      )}
      <td className="px-2 py-3 text-right">
        <button
          onClick={() => setDeleteFor(idIdx >= 0 ? cells[idIdx] : cells[0])}
          className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete requirement"
          aria-label={`Delete ${idIdx >= 0 ? cells[idIdx] : cells[0]}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Requirements</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {rows.length} functional requirements
            {idIdx >= 0 && <> · <span className={linkedCount === rows.length ? 'text-emerald-600 dark:text-emerald-400' : ''}>{linkedCount} of {rows.length} linked to stories</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setAddForm(EMPTY_ADD_FORM); setAddOpen(true) }}>
            <Plus className="h-3.5 w-3.5" /> Add FR
          </Button>
          <Button size="sm" onClick={() => { setProposals(null); setSplitOpen(true) }}>
            <Sparkles className="h-3.5 w-3.5" /> Split story (AI)
          </Button>
          {rows.length > 0 && (
            <div className="flex gap-2 text-sm">
              <Badge variant="secondary">{doneCount} Done</Badge>
              <Badge variant="outline">{notStartedCount} Not Started</Badge>
            </div>
          )}
          {idIdx >= 0 && (
            <div className="flex rounded-md border overflow-hidden ml-2">
              <button
                onClick={() => setGrouped(false)}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${!grouped ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                title="Flat table"
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setGrouped(true)}
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${grouped ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                title="Group by story"
              >
                <Rows3 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        content.trim() ? (
          <Card>
            <CardContent className="p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap">{content}</pre>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <FileText className="h-10 w-10" />
              <p className="font-medium">No requirements yet</p>
              <p className="text-sm text-center max-w-sm">
                Add a functional requirement manually, or use <span className="font-medium text-foreground">Split story (AI)</span> to
                decompose a user story into FRs.
              </p>
            </CardContent>
          </Card>
        )
      ) : (
      <Card className="overflow-hidden border-border/60">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                {headers.map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
                {idIdx >= 0 && (
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
                    User Story
                  </th>
                )}
                <th className="w-10 px-2 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {!grouped || idIdx < 0 ? (
                rows.map((cells, ri) => renderRow(cells, ri))
              ) : (
                <>
                  {Array.from(groups.entries()).map(([storyKey, items]) => {
                    const isCollapsed = collapsedStories.has(storyKey)
                    const childFeatures = featuresByStory.get(storyKey) ?? []
                    const toggleCollapse = () => setCollapsedStories((prev) => {
                      const next = new Set(prev)
                      if (next.has(storyKey)) next.delete(storyKey); else next.add(storyKey)
                      return next
                    })
                    return (
                      <Fragment key={`group-${storyKey}`}>
                        <tr
                          className="bg-muted/60 border-b border-border/40 cursor-pointer select-none hover:bg-muted/80 transition-colors"
                          onClick={toggleCollapse}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCollapse() } }}
                        >
                          <td colSpan={colSpan} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                              <BookOpen className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                              <span className="font-mono text-xs font-semibold text-violet-700 dark:text-violet-400">{storyKey}</span>
                              {storyMap.has(storyKey) && (
                                <span className="text-xs text-muted-foreground truncate">{storyMap.get(storyKey)}</span>
                              )}
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto shrink-0">
                                {items.length} FR{items.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && childFeatures.length > 0 && (
                          <tr className="border-b border-border/40 bg-violet-50/30 dark:bg-violet-950/10">
                            <td colSpan={colSpan} className="px-4 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {childFeatures.map((slug) => (
                                  <Link
                                    key={slug}
                                    href={`/${app}${moduleSlug ? `/${moduleSlug}` : ''}/features/${slug}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition-colors dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-900/30"
                                  >
                                    <LayoutList className="h-3 w-3 shrink-0" />
                                    {slug}
                                  </Link>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        {!isCollapsed && items.map(({ row, ri }) => renderRow(row, ri))}
                      </Fragment>
                    )
                  })}
                  {ungrouped.length > 0 && (
                    <>
                      {groups.size > 0 && (
                        <tr className="bg-muted/30 border-b border-border/40">
                          <td colSpan={colSpan} className="px-4 py-2">
                            <span className="text-xs text-muted-foreground">Ungrouped</span>
                          </td>
                        </tr>
                      )}
                      {ungrouped.map(({ row, ri }) => renderRow(row, ri))}
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      )}

      {/* User Story Link Dialog */}
      <Dialog open={linkDialogFor !== null} onOpenChange={(open) => !open && setLinkDialogFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {linkDialogFor && storyLinks[linkDialogFor] ? 'Change User Story' : 'Link User Story'}
            </DialogTitle>
            <DialogDescription>
              Associate <span className="font-mono text-foreground">{linkDialogFor}</span> with a user story for grouping and tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {storyOptions.length > 0 ? (
              <Select
                value={linkDialogValue || '__none__'}
                onValueChange={(v) => setLinkDialogValue(v == null || v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a user story…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {storyOptions.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.key} — {s.summary}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                type="text"
                value={linkDialogValue}
                onChange={(e) => setLinkDialogValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && linkDialogFor) saveStoryLink(linkDialogFor, linkDialogValue.trim())
                }}
                placeholder="e.g. ABC-123"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring/50"
                autoFocus
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLinkDialogFor(null)}>Cancel</Button>
            {linkDialogFor && storyLinks[linkDialogFor] && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => linkDialogFor && saveStoryLink(linkDialogFor, '')}
                disabled={savingLink !== null}
              >
                Remove
              </Button>
            )}
            <Button
              onClick={() => linkDialogFor && saveStoryLink(linkDialogFor, linkDialogValue.trim())}
              disabled={savingLink !== null}
            >
              {savingLink !== null ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add FR Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => !open && setAddOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Functional Requirement</DialogTitle>
            <DialogDescription>
              Append a new FR row to the requirements table{moduleSlug ? ` for the ${moduleSlug} module` : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">FR ID</label>
              <Input
                value={addForm.id}
                onChange={(e) => setAddForm((f) => ({ ...f, id: e.target.value }))}
                placeholder="e.g. AM_FR_CREATE_09"
                className="font-mono"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Requirement</label>
              <Textarea
                value={addForm.requirement}
                onChange={(e) => setAddForm((f) => ({ ...f, requirement: e.target.value }))}
                placeholder="One verifiable capability or rule…"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Module</label>
                <Input
                  value={addForm.module}
                  onChange={(e) => setAddForm((f) => ({ ...f, module: e.target.value }))}
                  placeholder="e.g. Orders List"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <AppSelect
                  options={PRIORITY_OPTIONS.map((o) => ({ value: o, label: o }))}
                  value={addForm.priority}
                  onChange={(v) => setAddForm((f) => ({ ...f, priority: v }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <AppSelect
                  options={STATUS_OPTIONS.map((o) => ({ value: o, label: o }))}
                  value={addForm.status}
                  onChange={(v) => setAddForm((f) => ({ ...f, status: v }))}
                  className="w-full"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Link to user story (optional)</label>
              {storyOptions.length > 0 ? (
                <Select
                  value={addForm.storyKey || '__none__'}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, storyKey: v == null || v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a user story…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {storyOptions.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.key} — {s.summary}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={addForm.storyKey}
                  onChange={(e) => setAddForm((f) => ({ ...f, storyKey: e.target.value }))}
                  placeholder="e.g. ABC-123"
                  className="font-mono"
                />
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addFr} disabled={addSaving}>
              {addSaving ? 'Adding…' : 'Add FR'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Split Dialog */}
      <Dialog open={splitOpen} onOpenChange={(open) => { if (!open) { setSplitOpen(false); setProposals(null) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" /> Split Story into FRs
            </DialogTitle>
            <DialogDescription>
              AI proposes functional requirements from a user story. Review and edit before adding — new FRs are
              automatically linked to the story.
            </DialogDescription>
          </DialogHeader>

          {proposals === null ? (
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">User story</label>
                {storyOptions.length > 0 ? (
                  <Select value={splitStory || undefined} onValueChange={(v) => { if (v) setSplitStory(v) }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a user story…" />
                    </SelectTrigger>
                    <SelectContent>
                      {storyOptions.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.key} — {s.summary}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={splitStory}
                    onChange={(e) => setSplitStory(e.target.value)}
                    placeholder="e.g. ABC-123 (fetched live from Jira if not cached)"
                    className="font-mono"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">AI model</label>
                <ModelSelector models={models} value={splitModel} onChange={setSplitModel} size="sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Guidance (optional)</label>
                <Textarea
                  value={splitGuidance}
                  onChange={(e) => setSplitGuidance(e.target.value)}
                  placeholder="e.g. focus on validation rules; skip anything already covered by AM_FR_CREATE_*"
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 py-1">
              <p className="text-xs text-muted-foreground">
                {proposals.filter((p) => p.include).length} of {proposals.length} selected — uncheck any you don&apos;t want, or edit inline.
              </p>
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {proposals.map((p, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 space-y-2 transition-opacity ${p.include ? 'border-border' : 'border-border/40 opacity-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.include}
                        onChange={(e) => setProposals((prev) => prev!.map((x, xi) => xi === i ? { ...x, include: e.target.checked } : x))}
                        className="h-4 w-4 accent-primary shrink-0"
                        aria-label={`Include ${p.id}`}
                      />
                      <Input
                        value={p.id}
                        onChange={(e) => setProposals((prev) => prev!.map((x, xi) => xi === i ? { ...x, id: e.target.value } : x))}
                        className="font-mono h-7 text-xs w-52"
                        disabled={!p.include}
                      />
                      <Input
                        value={p.module}
                        onChange={(e) => setProposals((prev) => prev!.map((x, xi) => xi === i ? { ...x, module: e.target.value } : x))}
                        className="h-7 text-xs w-36"
                        placeholder="Module"
                        disabled={!p.include}
                      />
                      <AppSelect
                        options={PRIORITY_OPTIONS.map((o) => ({ value: o, label: o, badgeClassName: badgeStyle(PRIORITY_STYLES, o) }))}
                        value={p.priority}
                        onChange={(v) => setProposals((prev) => prev!.map((x, xi) => xi === i ? { ...x, priority: v } : x))}
                        variant="inline"
                        triggerBadgeClassName={badgeStyle(PRIORITY_STYLES, p.priority)}
                        disabled={!p.include}
                      />
                    </div>
                    <Textarea
                      value={p.requirement}
                      onChange={(e) => setProposals((prev) => prev!.map((x, xi) => xi === i ? { ...x, requirement: e.target.value } : x))}
                      rows={2}
                      className="text-sm"
                      disabled={!p.include}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {proposals === null ? (
              <>
                <Button variant="outline" onClick={() => setSplitOpen(false)}>Cancel</Button>
                <Button onClick={runSplit} disabled={splitLoading || !splitStory.trim() || !splitModel}>
                  {splitLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Splitting…</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> Generate FRs</>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setProposals(null)} disabled={splitSaving}>Back</Button>
                <Button onClick={saveProposals} disabled={splitSaving || proposals.filter((p) => p.include).length === 0}>
                  {splitSaving
                    ? 'Adding…'
                    : `Add ${proposals.filter((p) => p.include).length} FR${proposals.filter((p) => p.include).length !== 1 ? 's' : ''}`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete FR Dialog */}
      <Dialog open={deleteFor !== null} onOpenChange={(open) => !open && setDeleteFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Requirement</DialogTitle>
            <DialogDescription>
              Remove <span className="font-mono text-foreground">{deleteFor}</span> from the requirements table?
              Its user-story link is removed too. Test cases that reference this FR ID are not changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteFr} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
