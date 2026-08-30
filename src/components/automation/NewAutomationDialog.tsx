'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, FileCode2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Sentinels for the create dialog's "Starting page" select. */
const NO_START_PAGE = '__none__'
const NEW_START_PAGE = '__new__'

/** Client-side mirror of store.ts slugify() — only previews the scaffolded page path. */
function slugifyPreview(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

interface PomPage { path: string; className: string }

interface NewAutomationDialogProps {
  base: string
  app: string
  lockedEngine: 'playwright' | 'appium' | null
  /** Called after a new project is created — hub: await loadList(); setSelected(name); warning toast. */
  onCreated: (name: string, pyWarning?: string) => void | Promise<void>
}

/**
 * "New automation" dialog — self-contained project-creation flow (title,
 * engine, Appium target fields, or a Playwright starting-page picker) plus its
 * own trigger button. State resets when the dialog closes; it is not preserved
 * if the user switches the hub's top-level tab away and back.
 */
export function NewAutomationDialog({ base, app, lockedEngine, onCreated }: NewAutomationDialogProps) {
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

  // Force the create flow onto the app's locked engine (registry loads async).
  useEffect(() => {
    if (lockedEngine) setNewEngine(lockedEngine)
  }, [lockedEngine])

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
      await onCreated(data.name, data.pyWarning)
    } finally {
      setCreating(false)
    }
  }

  return (
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
  )
}
