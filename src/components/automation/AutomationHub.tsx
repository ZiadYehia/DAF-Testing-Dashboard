'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ModelSelector } from '@/components/shared/ModelSelector'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Bot, Play, Plus, Save, Trash2, Film, FileArchive, Loader2, CheckCircle2,
  XCircle, FlaskConical, MessageSquare, Tag, X, Folder, ChevronDown, ChevronRight,
  Bug, Link2, Search, ArrowLeftRight, Download,
} from 'lucide-react'
import { ApiConsole } from './ApiConsole'
import { cn } from '@/lib/utils'
import { useModels } from '@/hooks/useModels'
import { useApp } from '@/lib/use-apps'
import { type AutomationEngine, isBrowserEngine } from '@automation-hub/types'
import { AutomationBugDialog } from './AutomationBugDialog'
import { SpecEditor } from './SpecEditor'
import { useArtifactFiles } from './useArtifactFiles'
import { useChatSession } from './useChatSession'
import { ChatAuthoringTab } from './ChatAuthoringTab'
import { SpecTab, type PageFile } from './SpecTab'
import { NewAutomationDialog } from './NewAutomationDialog'
import { FlakyBadge, StatusPill, isFlaky, type RunStatus, type RunRecord } from './statusBadges'
import { toast } from 'sonner'

interface LinkedTestcase {
  app: string
  feature: string
  testcaseId: string
}

interface ProjectMeta {
  name: string
  title: string
  app?: string
  createdVia: string
  linkedTestcaseId: string | null
  linkedTestcase?: LinkedTestcase | null
  createdAt: string
  lastStatus: RunStatus
  runs: RunRecord[]
  tags?: string[]
  folder?: string | null
  engine?: AutomationEngine
  appium?: { apkPath?: string; appPackage?: string; appActivity?: string; avd?: string; udid?: string; noReset?: boolean }
}

interface ProjectDetail extends ProjectMeta {
  spec: string
  pySpec?: string | null
  pythonEnabled?: boolean
  pageFiles?: PageFile[]
  tsPageFiles?: PageFile[]
  frameworkFiles?: PageFile[]
}

export function AutomationHub({ app }: { app: string }) {
  const [projects, setProjects] = useState<ProjectMeta[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  // Appium's flat test.appium.mjs — Playwright/TS specs go through `tsFiles` below instead.
  const [specDraft, setSpecDraft] = useState('')
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  // ── TS artifact (test.spec.ts + shared pages/<app>/*.page.ts + locked framework files) ──
  const [specLang, setSpecLang] = useState<'ts' | 'py'>('ts')
  const tsFiles = useArtifactFiles({ testContent: '', files: [] })
  const [savingTs, setSavingTs] = useState(false)
  const [savingTsFile, setSavingTsFile] = useState<string | null>(null)
  // The one page the test imports (one-page-per-test rule) — secondary page chips collapse behind it.
  const tsPrimaryPages = useMemo(
    () => [...tsFiles.testDraft.matchAll(/from\s+['"]\.\.\/\.\.\/(pages\/[^'"]+)['"]/g)].map((m) => `${m[1]}.ts`),
    [tsFiles.testDraft],
  )
  // ── Python artifact (generated test + shared page files) — separate draft/save/translate/improve state from TS ──
  const [translating, setTranslating] = useState(false)
  const [savingPy, setSavingPy] = useState(false)
  const [improvingPy, setImprovingPy] = useState(false)
  const pyFiles = useArtifactFiles({ testContent: '', files: [] })
  const [savingPageFile, setSavingPageFile] = useState<string | null>(null)
  // Python analog: the test method's single page fixture (e.g. item_create_page → pages/<app>/<page>_page.py).
  const pyPrimaryPages = useMemo(() => {
    const fixture = pyFiles.testDraft.match(/def\s+test_\w+\s*\(\s*self\s*,\s*(\w+)/)?.[1]
    return fixture ? pyFiles.files.filter((f) => f.path.endsWith(`/${fixture}.py`)).map((f) => f.path) : []
  }, [pyFiles.testDraft, pyFiles.files])
  const [runLog, setRunLog] = useState<string | null>(null)
  // Declared up here (not beside the rest of the Folders section below) so
  // `loadDetail` can seed it without a use-before-declare ordering hazard.
  const [folderDraft, setFolderDraft] = useState('')

  const base = `/api/${app}/automation`
  // Web apps automate via Playwright, mobile via Appium, API apps via the browserless
  // `api` engine. Only `desktop`/unknown keeps the engine choice visible — for the rest,
  // offering a choice invites picking one that cannot work against that app.
  const appConfig = useApp(app)
  const lockedEngine: AutomationEngine | null =
    appConfig?.type === 'web' ? 'playwright'
      : appConfig?.type === 'mobile' ? 'appium'
        : appConfig?.type === 'api' ? 'api'
          : null
  // MCP chat drives a real browser, so it does not apply to an API app.
  const chatAvailable = lockedEngine !== 'api'
  const isApiApp = lockedEngine === 'api'
  /**
   * Which run the API console reads its exchanges from.
   *
   * Seeded from the newest run of the selected project, so opening the console shows the last
   * thing that happened rather than an empty panel asking the user to go and find a run.
   */
  const [consoleRunTs, setConsoleRunTs] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    const res = await fetch(base)
    if (res.ok) setProjects(await res.json())
  }, [base])

  const loadDetail = useCallback(async (name: string) => {
    setRunLog(null)
    const res = await fetch(`${base}/${name}`)
    if (res.ok) {
      const d: ProjectDetail = await res.json()
      setDetail(d)
      setSpecDraft(d.spec)
      tsFiles.resetFrom(d.spec, d.tsPageFiles ?? [])
      pyFiles.resetFrom(d.pySpec ?? '', d.pageFiles ?? [])
      setFolderDraft(d.folder ?? '')
      // Point the API console at the newest run that actually recorded something, so opening
      // the tab shows the last exchange instead of an empty panel.
      setConsoleRunTs((d.runs ?? []).find((r) => r.hasApiLog)?.ts ?? null)
    }
  }, [base])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { if (selected) { setSpecLang('ts'); loadDetail(selected) } }, [selected, loadDetail])

  async function runSelected() {
    if (!selected) return
    setRunning(true)
    setRunLog(null)
    setSyncNote(null)
    try {
      const res = await fetch(`${base}/${selected}/run`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setRunLog(data?.error ?? 'Run failed'); return }
      if (data.status === 'fail' && data.log) setRunLog(data.log)
      if (data.synced) setSyncNote(`Synced ${data.synced.testcaseId} → ${data.synced.status} on the dashboard`)
      await Promise.all([loadList(), loadDetail(selected)])
    } finally {
      setRunning(false)
    }
  }

  // Phase 5: replay a list of automations in sequence (regression run).
  async function runList(list: ProjectMeta[], scope: string | null) {
    if (runningAll || list.length === 0) return
    setRunningAll(true)
    setAllSummary(null)
    let pass = 0, fail = 0
    for (const p of list) {
      try {
        const res = await fetch(`${base}/${p.name}/run`, { method: 'POST' })
        const d = await res.json()
        if (res.ok && d.status === 'pass') pass++; else fail++
      } catch { fail++ }
      await loadList()
    }
    setRunningAll(false)
    setAllSummary(`${pass} passed · ${fail} failed${scope ? ` (${scope})` : ''}`)
    if (selected) loadDetail(selected)
  }

  // Phase 5: self-heal — ask AI to fix a failing spec from its run output, then replay.
  async function selfHeal() {
    if (!selected || !runLog) return
    setHealing(true)
    try {
      const res = await fetch(`${base}/${selected}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chatModel,
          instruction: `This Playwright test just failed. Fix the spec so it passes, keeping resilient locators. Here is the failure output:\n\n${runLog.slice(-3000)}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setRunLog(`${runLog}\n\n⚠️ AI fix failed: ${data?.error ?? ''}`); return }
      tsFiles.applyServerResult({ test: data.spec, files: data.tsPageFiles })
      await loadDetail(selected)
      tsFiles.applyServerResult({ touchedPages: data.touchedPages ?? [] })
      await runSelected() // re-run to confirm the fix
    } finally {
      setHealing(false)
    }
  }

  // Appium's flat test.appium.mjs (no page-file concept).
  async function saveSpec() {
    if (!selected) return
    setSaving(true)
    try {
      await fetch(`${base}/${selected}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: specDraft }),
      })
      await loadDetail(selected)
    } finally {
      setSaving(false)
    }
  }

  // Saves whichever TS chip is currently active — the test file, or one shared page file.
  async function saveTsFile() {
    if (!selected) return
    if (tsFiles.activeIsTest) {
      setSavingTs(true)
      try {
        await fetch(`${base}/${selected}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spec: tsFiles.testDraft }),
        })
        await loadDetail(selected)
      } finally {
        setSavingTs(false)
      }
    } else {
      const path = tsFiles.active
      setSavingTsFile(path)
      try {
        await fetch(`${base}/${selected}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tsPageFile: { path, content: tsFiles.pageDrafts[path] ?? '' } }),
        })
        await loadDetail(selected)
      } finally {
        setSavingTsFile(null)
      }
    }
  }

  // Saves whichever Python chip is currently active — the test file, or one shared page file.
  async function savePyFile() {
    if (!selected) return
    if (pyFiles.activeIsTest) {
      setSavingPy(true)
      try {
        await fetch(`${base}/${selected}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pySpec: pyFiles.testDraft }),
        })
        await loadDetail(selected)
      } finally {
        setSavingPy(false)
      }
    } else {
      const path = pyFiles.active
      setSavingPageFile(path)
      try {
        await fetch(`${base}/${selected}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageFile: { path, content: pyFiles.pageDrafts[path] ?? '' } }),
        })
        await loadDetail(selected)
      } finally {
        setSavingPageFile(null)
      }
    }
  }

  // Generate/regenerate the Python pair (test file + shared page files) from the current TS spec.
  async function translateSpec(confirmOverwrite: boolean) {
    if (!selected) return
    if (confirmOverwrite) {
      const testDirty = pyFiles.testDraft.trim() && pyFiles.testDraft !== (detail?.pySpec ?? '')
      const pageDirty = pyFiles.files.some((f) => pyFiles.pageDrafts[f.path] !== f.content)
      if ((testDirty || pageDirty) &&
          !window.confirm('This will overwrite your unsaved Python edits (test file and/or shared page files) with a fresh translation. Continue?')) return
    }
    setTranslating(true)
    try {
      const res = await fetch(`${base}/${selected}/translate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'Failed to generate Python spec'); return }
      pyFiles.applyServerResult({ test: data.pySpec, files: data.pageFiles })
      await loadDetail(selected)
      pyFiles.applyServerResult({ touchedPages: data.touchedPages ?? [] })
    } finally {
      setTranslating(false)
    }
  }

  function downloadPySpec() {
    if (!selected) return
    const isTest = pyFiles.activeIsTest
    const filename = isTest
      ? `test_${selected.replace(/[^a-zA-Z0-9]+/g, '_')}.py`
      : (pyFiles.active.split('/').pop() ?? 'page.py')
    const content = pyFiles.activeContent
    const blob = new Blob([content], { type: 'text/x-python' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  /** After a new project is scaffolded — refresh the list and select it. */
  async function onProjectCreated(name: string, pyWarning?: string) {
    await loadList()
    setSelected(name)
    if (pyWarning) toast.warning(pyWarning)
  }

  async function deleteSelected() {
    if (!selected) return
    await fetch(`${base}/${selected}`, { method: 'DELETE' })
    setSelected(null)
    setDetail(null)
    await loadList()
  }

  // ── MCP Chat ─────────────────────────────────────────────────────────────
  const { models } = useModels()
  const [chatModel, setChatModel] = useState<string>('')
  const [activeTab, setActiveTab] = useState('automations')
  // Owns the live browser/Android session — instantiated here (not inside the
  // chat tab's panel) so it survives switching away from the chat tab, since
  // base-ui's Tabs unmount inactive panels.
  const session = useChatSession({
    base,
    chatModel,
    lockedEngine,
    onSaved: async (name, pyWarning) => {
      await loadList()
      setSelected(name)
      setActiveTab('automations')
      if (pyWarning) toast.warning(pyWarning)
    },
  })

  // ── Phase 4: link to dashboard test cases ───────────────────────────────
  const [testcases, setTestcases] = useState<{ feature: string; id: string; objective: string; steps: string }[]>([])
  const [tcOpen, setTcOpen] = useState(false)
  const [tcFilter, setTcFilter] = useState('')
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const [tcMode, setTcMode] = useState<'chat' | 'generate'>('chat')
  // 'create' = author a new automation from the case; 'link' = attach the case to the selected project.
  const [tcIntent, setTcIntent] = useState<'create' | 'link'>('create')
  const [generating, setGenerating] = useState<string | null>(null)
  const [aiInstruction, setAiInstruction] = useState('')
  const [improving, setImproving] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [runningAll, setRunningAll] = useState(false)
  const [allSummary, setAllSummary] = useState<string | null>(null)
  const [healing, setHealing] = useState(false)

  // ── Tags: filter the list and slice "Run all" (smoke / per-module / …) ──
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [tagDraft, setTagDraft] = useState('')
  const [savingTags, setSavingTags] = useState(false)

  const allTags = useMemo(
    () => [...new Set(projects.flatMap((p) => p.tags ?? []))].sort(),
    [projects],
  )

  // ── Search + status chips: instant client-side filter over the list ────
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'all'>('all')
  const searchActive = searchQuery.trim().length > 0
  const filtersActive = searchActive || statusFilter !== 'all' || !!tagFilter

  const visibleProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return projects.filter((p) => {
      if (tagFilter && !(p.tags ?? []).includes(tagFilter)) return false
      if (statusFilter !== 'all' && p.lastStatus !== statusFilter) return false
      if (q) {
        const haystack = [p.title, ...(p.tags ?? []), p.linkedTestcaseId ?? ''].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [projects, tagFilter, statusFilter, searchQuery])

  // "Run all" honors the active tag/search/status filters, so running while filtered = a scoped run.
  const runAll = () => runList(visibleProjects, tagFilter ? `tag: ${tagFilter}` : filtersActive ? 'filtered' : null)

  // ── Folders: file automations into suites; the list groups by folder ──
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})

  const allFolders = useMemo(
    () => [...new Set(projects.map((p) => p.folder?.trim() || '').filter(Boolean))].sort(),
    [projects],
  )

  /** Folder name → total project count (unfiltered) — drives the default-collapsed rule. */
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of projects) {
      const key = p.folder?.trim() || ''
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [projects])

  const folderStorageKey = `automation-folders-${app}`

  // Folders with more than 8 projects start collapsed; smaller ones stay open.
  // A user's explicit toggle (persisted in localStorage) always wins on reload.
  useEffect(() => {
    if (folderCounts.size === 0) return
    let stored: Record<string, boolean> = {}
    try {
      stored = JSON.parse(localStorage.getItem(folderStorageKey) ?? '{}')
    } catch { /* ignore malformed storage */ }
    setCollapsedFolders((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [folder, count] of folderCounts) {
        if (next[folder] === undefined) {
          next[folder] = stored[folder] !== undefined ? stored[folder] : count > 8
          changed = true
        }
      }
      return changed ? next : prev
    })

  }, [folderCounts, folderStorageKey])

  function toggleFolder(name: string) {
    setCollapsedFolders((c) => {
      const next = { ...c, [name]: !c[name] }
      try { localStorage.setItem(folderStorageKey, JSON.stringify(next)) } catch { /* ignore quota errors */ }
      return next
    })
  }

  /** [folderName, projects][] — folders alphabetically, unfiled ('') last. */
  const grouped = useMemo(() => {
    const map = new Map<string, ProjectMeta[]>()
    for (const p of visibleProjects) {
      const key = p.folder?.trim() || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
    )
  }, [visibleProjects])

  /** PUT a partial meta update (tags / folder / linkedTestcase) and refresh. */
  async function patchProject(body: Record<string, unknown>) {
    if (!selected) return
    setSavingTags(true)
    try {
      await fetch(`${base}/${selected}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await Promise.all([loadList(), loadDetail(selected)])
    } finally {
      setSavingTags(false)
    }
  }

  const saveTags = (next: string[]) => patchProject({ tags: next })

  function addTag() {
    const tag = tagDraft.trim().toLowerCase()
    if (!tag || !detail) return
    setTagDraft('')
    if ((detail.tags ?? []).includes(tag)) return
    saveTags([...(detail.tags ?? []), tag])
  }

  function saveFolder() {
    if (!detail) return
    const next = folderDraft.trim() || null
    if (next === (detail.folder ?? null)) return
    patchProject({ folder: next })
  }

  // ── Bug reporting from a replay failure (linked to the test case when set) ──
  const [bugOpen, setBugOpen] = useState(false)

  // Per-app AI gate (Settings → AI & Models). Disables chat/generate/edit when off.
  useEffect(() => {
    fetch(`/api/${app}/ai-features`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const cfg = d?.features?.automationHub
        if (cfg) {
          setAiEnabled(cfg.enabled !== false)
          if (cfg.defaultModel) setChatModel(cfg.defaultModel)
        }
      })
      .catch(() => {})
  }, [base])

  useEffect(() => {
    if (tcOpen && testcases.length === 0) {
      fetch(`${base}/testcases`).then((r) => (r.ok ? r.json() : [])).then(setTestcases).catch(() => {})
    }
  }, [tcOpen, testcases.length, base])

  /** Link an existing project to a test case picked in the dialog (execution-sync target). */
  async function linkTestcase(tc: { feature: string; id: string }) {
    setTcOpen(false)
    await patchProject({ linkedTestcase: { feature: tc.feature, testcaseId: tc.id } })
    setSyncNote(`Linked ${tc.id} — replays will sync its execution status`)
  }

  function startFromTestcase(tc: { feature: string; id: string; objective: string; steps: string }) {
    session.beginFromTestcase(tc)
    setActiveTab('chat')
    setTcOpen(false)
  }

  async function generateFromTestcase(tc: { feature: string; id: string; objective: string }) {
    setGenerating(`${tc.feature}-${tc.id}`)
    try {
      const res = await fetch(`${base}/testcases/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: tc.feature, testcaseId: tc.id, title: `${tc.id} — ${tc.objective}`.slice(0, 80), model: chatModel }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data?.error ?? 'Failed to generate'); return }
      setTcOpen(false)
      await loadList()
      setSelected(data.name)
      setActiveTab('automations')
    } finally {
      setGenerating(null)
    }
  }

  async function improveSpec() {
    if (!selected || !aiInstruction.trim()) return
    setImproving(true)
    try {
      const res = await fetch(`${base}/${selected}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: aiInstruction, model: chatModel }),
      })
      const data = await res.json()
      if (!res.ok) { setRunLog(data?.error ?? 'AI revise failed'); return }
      tsFiles.applyServerResult({ test: data.spec, files: data.tsPageFiles })
      setAiInstruction('')
      await loadDetail(selected)
      tsFiles.applyServerResult({ touchedPages: data.touchedPages ?? [] })
    } finally {
      setImproving(false)
    }
  }

  async function improvePySpec() {
    if (!selected || !aiInstruction.trim()) return
    setImprovingPy(true)
    try {
      const res = await fetch(`${base}/${selected}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: aiInstruction, model: chatModel, language: 'py' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data?.error ?? 'AI revise failed'); return }
      pyFiles.applyServerResult({ test: data.pySpec, files: data.pageFiles })
      setAiInstruction('')
      await loadDetail(selected)
      pyFiles.applyServerResult({ touchedPages: data.touchedPages ?? [] })
    } finally {
      setImprovingPy(false)
    }
  }

  useEffect(() => {
    // Default to the first enabled Claude model (only Claude does the tool-loop).
    const firstClaude = models.find((m) => m.provider === 'anthropic' && m.enabled)
    if (firstClaude) setChatModel(firstClaude.id)
  }, [models])

  const latestVideo = detail?.runs.find((r) => r.hasVideo)
  const videoFileName = detail?.engine === 'appium' ? 'video.mp4' : 'video.webm'
  // Appium's flat spec — dirty/saving are relative to `specDraft` only (no page-file concept there).
  const dirty = detail !== null && specDraft !== detail.spec
  // TS/Python dirty+saving are relative to whichever chip is active — owned by the `tsFiles`/`pyFiles` hooks.
  const tsSaving = tsFiles.activeIsTest ? savingTs : savingTsFile === tsFiles.active
  const pySaving = pyFiles.activeIsTest ? savingPy : savingPageFile === pyFiles.active

  const modelName = models.find((m) => m.id === chatModel)?.name ?? 'No model selected'

  const projectCard = (p: ProjectMeta) => {
    const accent = p.lastStatus === 'pass' ? 'before:bg-emerald-500'
      : p.lastStatus === 'fail' ? 'before:bg-red-500' : 'before:bg-border'
    const SourceIcon = p.createdVia === 'chat' ? MessageSquare : p.createdVia === 'testcase' ? FlaskConical : Plus
    return (
      <Card
        key={p.name}
        onClick={() => setSelected(p.name)}
        className={cn(
          'relative cursor-pointer overflow-hidden border-border/60 pl-1 transition-all hover:border-primary/50 hover:bg-primary/[0.04]',
          'before:absolute before:inset-y-0 before:left-0 before:w-1', accent,
          selected === p.name && 'border-primary bg-primary/[0.06] shadow-sm',
        )}
      >
        <CardContent className="space-y-1.5 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-medium leading-snug">{p.title}</h3>
            <StatusPill status={p.lastStatus} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><SourceIcon className="h-3 w-3" />{p.createdVia}</span>
            <span>·</span>
            <span>{p.runs.length > 0 ? `${p.runs.length} run${p.runs.length > 1 ? 's' : ''}` : 'not run'}</span>
            {isFlaky(p.runs) && <FlakyBadge />}
            {p.linkedTestcaseId && (
              <Badge variant="outline" className="ml-auto font-mono text-[10px]">{p.linkedTestcaseId}</Badge>
            )}
          </div>
          {(p.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {p.tags!.map((t) => (
                <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold leading-tight">
              Automation Hub
              {/* An API app behaves differently enough — no browser, no video, an editable
                  request console instead — that saying so up front saves the confusion of
                  looking for a trace that a browserless run never produces. */}
              {isApiApp && (
                <Badge variant="secondary" className="gap-1 text-[10px] uppercase tracking-wide">
                  <ArrowLeftRight className="h-3 w-3" /> API edition
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isApiApp
                ? 'Replay API cases, read every request and response, and edit one before sending it again.'
                : 'Author, replay & edit Playwright tests — recorded with video & trace.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Bot className="h-3 w-3" /> AI model · chat, generate &amp; edits
          </span>
          <ModelSelector models={models} value={chatModel} onChange={setChatModel} size="sm" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line">
          <TabsTrigger value="automations">
            <FlaskConical /> Automations
          </TabsTrigger>
          {chatAvailable && (
            <TabsTrigger value="chat">
              <MessageSquare /> MCP Chat
            </TabsTrigger>
          )}
          {isApiApp && (
            <TabsTrigger value="api-console">
              <ArrowLeftRight /> API Console
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Automations ───────────────────────────────────────────────── */}
        <TabsContent value="automations" className="pt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            {/* List — its own scroll container so the detail pane stays put while this scrolls */}
            <div className="lg:h-[calc(100vh-230px)] lg:overflow-y-auto lg:pr-1">
            {/* Sticky controls: header, search, filters — stay put while folders scroll beneath */}
            <div className="sticky top-0 z-10 space-y-2 bg-background pb-2">
              <div className="flex items-center justify-between px-0.5 pb-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Automations</h2>
                  {projects.length > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {filtersActive ? `${visibleProjects.length}/${projects.length}` : projects.length}
                    </span>
                  )}
                </div>
                {projects.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={runAll} disabled={runningAll} className="h-7 gap-1.5 text-xs">
                    {runningAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {runningAll ? 'Running…' : tagFilter ? `Run "${tagFilter}"` : filtersActive ? 'Run filtered' : 'Run all'}
                  </Button>
                )}
              </div>
              {projects.length > 0 && (
                <div className="relative px-0.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search title, tag, or test case ID…"
                    className="h-8 pl-7 pr-7 text-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              {projects.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 px-0.5">
                  {([
                    { key: 'all', label: 'All' },
                    { key: 'pass', label: 'Passing' },
                    { key: 'fail', label: 'Failing' },
                    { key: 'never_run', label: 'Never run' },
                  ] as const).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setStatusFilter(s.key)}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                        statusFilter === s.key
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {allTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 px-0.5">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  {allTags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTagFilter((cur) => (cur === t ? null : t))}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                        tagFilter === t
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {allSummary && (
                <div className="rounded-md bg-muted px-2 py-1.5 text-center text-xs text-muted-foreground">
                  Regression: <span className="font-medium text-foreground">{allSummary}</span>
                </div>
              )}
              <NewAutomationDialog base={base} app={app} lockedEngine={lockedEngine} onCreated={onProjectCreated} />

              <Dialog open={tcOpen} onOpenChange={setTcOpen}>
                <DialogTrigger render={
                  <Button variant="outline" className="w-full gap-2" disabled={!aiEnabled} title={aiEnabled ? undefined : 'AI is disabled for this app (Settings → AI & Models)'} onClick={() => setTcIntent('create')}>
                    <FlaskConical className="h-4 w-4" /> Automate a test case
                  </Button>
                } />
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{tcIntent === 'link' ? 'Link a test case' : 'Automate a test case'}</DialogTitle>
                    <DialogDescription>
                      {tcIntent === 'link'
                        ? `Attach a test case to “${detail?.title ?? 'this automation'}” — replays will sync its pass/fail to the dashboard.`
                        : 'Pick a test case to author in chat. Its pass/fail will sync back to the dashboard once replayed.'}
                    </DialogDescription>
                  </DialogHeader>
                  {tcIntent === 'create' && (
                    <div className="flex rounded-md border p-0.5 text-xs">
                      <button
                        onClick={() => setTcMode('chat')}
                        className={cn('flex-1 rounded px-2 py-1.5 font-medium transition-colors', tcMode === 'chat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                      >
                        Author in chat (drives a browser)
                      </button>
                      <button
                        onClick={() => setTcMode('generate')}
                        className={cn('flex-1 rounded px-2 py-1.5 font-medium transition-colors', tcMode === 'generate' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                      >
                        Generate directly (no browser)
                      </button>
                    </div>
                  )}
                  <Input placeholder="Filter by ID, objective, or feature…" value={tcFilter} onChange={(e) => setTcFilter(e.target.value)} autoFocus />
                  {testcases.length > 0 && (
                    <p className="px-0.5 text-xs text-muted-foreground">
                      {testcases.length} test cases (latest version) ·{' '}
                      {tcIntent === 'link' ? 'pick the case this automation covers' : tcMode === 'chat' ? 'pick one to author in chat' : 'pick one to generate a spec instantly'}
                    </p>
                  )}
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {testcases.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No test cases found for this app.</p>}
                    {testcases
                      .filter((tc) => {
                        const q = tcFilter.toLowerCase()
                        return !q || tc.id.toLowerCase().includes(q) || tc.objective.toLowerCase().includes(q) || tc.feature.toLowerCase().includes(q)
                      })
                      .map((tc) => (
                        <button
                          key={`${tc.feature}-${tc.id}`}
                          disabled={!!generating}
                          onClick={() =>
                            tcIntent === 'link' ? linkTestcase(tc)
                            : tcMode === 'chat' ? startFromTestcase(tc)
                            : generateFromTestcase(tc)
                          }
                          className="flex w-full flex-col items-start gap-0.5 rounded-md border border-border/60 p-2 text-left text-sm hover:border-primary/50 hover:bg-primary/[0.04] disabled:opacity-50"
                        >
                          <span className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-[10px]">{tc.id}</Badge>
                            <span className="text-xs text-muted-foreground">{tc.feature}</span>
                            {generating === `${tc.feature}-${tc.id}` && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                          </span>
                          <span className="line-clamp-2 text-xs">{tc.objective}</span>
                        </button>
                      ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {/* end sticky controls */}

            {projects.length === 0 && (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                No automations yet. Create one to get started.
              </p>
            )}
            {projects.length > 0 && visibleProjects.length === 0 && (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                {searchActive
                  ? `No automations match “${searchQuery.trim()}”.`
                  : statusFilter !== 'all'
                  ? 'No automations match this status.'
                  : `No automations tagged “${tagFilter}”.`}
              </p>
            )}

            {/* Suite folders first (collapsible, each runnable), unfiled projects last */}
            <div className="space-y-2 pt-2">
              {grouped.map(([folderName, list]) => {
                if (folderName === '') {
                  return (
                    <div key="__unfiled" className="space-y-2">
                      {grouped.length > 1 && (
                        <p className="px-0.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                          Unfiled
                        </p>
                      )}
                      {list.map(projectCard)}
                    </div>
                  )
                }
                const isCollapsed = filtersActive ? false : !!collapsedFolders[folderName]
                const passCount = list.filter((p) => p.lastStatus === 'pass').length
                const failCount = list.filter((p) => p.lastStatus === 'fail').length
                const neverCount = list.filter((p) => p.lastStatus === 'never_run').length
                return (
                  <div key={folderName} className="space-y-2">
                    <div className="flex items-center justify-between gap-1 px-0.5 pt-1">
                      <button
                        onClick={() => toggleFolder(folderName)}
                        className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary"
                      >
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                        <Folder className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                        <span className="truncate">{folderName}</span>
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{list.length}</span>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className="hidden items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground sm:flex"
                          title={`${passCount} passing · ${failCount} failing · ${neverCount} never run`}
                        >
                          {passCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{passCount}
                            </span>
                          )}
                          {failCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{failCount}
                            </span>
                          )}
                          {neverCount > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-border" />{neverCount}
                            </span>
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runList(list, `folder: ${folderName}`)}
                          disabled={runningAll}
                          className="h-6 gap-1 px-1.5 text-[11px]"
                          title={`Run all automations in "${folderName}"`}
                        >
                          <Play className="h-3 w-3" /> Run
                        </Button>
                      </div>
                    </div>
                    {!isCollapsed && list.map(projectCard)}
                  </div>
                )
              })}
            </div>
            </div>

            {/* Detail — its own scroll container, independent from the list */}
            <div className="lg:h-[calc(100vh-230px)] lg:overflow-y-auto lg:pl-1">
              {!detail ? (
                <Card className="border-dashed">
                  <CardContent className="flex h-80 flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                      <Play className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Select an automation</p>
                      <p className="mx-auto max-w-xs text-sm text-muted-foreground">
                        Pick one on the left to replay it, watch the recording, and edit the spec — or create one from a test case or the MCP chat.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold leading-tight">{detail.title}</h2>
                      <div className="mt-0.5 flex items-center gap-2">
                        <StatusPill status={detail.lastStatus} />
                        {detail.engine === 'appium' && (
                          <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                            Android · {detail.appium?.apkPath?.split(/[\\/]/).pop() ?? detail.appium?.appPackage ?? 'no APK'}
                          </Badge>
                        )}
                        {isFlaky(detail.runs) && <FlakyBadge />}
                        {detail.linkedTestcase ? (
                          <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                            <FlaskConical className="h-2.5 w-2.5" /> {detail.linkedTestcase.testcaseId}
                            <button
                              onClick={() => patchProject({ linkedTestcase: null })}
                              disabled={savingTags}
                              className="ml-0.5 text-muted-foreground hover:text-foreground"
                              title="Unlink this test case"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ) : (
                          <button
                            onClick={() => { setTcIntent('link'); setTcOpen(true) }}
                            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            title="Link a dashboard test case — replays will sync its execution status"
                          >
                            <Link2 className="h-2.5 w-2.5" /> Link test case
                          </button>
                        )}
                      </div>
                      {/* Tags (slice regressions) + folder (file into a suite) */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {(detail.tags ?? []).map((t) => (
                          <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {t}
                            <button
                              onClick={() => saveTags((detail.tags ?? []).filter((x) => x !== t))}
                              disabled={savingTags}
                              className="hover:text-foreground"
                              title={`Remove tag "${t}"`}
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                        <input
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') addTag() }}
                          placeholder="+ tag"
                          disabled={savingTags}
                          className="w-16 bg-transparent text-[11px] text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus:text-foreground"
                        />
                        <span className="mx-1 h-3 w-px bg-border" />
                        <Folder className="h-3 w-3 text-muted-foreground" />
                        <input
                          value={folderDraft}
                          onChange={(e) => setFolderDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveFolder() }}
                          onBlur={saveFolder}
                          placeholder="No folder"
                          disabled={savingTags}
                          list="automation-folders"
                          title="File this automation into a suite folder (Enter to save)"
                          className="w-28 bg-transparent text-[11px] text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus:text-foreground"
                        />
                        <datalist id="automation-folders">
                          {allFolders.map((f) => <option key={f} value={f} />)}
                        </datalist>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={runSelected}
                        disabled={running || specLang === 'py'}
                        title={specLang === 'py' ? 'The hub replays TypeScript specs only' : undefined}
                        className="gap-2"
                      >
                        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {running ? 'Running…' : 'Replay'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setBugOpen(true)}
                        className="gap-2"
                        title={detail.linkedTestcase
                          ? `Report a bug linked to ${detail.linkedTestcase.testcaseId} (shows in the execution tab)`
                          : 'Report a bug (link a test case first to attach it to the execution tab)'}
                      >
                        <Bug className="h-4 w-4" /> Report bug
                      </Button>
                      <Button variant="outline" size="icon" onClick={deleteSelected} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Execution-status sync result */}
                  {syncNote && (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> {syncNote}
                    </div>
                  )}

                  {/* Latest video */}
                  {latestVideo && (
                    <Card>
                      <CardContent className="space-y-2 p-3">
                        <p className="text-xs font-medium text-muted-foreground">Latest run recording</p>
                        <video
                          key={latestVideo.ts}
                          controls
                          className="w-full rounded-md border bg-black"
                          src={`${base}/${selected}/runs/${latestVideo.ts}/${videoFileName}`}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Run log on failure */}
                  {runLog && (
                    <Card className="border-red-500/40">
                      <CardContent className="p-3">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs font-medium text-red-600 dark:text-red-400">Run output</p>
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => setBugOpen(true)} className="h-7 gap-1.5 text-xs">
                              <Bug className="h-3.5 w-3.5" /> Report bug
                            </Button>
                            {/* isBrowserEngine, not `!== 'appium'`: selfHeal routes to
                                [project]/improve, whose codegen prompt mandates
                                storageState + page objects. Applied to an API spec — often a
                                two-line defineCase() shim onto the test-case registry — it
                                would rewrite it into a browser test and break the link. */}
                            {aiEnabled && isBrowserEngine(detail.engine) && (
                              <Button size="sm" variant="outline" onClick={selfHeal} disabled={healing || running} className="h-7 gap-1.5 text-xs">
                                {healing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                                {healing ? 'Fixing…' : 'Fix with AI'}
                              </Button>
                            )}
                          </div>
                        </div>
                        <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{runLog}</pre>
                      </CardContent>
                    </Card>
                  )}

                  {/* Spec editor — TypeScript (native) / Python (generated) */}
                  <Card>
                    <CardContent className="p-3">
                      {/* Non-browser engines (appium, api) get the flat single-file editor.
                          The Tabs branch below is the browser POM surface: TS/Python tabs,
                          page-object chips, framework files, AI revise — none of which
                          applies without a browser. */}
                      {!isBrowserEngine(detail.engine) ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">
                              {detail.engine === 'appium' ? 'test.appium.mjs' : 'test.spec.ts'}
                            </p>
                            <Button size="sm" variant="outline" onClick={saveSpec} disabled={!dirty || saving} className="gap-1.5">
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              {dirty ? 'Save' : 'Saved'}
                            </Button>
                          </div>
                          <SpecEditor
                            value={specDraft}
                            onChange={setSpecDraft}
                            language="typescript"
                            height="260px"
                          />
                          {/* No AI-assist row: codegen.ts's revise path emits a
                              Playwright-POM browser spec. There is no Appium-aware revise
                              path, and for an API spec a revise would replace an
                              APIRequestContext test with a browser one. */}
                        </div>
                      ) : (
                      <Tabs value={specLang} onValueChange={(v) => setSpecLang(v as 'ts' | 'py')}>
                        <TabsList variant="line">
                          <TabsTrigger value="ts">TypeScript</TabsTrigger>
                          <TabsTrigger value="py">Python</TabsTrigger>
                        </TabsList>

                        {/* TypeScript spec — the source of truth the hub replays */}
                        <TabsContent value="ts" className="space-y-2 pt-3">
                          <SpecTab
                            language="ts"
                            selected={selected ?? ''}
                            artifact={tsFiles}
                            primaryPaths={tsPrimaryPages}
                            lockedFiles={detail.frameworkFiles ?? []}
                            saving={tsSaving}
                            onSave={saveTsFile}
                            aiEnabled={aiEnabled}
                            aiInstruction={aiInstruction}
                            setAiInstruction={setAiInstruction}
                            improving={improving}
                            onImprove={improveSpec}
                          />
                        </TabsContent>

                        {/* Python spec — generated from the TS spec; can't be replayed by the hub */}
                        <TabsContent value="py" className="space-y-2 pt-3">
                          <SpecTab
                            language="py"
                            selected={selected ?? ''}
                            artifact={pyFiles}
                            primaryPaths={pyPrimaryPages}
                            pythonEnabled={detail.pythonEnabled}
                            saving={pySaving}
                            onSave={savePyFile}
                            aiEnabled={aiEnabled}
                            aiInstruction={aiInstruction}
                            setAiInstruction={setAiInstruction}
                            improving={improvingPy}
                            onImprove={improvePySpec}
                            translating={translating}
                            onTranslate={translateSpec}
                            onDownload={downloadPySpec}
                          />
                        </TabsContent>
                      </Tabs>
                      )}
                    </CardContent>
                  </Card>

                  {/* Run history */}
                  {detail.runs.length > 0 && (
                    <Card>
                      <CardContent className="p-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          Run history (last {detail.runs.length})
                        </p>
                        <div className="divide-y divide-border/60">
                          {detail.runs.map((r) => (
                            <div key={r.ts} className="flex items-center justify-between gap-3 py-2 text-sm">
                              <span className="flex items-center gap-2">
                                {r.status === 'pass'
                                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  : <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                                <span className="font-mono text-xs text-muted-foreground">{r.ts.replace(/-/g, ':').replace('T', ' ').slice(0, 19)}</span>
                                <span className="text-xs text-muted-foreground">· {Math.round(r.durationMs)}ms</span>
                              </span>
                              <span className="flex items-center gap-3">
                                {r.hasVideo && (
                                  <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                     href={`${base}/${selected}/runs/${r.ts}/${videoFileName}`} target="_blank" rel="noreferrer">
                                    <Film className="h-3.5 w-3.5" /> Video
                                  </a>
                                )}
                                {r.hasTrace && (
                                  <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                     href={`/api/trace-viewer/index.html?trace=${encodeURIComponent(`${base}/${selected}/runs/${r.ts}/trace.zip`)}`}
                                     target="_blank" rel="noreferrer">
                                    <FileArchive className="h-3.5 w-3.5" /> View Trace
                                  </a>
                                )}
                                {/* API projects: the request/response viewer and the same
                                    calls as an importable Postman collection. For a
                                    202-then-poll API this is what a replay is actually for. */}
                                {r.hasApiLog && (
                                  <>
                                    <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                       href={`${base}/${selected}/runs/${r.ts}/api-log.html`}
                                       target="_blank" rel="noreferrer">
                                      <ArrowLeftRight className="h-3.5 w-3.5" /> Request / Response
                                    </a>
                                    <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                       href={`${base}/${selected}/runs/${r.ts}/api-postman-collection.json`}
                                       download={`${selected}-${r.ts}.postman_collection.json`}>
                                      <Download className="h-3.5 w-3.5" /> Postman
                                    </a>
                                  </>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── MCP Chat ──────────────────────────────────────────────────── */}
        <TabsContent value="chat" className="pt-4">
          <ChatAuthoringTab
            session={session}
            aiEnabled={aiEnabled}
            lockedEngine={lockedEngine}
            chatModel={chatModel}
            modelName={modelName}
          />
        </TabsContent>

        {/* ── API Console ───────────────────────────────────────────────── */}
        {isApiApp && (
          <TabsContent value="api-console" className="pt-4">
            {!selected && (
              <p className="text-sm text-muted-foreground">
                Select a project on the Automations tab to read the calls it made.
              </p>
            )}
            {selected && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{selected}</span>
                  {/* Run picker: the console reads one run's recording at a time. */}
                  <select
                    value={consoleRunTs ?? ''}
                    onChange={(e) => setConsoleRunTs(e.target.value || null)}
                    className="h-8 rounded-md border bg-background px-2 font-mono text-xs"
                  >
                    <option value="">— pick a run —</option>
                    {(detail?.runs ?? []).filter((r) => r.hasApiLog).map((r) => (
                      <option key={r.ts} value={r.ts}>
                        {r.ts.replace(/-/g, ':').replace('T', ' ').slice(0, 19)} · {r.status}
                      </option>
                    ))}
                  </select>
                  {(detail?.runs ?? []).every((r) => !r.hasApiLog) && (
                    <span className="text-xs text-muted-foreground">
                      No run of this project has a recorded exchange yet — replay it first.
                    </span>
                  )}
                </div>
                <ApiConsole app={app} project={selected} runTs={consoleRunTs} />
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Bug reporting — linked to the project's test case when one is set */}
      {detail && (
        <AutomationBugDialog
          open={bugOpen}
          app={app}
          projectTitle={detail.title}
          linkedTestcase={detail.linkedTestcase}
          runError={detail.runs[0]?.error ?? null}
          runLog={runLog}
          models={models}
          onClose={() => setBugOpen(false)}
        />
      )}
    </div>
  )
}
