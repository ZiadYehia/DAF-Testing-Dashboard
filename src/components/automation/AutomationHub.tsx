'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ModelSelector } from '@/components/shared/ModelSelector'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Bot, Play, Plus, Save, Trash2, Film, FileArchive, Loader2, CheckCircle2,
  XCircle, Circle, FlaskConical, MessageSquare, Send, Wrench, Square,
  AlertTriangle, Tag, X, Folder, ChevronDown, ChevronRight, Bug, Link2,
  Download, Wand2, Search, FileCode2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModels } from '@/hooks/useModels'
import { useApp } from '@/lib/use-apps'
import { AutomationBugDialog } from './AutomationBugDialog'
import { SpecEditor } from './SpecEditor'
import { ArtifactEditor } from './ArtifactEditor'
import { useArtifactFiles } from './useArtifactFiles'
import { toast } from 'sonner'

/** Sentinels for the create dialog's "Starting page" select. */
const NO_START_PAGE = '__none__'
const NEW_START_PAGE = '__new__'

/** Client-side mirror of store.ts slugify() — only previews the scaffolded page path. */
function slugifyPreview(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

type RunStatus = 'pass' | 'fail' | 'never_run'

interface RunRecord {
  ts: string
  status: 'pass' | 'fail'
  durationMs: number
  hasVideo: boolean
  hasTrace: boolean
  error?: string
}
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
  engine?: 'playwright' | 'appium'
  appium?: { apkPath?: string; appPackage?: string; appActivity?: string; avd?: string; udid?: string; noReset?: boolean }
}
interface PageFile { path: string; content: string }

interface ProjectDetail extends ProjectMeta {
  spec: string
  pySpec?: string | null
  pythonEnabled?: boolean
  pageFiles?: PageFile[]
  tsPageFiles?: PageFile[]
  frameworkFiles?: PageFile[]
}
interface PomPage { path: string; className: string }

interface ChatTool { tool: string; ok: boolean }
interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
  tools: ChatTool[]
}

/**
 * A project is "flaky" when its recent history flip-flops between pass and fail
 * (≥2 status changes in the kept run history) — the team should distrust it and
 * stabilize the spec rather than chase each red run.
 */
function isFlaky(runs: RunRecord[]): boolean {
  let flips = 0
  for (let i = 1; i < runs.length; i++) {
    if (runs[i].status !== runs[i - 1].status) flips++
  }
  return flips >= 2
}

function FlakyBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
      title="Recent runs flip between pass and fail — stabilize this spec"
    >
      <AlertTriangle className="h-3 w-3" /> Flaky
    </span>
  )
}

function StatusPill({ status }: { status: RunStatus }) {
  const map = {
    pass: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400', label: 'Passing' },
    fail: { icon: XCircle, cls: 'text-red-600 dark:text-red-400', label: 'Failing' },
    never_run: { icon: Circle, cls: 'text-muted-foreground', label: 'Never run' },
  }[status]
  const Icon = map.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', map.cls)}>
      <Icon className="h-3.5 w-3.5" />
      {map.label}
    </span>
  )
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
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEngine, setNewEngine] = useState<'playwright' | 'appium'>('playwright')
  const [newApkPath, setNewApkPath] = useState('')
  const [newAvd, setNewAvd] = useState('')
  const [newAppPackage, setNewAppPackage] = useState('')
  const [newAppActivity, setNewAppActivity] = useState('')
  const [newUdid, setNewUdid] = useState('')
  const [newNoReset, setNewNoReset] = useState(false)
  // Playwright-only starter page binding: an existing pages/<app>/*.page.ts, or scaffold a new one.
  const [pomPages, setPomPages] = useState<PomPage[]>([])
  const [pomLoading, setPomLoading] = useState(false)
  const [startPagePath, setStartPagePath] = useState<string>(NO_START_PAGE)
  const [newPageScreen, setNewPageScreen] = useState('')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const base = `/api/${app}/automation`
  // Web apps automate via Playwright only, mobile apps via Appium only —
  // other types (desktop, unknown) keep the engine choice visible.
  const appConfig = useApp(app)
  const lockedEngine: 'playwright' | 'appium' | null =
    appConfig?.type === 'web' ? 'playwright' : appConfig?.type === 'mobile' ? 'appium' : null

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

  // "Run all" honors the active tag/search/status filters, so running while filtered = a scoped run.
  const runAll = () => runList(visibleProjects, tagFilter ? `tag: ${tagFilter}` : filtersActive ? 'filtered' : null)

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

  async function createProject() {
    setCreating(true)
    setCreateErr(null)
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          ...(newEngine === 'appium'
            ? {
                engine: 'appium',
                appium: {
                  ...(newApkPath.trim() ? { apkPath: newApkPath.trim() } : {}),
                  ...(newAppPackage.trim() ? { appPackage: newAppPackage.trim() } : {}),
                  ...(newAppActivity.trim() ? { appActivity: newAppActivity.trim() } : {}),
                  ...(newAvd.trim() ? { avd: newAvd.trim() } : {}),
                  ...(newUdid.trim() ? { udid: newUdid.trim() } : {}),
                  noReset: newNoReset,
                },
              }
            : startPagePath === NEW_START_PAGE
              ? { newPageScreen: newPageScreen.trim() }
              : startPagePath !== NO_START_PAGE
                ? { startPagePath }
                : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateErr(data?.error ?? 'Failed to create'); return }
      setNewOpen(false)
      setNewTitle('')
      setNewEngine('playwright')
      setNewApkPath('')
      setNewAvd('')
      setNewAppPackage('')
      setNewAppActivity('')
      setNewUdid('')
      setNewNoReset(false)
      // A freshly scaffolded page won't be in the cached list yet — force a refetch next time the dialog opens.
      if (startPagePath === NEW_START_PAGE) setPomPages([])
      setStartPagePath(NO_START_PAGE)
      setNewPageScreen('')
      await loadList()
      setSelected(data.name)
      if (data.pyWarning) toast.warning(data.pyWarning)
    } finally {
      setCreating(false)
    }
  }

  // Lazily fetch the app's shared page objects when the create dialog opens (playwright only).
  useEffect(() => {
    if (newOpen && newEngine === 'playwright' && pomPages.length === 0) {
      setPomLoading(true)
      fetch(`${base}/pages`)
        .then((r) => (r.ok ? r.json() : { pages: [] }))
        .then((d) => setPomPages(d.pages ?? []))
        .catch(() => {})
        .finally(() => setPomLoading(false))
    }
  }, [newOpen, newEngine, pomPages.length, base])

  async function deleteSelected() {
    if (!selected) return
    await fetch(`${base}/${selected}`, { method: 'DELETE' })
    setSelected(null)
    setDetail(null)
    await loadList()
  }

  // ── MCP Chat state ──────────────────────────────────────────────────────
  const { models } = useModels()
  const [chatModel, setChatModel] = useState<string>('')
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatSession, setChatSession] = useState<string | null>(null)
  const [chatEngine, setChatEngine] = useState<'playwright' | 'appium'>('playwright')
  const [chatApkPath, setChatApkPath] = useState('')
  const [chatAvd, setChatAvd] = useState('')
  // Force both authoring paths onto the app's locked engine (registry loads async).
  useEffect(() => {
    if (lockedEngine) {
      setNewEngine(lockedEngine)
      setChatEngine(lockedEngine)
    }
  }, [lockedEngine])
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState('automations')
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [savingChat, setSavingChat] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const canSave = !!chatSession && !chatBusy && chat.some((m) => m.role === 'assistant' && m.tools.length > 0)

  // ── Phase 4: link to dashboard test cases ───────────────────────────────
  const [testcases, setTestcases] = useState<{ feature: string; id: string; objective: string; steps: string }[]>([])
  const [tcOpen, setTcOpen] = useState(false)
  const [tcFilter, setTcFilter] = useState('')
  const [pendingLink, setPendingLink] = useState<{ feature: string; testcaseId: string } | null>(null)
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

  // ── Folders: file automations into suites; the list groups by folder ──
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const [folderDraft, setFolderDraft] = useState('')

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (chatSession) fetch(`${base}/chat?sessionId=${chatSession}`, { method: 'DELETE' }).catch(() => {})
    setChatSession(null)
    setChat([])
    setPendingLink({ feature: tc.feature, testcaseId: tc.id })
    setSaveTitle(`${tc.id} — ${tc.objective}`.slice(0, 80))
    setChatInput(
      `Automate this test case end-to-end in the browser, then tell me exactly what you verified.\n\n` +
      `Test case ${tc.id} (feature: ${tc.feature})\nObjective: ${tc.objective}\n\nSteps:\n${tc.steps}`,
    )
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

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight })
  }, [chat])

  // Close the browser session when leaving the page.
  useEffect(() => {
    return () => {
      if (chatSession) {
        navigator.sendBeacon?.(`${base}/chat?sessionId=${chatSession}`)
        fetch(`${base}/chat?sessionId=${chatSession}`, { method: 'DELETE' }).catch(() => {})
      }
    }
  }, [chatSession, base])

  async function sendChat() {
    const message = chatInput.trim()
    const startingAppiumChat = !chatSession && chatEngine === 'appium'
    if (!message || chatBusy || !chatModel || (startingAppiumChat && !chatApkPath.trim())) return
    setChatInput('')
    setChatBusy(true)
    setChat((c) => [...c, { role: 'user', text: message, tools: [] }, { role: 'assistant', text: '', tools: [] }])

    // Mutate the last (assistant) message as events stream in.
    const patchAssistant = (fn: (m: ChatMsg) => void) =>
      setChat((c) => {
        const next = [...c]
        const last = { ...next[next.length - 1] }
        fn(last)
        next[next.length - 1] = last
        return next
      })

    try {
      const res = await fetch(`${base}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          model: chatModel,
          sessionId: chatSession,
          ...(startingAppiumChat
            ? { engine: 'appium', appium: { apkPath: chatApkPath, ...(chatAvd.trim() ? { avd: chatAvd.trim() } : {}) } }
            : {}),
        }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        patchAssistant((m) => { m.text = `⚠️ ${err?.error ?? 'Request failed'}` })
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const frames = buf.split('\n\n')
        buf = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.replace(/^data: /, '').trim()
          if (!line) continue
          let e: any
          try { e = JSON.parse(line) } catch { continue }
          if (e.type === 'session') setChatSession(e.sessionId)
          else if (e.type === 'text') patchAssistant((m) => { m.text += (m.text ? '\n\n' : '') + e.text })
          else if (e.type === 'tool_use') patchAssistant((m) => { m.tools.push({ tool: e.tool, ok: true }) })
          else if (e.type === 'tool_result') patchAssistant((m) => {
            // reflect the latest matching tool's outcome
            for (let i = m.tools.length - 1; i >= 0; i--) {
              if (m.tools[i].tool === e.tool) { m.tools[i] = { tool: e.tool, ok: e.ok }; break }
            }
          })
          else if (e.type === 'error') patchAssistant((m) => { m.text += `\n\n⚠️ ${e.message}` })
        }
      }
    } catch (err: any) {
      patchAssistant((m) => { m.text += `\n\n⚠️ ${err?.message ?? 'Connection lost'}` })
    } finally {
      setChatBusy(false)
    }
  }

  async function saveAsAutomation() {
    if (!chatSession || !saveTitle.trim()) return
    setSavingChat(true)
    setSaveErr(null)
    try {
      const res = await fetch(`${base}/chat/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: chatSession, title: saveTitle, linkedTestcase: pendingLink }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveErr(data?.error ?? 'Failed to save'); return }
      setSaveOpen(false)
      setSaveTitle('')
      setPendingLink(null)
      await loadList()
      setSelected(data.name)
      setActiveTab('automations')
      if (data.pyWarning) toast.warning(data.pyWarning)
    } finally {
      setSavingChat(false)
    }
  }

  async function resetChat() {
    if (chatSession) {
      fetch(`${base}/chat?sessionId=${chatSession}`, { method: 'DELETE' }).catch(() => {})
    }
    setChatSession(null)
    setChat([])
  }

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
            <h1 className="text-xl font-semibold leading-tight">Automation Hub</h1>
            <p className="text-sm text-muted-foreground">
              Author, replay &amp; edit Playwright tests — recorded with video &amp; trace.
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
          <TabsTrigger value="chat">
            <MessageSquare /> MCP Chat
          </TabsTrigger>
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
                      onClick={() => setTagFilter(tagFilter === t ? null : t)}
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
              <Dialog open={newOpen} onOpenChange={setNewOpen}>
                <DialogTrigger render={<Button className="w-full gap-2"><Plus className="h-4 w-4" /> New automation</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New automation</DialogTitle>
                    <DialogDescription>
                      {lockedEngine === 'playwright'
                        ? 'Creates a Playwright project with a starter spec you can edit and replay.'
                        : lockedEngine === 'appium'
                          ? 'Creates an Appium project with a starter spec you can edit and replay against the Android app.'
                          : 'Creates a project with a starter spec you can edit and replay, for a web app (Playwright) or an Android app (Appium).'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Title</label>
                      <Input
                        placeholder="e.g. Checkout happy path"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) createProject() }}
                        autoFocus
                      />
                    </div>
                    {!lockedEngine && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setNewEngine('playwright')}
                          className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            newEngine === 'playwright' ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground')}
                        >
                          Web (Playwright)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewEngine('appium')}
                          className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                            newEngine === 'appium' ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground')}
                        >
                          Android (Appium)
                        </button>
                      </div>
                    )}
                    {newEngine === 'appium' && (
                      <div className="space-y-2">
                        <Input
                          placeholder="Path to the APK, e.g. C:\builds\app-debug.apk (optional if package + activity are set)"
                          value={newApkPath}
                          onChange={(e) => setNewApkPath(e.target.value)}
                        />
                        <Input
                          placeholder="App package, e.g. com.example.app (optional if APK path is set)"
                          value={newAppPackage}
                          onChange={(e) => setNewAppPackage(e.target.value)}
                        />
                        <Input
                          placeholder="App activity, e.g. .MainActivity (optional if APK path is set)"
                          value={newAppActivity}
                          onChange={(e) => setNewAppActivity(e.target.value)}
                        />
                        <Input
                          placeholder="AVD name override (optional — defaults to ANDROID_AVD)"
                          value={newAvd}
                          onChange={(e) => setNewAvd(e.target.value)}
                        />
                        <Input
                          placeholder="Device serial (adb udid) — optional, uses emulator if empty"
                          value={newUdid}
                          onChange={(e) => setNewUdid(e.target.value)}
                        />
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={newNoReset}
                            onChange={(e) => setNewNoReset(e.target.checked)}
                            className="h-4 w-4 accent-primary"
                          />
                          App is pre-installed — don&apos;t reinstall/reset
                        </label>
                      </div>
                    )}
                    {newEngine === 'playwright' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Starting page (optional)</label>
                        <Select value={startPagePath} onValueChange={(v) => { if (v) setStartPagePath(v) }}>
                          <SelectTrigger className="w-full" disabled={pomLoading}>
                            {pomLoading
                              ? <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading pages…</span>
                              : <SelectValue placeholder="No starting page" />}
                          </SelectTrigger>
                          <SelectContent align="start" side="bottom" sideOffset={6} alignItemWithTrigger={false}>
                            <SelectItem value={NO_START_PAGE}>
                              <span className="text-muted-foreground">No starting page</span>
                            </SelectItem>
                            {pomPages.length > 0 && <SelectSeparator />}
                            {pomPages.map((p) => (
                              <SelectItem key={p.path} value={p.path}>
                                <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                                {p.className}
                                <span className="text-xs text-muted-foreground">{p.path.split('/').pop()}</span>
                              </SelectItem>
                            ))}
                            <SelectSeparator />
                            <SelectItem value={NEW_START_PAGE}>
                              <Plus className="h-3.5 w-3.5" /> New page…
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {startPagePath === NEW_START_PAGE ? (
                          <>
                            <Input
                              placeholder="Screen name, e.g. Checkout Review"
                              value={newPageScreen}
                              onChange={(e) => setNewPageScreen(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim() && newPageScreen.trim()) createProject() }}
                              autoFocus
                            />
                            <p className="text-[11px] leading-4 text-muted-foreground">
                              {newPageScreen.trim()
                                ? <>Scaffolds <code className="rounded bg-muted px-1 py-0.5">pages/{app}/{slugifyPreview(newPageScreen)}.page.ts</code> and starts the test from it.</>
                                : 'Name the screen this test starts on — a page object is scaffolded for it.'}
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] leading-4 text-muted-foreground">
                            {startPagePath === NO_START_PAGE
                              ? (pomPages.length === 0 && !pomLoading
                                  ? 'No page objects exist for this app yet — pick "New page…" to scaffold the first one.'
                                  : 'The starter spec begins with a commented example — pick a page to chain from its entry.')
                              : <>Test starts from <code className="rounded bg-muted px-1 py-0.5">{pomPages.find((p) => p.path === startPagePath)?.className}.open(page)</code>.</>}
                          </p>
                        )}
                      </div>
                    )}
                    {createErr && <p className="text-xs text-red-600 dark:text-red-400">{createErr}</p>}
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={createProject}
                      disabled={
                        !newTitle.trim() ||
                        creating ||
                        (newEngine === 'appium' && !(newApkPath.trim() || (newAppPackage.trim() && newAppActivity.trim()))) ||
                        (newEngine === 'playwright' && startPagePath === NEW_START_PAGE && !newPageScreen.trim())
                      }
                      className="gap-2"
                    >
                      {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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
                            {aiEnabled && detail.engine !== 'appium' && (
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
                      {detail.engine === 'appium' ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">test.appium.mjs</p>
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
                          {/* No AI-assist row here yet — codegen.ts's revise path is
                              Playwright-only (validates @playwright/test output); an
                              Appium-aware revise path doesn't exist yet. */}
                        </div>
                      ) : (
                      <Tabs value={specLang} onValueChange={(v) => setSpecLang(v as 'ts' | 'py')}>
                        <TabsList variant="line">
                          <TabsTrigger value="ts">TypeScript</TabsTrigger>
                          <TabsTrigger value="py">Python</TabsTrigger>
                        </TabsList>

                        {/* TypeScript spec — the source of truth the hub replays */}
                        <TabsContent value="ts" className="space-y-2 pt-3">
                          <ArtifactEditor
                            language="typescript"
                            testLabel="test.spec.ts"
                            files={tsFiles.files}
                            primaryPaths={tsPrimaryPages}
                            lockedFiles={detail.frameworkFiles ?? []}
                            active={tsFiles.active}
                            onSelect={tsFiles.select}
                            recentlyTouched={tsFiles.recentlyTouched}
                            activeContent={tsFiles.activeContent}
                            onActiveContentChange={tsFiles.setActiveContent}
                            activeIsTest={tsFiles.activeIsTest}
                            activeDirty={tsFiles.activeDirty}
                            saving={tsSaving}
                            onSave={saveTsFile}
                            aiRow={aiEnabled && (
                              <div className="flex items-center gap-2 border-t pt-2">
                                <Input
                                  value={aiInstruction}
                                  onChange={(e) => setAiInstruction(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && aiInstruction.trim()) improveSpec() }}
                                  placeholder="Ask AI to change the spec — e.g. “wait for the table to load before asserting”"
                                  disabled={improving}
                                  className="h-8 flex-1 text-xs"
                                />
                                <Button size="sm" variant="outline" onClick={improveSpec} disabled={!aiInstruction.trim() || improving} className="gap-1.5">
                                  {improving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                                  Ask AI
                                </Button>
                              </div>
                            )}
                          />
                        </TabsContent>

                        {/* Python spec — generated from the TS spec; can't be replayed by the hub */}
                        <TabsContent value="py" className="space-y-2 pt-3">
                          {!pyFiles.testDraft.trim() ? (
                            <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                                <Wand2 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-medium">No Python spec yet</p>
                                <p className="mx-auto max-w-xs text-xs text-muted-foreground">
                                  Generate a Python equivalent of the TypeScript spec above for use outside the hub.
                                </p>
                              </div>
                              {detail.pythonEnabled === false ? (
                                <p className="text-xs text-muted-foreground">
                                  Python generation isn’t configured for this app.
                                </p>
                              ) : (
                                <Button size="sm" onClick={() => translateSpec(false)} disabled={translating} className="gap-1.5">
                                  {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                                  {translating ? 'Generating…' : 'Generate Python from TypeScript'}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <>
                              <ArtifactEditor
                                language="python"
                                testLabel={`test_${selected}.py`}
                                files={pyFiles.files}
                                primaryPaths={pyPrimaryPages}
                                active={pyFiles.active}
                                onSelect={pyFiles.select}
                                recentlyTouched={pyFiles.recentlyTouched}
                                activeContent={pyFiles.activeContent}
                                onActiveContentChange={pyFiles.setActiveContent}
                                activeIsTest={pyFiles.activeIsTest}
                                activeDirty={pyFiles.activeDirty}
                                saving={pySaving}
                                onSave={savePyFile}
                                extraToolbar={
                                  <>
                                    <Button size="sm" variant="outline" onClick={downloadPySpec} className="h-7 gap-1.5 text-xs">
                                      <Download className="h-3.5 w-3.5" /> Download
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => translateSpec(true)} disabled={translating} className="h-7 gap-1.5 text-xs">
                                      {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                                      Regenerate from TS
                                    </Button>
                                  </>
                                }
                                aiRow={aiEnabled && (
                                  <div className="flex items-center gap-2 border-t pt-2">
                                    <Input
                                      value={aiInstruction}
                                      onChange={(e) => setAiInstruction(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter' && aiInstruction.trim()) improvePySpec() }}
                                      placeholder="Ask AI to change the Python spec…"
                                      disabled={improvingPy}
                                      className="h-8 flex-1 text-xs"
                                    />
                                    <Button size="sm" variant="outline" onClick={improvePySpec} disabled={!aiInstruction.trim() || improvingPy} className="gap-1.5">
                                      {improvingPy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                                      Ask AI
                                    </Button>
                                  </div>
                                )}
                              />
                              <p className="text-[11px] text-muted-foreground">
                                The hub replays the TypeScript spec only — run this file with pytest outside the dashboard.
                              </p>
                            </>
                          )}
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
          {!aiEnabled ? (
            <Card className="border-dashed">
              <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">AI is turned off for this app</p>
                  <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                    Enable the Automation Hub under <span className="font-medium">Settings → AI &amp; Models</span> to use chat authoring, generate-from-test-case, and AI spec edits.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card className="flex h-[70vh] flex-col">
            {/* Toolbar: live status + engine toggle + save / new chat */}
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('h-1.5 w-1.5 rounded-full', chatSession ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                {chatSession
                  ? (chatEngine === 'appium' ? 'Live Android session' : 'Live browser session')
                  : (chatEngine === 'appium' ? 'Drives a real Android app' : 'Drives a real browser')}
                <span className="hidden sm:inline">·</span>
                <span className="hidden font-medium text-foreground sm:inline">{modelName}</span>
              </span>
              <div className="flex items-center gap-2">
                {!lockedEngine && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setChatEngine('playwright')}
                      disabled={!!chatSession}
                      className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        chatSession ? 'opacity-50' : '',
                        chatEngine === 'playwright' ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground')}
                    >
                      Web
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatEngine('appium')}
                      disabled={!!chatSession}
                      className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                        chatSession ? 'opacity-50' : '',
                        chatEngine === 'appium' ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground')}
                    >
                      Android
                    </button>
                  </div>
                )}
                <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
                  <DialogTrigger render={
                    <Button variant="outline" size="sm" disabled={!canSave} className="gap-1.5" title={canSave ? 'Save this session as a replayable automation' : 'Drive a flow first'}>
                      <Save className="h-3.5 w-3.5" /> Save as automation
                    </Button>
                  } />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Save as automation</DialogTitle>
                      <DialogDescription>
                        {chatEngine === 'appium'
                          ? 'Generates an Appium spec from this session’s actions and adds it to your automations, ready to replay.'
                          : 'Generates a Playwright spec from this session’s actions and adds it to your automations, ready to replay.'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Input
                        placeholder="e.g. Example domain heading check"
                        value={saveTitle}
                        onChange={(e) => setSaveTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && saveTitle.trim()) saveAsAutomation() }}
                        autoFocus
                      />
                      {pendingLink && (
                        <p className="text-xs text-muted-foreground">
                          Links to <span className="font-mono">{pendingLink.testcaseId}</span> — replays will sync its status.
                        </p>
                      )}
                      {saveErr && <p className="text-xs text-red-600 dark:text-red-400">{saveErr}</p>}
                    </div>
                    <DialogFooter>
                      <Button onClick={saveAsAutomation} disabled={!saveTitle.trim() || savingChat} className="gap-2">
                        {savingChat && <Loader2 className="h-4 w-4 animate-spin" />} Generate &amp; save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" onClick={resetChat} disabled={chatBusy || chat.length === 0} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New chat
                </Button>
              </div>
            </div>

            {/* Appium target: editable before a session starts, read-only once bound */}
            {chatEngine === 'appium' && (
              chatSession ? (
                <div className="flex items-center gap-1.5 border-b px-3 py-2">
                  <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                    Android · {chatApkPath.split(/[\\/]/).pop() ?? 'no APK'}
                  </Badge>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                  <Input
                    placeholder="Path to the APK, e.g. C:\builds\app-debug.apk"
                    value={chatApkPath}
                    onChange={(e) => setChatApkPath(e.target.value)}
                    className="h-8 flex-1 text-xs"
                  />
                  <Input
                    placeholder="AVD name override (optional — defaults to ANDROID_AVD)"
                    value={chatAvd}
                    onChange={(e) => setChatAvd(e.target.value)}
                    className="h-8 flex-1 text-xs"
                  />
                </div>
              )
            )}

            {/* Transcript */}
            <div ref={chatScrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
              {chat.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <MessageSquare className="h-8 w-8 text-primary/50" />
                  <p className="max-w-md">
                    {chatEngine === 'appium' ? (
                      <>
                        Describe a flow and Claude will drive a real Android app via Appium MCP —
                        e.g. <em>“Open the app, log in, and confirm the home screen shows my dashboard.”</em>
                      </>
                    ) : (
                      <>
                        Describe a flow and Claude will drive a real browser via Playwright MCP —
                        e.g. <em>“Go to example.com and confirm the heading says Example Domain.”</em>
                      </>
                    )}
                  </p>
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={cn('flex items-start gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {m.role === 'assistant' && (
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                    m.role === 'user' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted',
                  )}>
                    {m.tools.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {m.tools.map((t, j) => (
                          <span key={j} className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-mono">
                            {t.ok ? <Wrench className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5 text-red-500" />}
                            {t.tool}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.text
                      ? <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                      : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> working…</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="flex items-end gap-2 border-t p-3">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                placeholder={chatModel ? 'Describe the flow to automate…' : 'No AI model available — add a provider API key in Settings → AI & Models.'}
                disabled={chatBusy || !chatModel}
                className="min-h-[44px] max-h-32 flex-1 resize-none text-sm"
              />
              <Button
                onClick={sendChat}
                disabled={chatBusy || !chatInput.trim() || !chatModel || (!chatSession && chatEngine === 'appium' && !chatApkPath.trim())}
                className="gap-1.5"
              >
                {chatBusy ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </Card>
          )}
        </TabsContent>
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
