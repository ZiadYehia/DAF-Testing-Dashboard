'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Layers,
  Shield, BarChart2, Lock, Package, Scale, ImagePlus, X, Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { IntakeGroupForm } from '@/components/shared/IntakeGroupForm'
import { ReadinessBadge } from '@/components/shared/ReadinessBadge'
import { MODULE_INTAKE_GROUPS, type IntakeValue } from '@/lib/intake-types'
import type { ModuleManifest } from '@/lib/modules'
import { slugify } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppEntry {
  appSlug: string
  appName: string
  appIcon: string
  modules: ModuleManifest[]
}

// ─── Icon picker ──────────────────────────────────────────────────────────────

const ICONS: { name: string; el: React.ReactNode }[] = [
  { name: 'Layers',    el: <Layers    className="h-5 w-5" /> },
  { name: 'Shield',    el: <Shield    className="h-5 w-5" /> },
  { name: 'BarChart2', el: <BarChart2 className="h-5 w-5" /> },
  { name: 'Lock',      el: <Lock      className="h-5 w-5" /> },
  { name: 'Package',   el: <Package   className="h-5 w-5" /> },
  { name: 'Scale',     el: <Scale     className="h-5 w-5" /> },
]

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ICONS.map(({ name, el }) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs transition-colors ${
            value === name
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-primary/50 hover:bg-accent text-muted-foreground'
          }`}
        >
          {el}
          {name}
        </button>
      ))}
    </div>
  )
}

function getModuleIcon(name: string) {
  return ICONS.find((i) => i.name === name)?.el ?? <Layers className="h-4 w-4" />
}

// ─── Module form ──────────────────────────────────────────────────────────────

interface FormState {
  appSlug: string
  slug: string
  name: string
  icon: string
  order: string
  pathPrefix: string
  description: string
}

function emptyForm(appSlug: string): FormState {
  return { appSlug, slug: '', name: '', icon: 'Layers', order: '99', pathPrefix: '', description: '' }
}

function formFromManifest(appSlug: string, m: ModuleManifest): FormState {
  return {
    appSlug,
    slug: m.slug,
    name: m.name,
    icon: m.icon,
    order: String(m.order),
    pathPrefix: m.pathPrefix,
    description: m.description ?? '',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminModulesPage() {
  const router = useRouter()
  const [apps, setApps] = useState<AppEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeApp, setActiveApp] = useState('')
  const [logos, setLogos] = useState<Record<string, string>>({})

  // Module create/edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<FormState>(emptyForm(''))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dialogTab, setDialogTab] = useState<'details' | 'knowledge'>('details')
  const [moduleAnswers, setModuleAnswers] = useState<Record<string, IntakeValue> | undefined>(undefined)
  const [loadingModuleIntake, setLoadingModuleIntake] = useState(false)

  // Logo upload dialog state
  const [logoDialogOpen, setLogoDialogOpen] = useState(false)
  const [logoTarget, setLogoTarget] = useState<{ appSlug: string; slug: string; name: string } | null>(null)
  const [pendingLogo, setPendingLogo] = useState<string | null>(null)
  const [savingLogo, setSavingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/modules')
    if (res.status === 401 || res.status === 403) { router.push('/login'); return }
    if (!res.ok) { toast.error('Failed to load modules'); setLoading(false); return }
    const data: { apps: AppEntry[] } = await res.json()
    setApps(data.apps)
    setActiveApp((prev) => prev || data.apps[0]?.appSlug || '')
    setLoading(false)
  }, [router])

  const loadLogos = useCallback(async () => {
    try {
      const res = await fetch('/api/logo')
      if (res.ok) setLogos(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    load()
    loadLogos()
  }, [load, loadLogos])

  // Prefill the Knowledge tab with previously-saved module intake answers when
  // editing — without this, saving the (blank) form would overwrite them.
  useEffect(() => {
    const slug = form.slug.trim()
    if (!dialogOpen || dialogMode !== 'edit' || !slug) {
      setModuleAnswers(undefined)
      return
    }
    let cancelled = false
    setLoadingModuleIntake(true)
    fetch(`/api/${form.appSlug}/intake?scope=module&slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setModuleAnswers(data?.answers?.overview)
      })
      .catch(() => {
        if (!cancelled) setModuleAnswers(undefined)
      })
      .finally(() => {
        if (!cancelled) setLoadingModuleIntake(false)
      })
    return () => {
      cancelled = true
    }
  }, [dialogOpen, dialogMode, form.appSlug, form.slug])

  function openLogoDialog(appSlug: string, m: ModuleManifest) {
    const key = `module_${appSlug}_${m.slug}`
    setLogoTarget({ appSlug, slug: m.slug, name: m.name })
    setPendingLogo(logos[key] ?? null)
    setLogoDialogOpen(true)
  }

  async function handleLogoFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setPendingLogo(dataUrl)
  }

  async function handleLogoSave() {
    if (!logoTarget) return
    setSavingLogo(true)
    try {
      const key = `module_${logoTarget.appSlug}_${logoTarget.slug}`
      const res = await fetch('/api/logo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: pendingLogo ?? '' }),
      })
      if (res.ok) {
        setLogos((prev) => ({ ...prev, [key]: pendingLogo ?? '' }))
        setLogoDialogOpen(false)
        toast.success('Logo saved — reload the sidebar to see it')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error ?? 'Failed to save logo')
      }
    } finally {
      setSavingLogo(false)
    }
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Auto-derive slug + pathPrefix from name when creating
      if (k === 'name' && dialogMode === 'create') {
        const auto = slugify(v as string)
        next.slug = auto
        next.pathPrefix = auto
      }
      return next
    })
  }

  function openCreate(appSlug: string) {
    setDialogMode('create')
    setForm(emptyForm(appSlug))
    setFormError('')
    setDialogTab('details')
    setDialogOpen(true)
  }

  function openEdit(appSlug: string, m: ModuleManifest) {
    setDialogMode('edit')
    setForm(formFromManifest(appSlug, m))
    setFormError('')
    setDialogTab('details')
    setDialogOpen(true)
  }

  async function handleSave() {
    setFormError('')
    setSaving(true)
    try {
      let res: Response
      if (dialogMode === 'create') {
        res = await fetch('/api/admin/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appSlug:     form.appSlug,
            slug:        form.slug.trim(),
            name:        form.name.trim(),
            icon:        form.icon,
            order:       parseInt(form.order, 10) || 99,
            pathPrefix:  form.pathPrefix.trim(),
            description: form.description.trim(),
          }),
        })
      } else {
        res = await fetch(`/api/admin/modules/${form.slug}?app=${form.appSlug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:        form.name.trim(),
            icon:        form.icon,
            order:       parseInt(form.order, 10) || 99,
            pathPrefix:  form.pathPrefix.trim(),
            description: form.description.trim(),
          }),
        })
      }
      if (res.ok) {
        setDialogOpen(false)
        toast.success(dialogMode === 'create' ? 'Module created' : 'Module updated')
        load()
      } else {
        const data = await res.json().catch(() => ({}))
        setFormError(data.error ?? 'Failed to save module')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(appSlug: string, m: ModuleManifest) {
    if (!confirm(`Delete module "${m.name}" from ${appSlug}?\n\nThis removes the module manifest and its route wrappers. Feature data in the database is NOT deleted.`)) return
    const res = await fetch(`/api/admin/modules/${m.slug}?app=${appSlug}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`Module "${m.name}" deleted`)
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Failed to delete module')
    }
  }

  const currentEntry = apps.find((a) => a.appSlug === activeApp)

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Module Management</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? '—' : `${apps.reduce((n, a) => n + a.modules.length, 0)} modules across ${apps.length} app${apps.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {currentEntry && (
          <Button size="sm" onClick={() => openCreate(activeApp)}>
            <Plus className="h-4 w-4" />
            New Module
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : apps.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No enabled apps found.</p>
      ) : (
        <>
          {/* App tabs */}
          <div className="flex gap-1 border-b pb-0">
            {apps.map((a) => (
              <button
                key={a.appSlug}
                onClick={() => setActiveApp(a.appSlug)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeApp === a.appSlug
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <span>{a.appIcon}</span>
                {a.appName}
                <Badge variant="secondary" className="text-xs">{a.modules.length}</Badge>
              </button>
            ))}
          </div>

          {/* Module list */}
          {currentEntry && (
            currentEntry.modules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No modules yet for {currentEntry.appName}.{' '}
                <button className="text-primary hover:underline" onClick={() => openCreate(activeApp)}>
                  Create one
                </button>
              </p>
            ) : (
              <div className="space-y-2">
                {currentEntry.modules.map((m) => {
                  const isRoot = m.pathPrefix === ''
                  const logoKey = `module_${currentEntry.appSlug}_${m.slug}`
                  const moduleLogo = logos[logoKey]
                  return (
                    <Card key={m.slug} size="sm">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary overflow-hidden">
                            {moduleLogo
                              ? <img src={moduleLogo} alt="" className="h-full w-full object-contain p-1" />
                              : getModuleIcon(m.icon)
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{m.name}</span>
                              <code className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                {m.slug}
                              </code>
                              {isRoot && (
                                <Badge variant="outline" className="text-xs">root</Badge>
                              )}
                              {!isRoot && (
                                <code className="text-xs text-muted-foreground font-mono">
                                  /{currentEntry.appSlug}/{m.pathPrefix}/…
                                </code>
                              )}
                              <ReadinessBadge app={currentEntry.appSlug} module={m.slug} />
                            </div>
                            {m.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                            <span>order {m.order}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              variant="outline"
                              size="icon-xs"
                              onClick={() => openLogoDialog(currentEntry.appSlug, m)}
                              title="Upload logo"
                              aria-label={`Upload logo for ${m.name}`}
                            >
                              <ImagePlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon-xs"
                              onClick={() => openEdit(currentEntry.appSlug, m)}
                              aria-label={`Edit ${m.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-xs"
                              disabled={isRoot}
                              title={isRoot ? 'Root module cannot be deleted' : `Delete ${m.name}`}
                              onClick={() => handleDelete(currentEntry.appSlug, m)}
                              aria-label={`Delete ${m.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )
          )}
        </>
      )}

      {/* Hidden file input for logo upload */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoFileSelect}
      />

      {/* Logo Upload Dialog */}
      <Dialog open={logoDialogOpen} onOpenChange={(o) => { if (!savingLogo) setLogoDialogOpen(o) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Module Logo — {logoTarget?.name}</DialogTitle>
            <DialogDescription>
              Square PNG or SVG recommended, max 2 MB. Shown in the sidebar at 24×24.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Preview */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                {pendingLogo
                  ? <img src={pendingLogo} alt="Preview" className="h-full w-full object-contain p-1" />
                  : <span className="text-2xl select-none">🖼</span>
                }
              </div>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {pendingLogo ? 'Replace' : 'Upload'}
                </Button>
                {pendingLogo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground flex"
                    onClick={() => setPendingLogo(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLogoDialogOpen(false)} disabled={savingLogo}>
              Cancel
            </Button>
            <Button onClick={handleLogoSave} disabled={savingLogo}>
              {savingLogo ? 'Saving…' : 'Save Logo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!saving) setDialogOpen(o) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'New Module' : `Edit ${form.name}`}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'Add a new module to this app. Route wrappers are scaffolded automatically.'
                : 'Update the module manifest. The slug cannot be changed after creation.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={(v) => v && setDialogTab(v as 'details' | 'knowledge')}>
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <div className="space-y-4 py-1">
                {/* Name + slug row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">Name *</label>
                    <Input
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      placeholder="e.g. Risk Manager"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">Slug *</label>
                    <Input
                      value={form.slug}
                      onChange={(e) => setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="e.g. risk"
                      disabled={dialogMode === 'edit'}
                      className={dialogMode === 'edit' ? 'opacity-60' : ''}
                    />
                  </div>
                </div>

                {/* Path prefix + order row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">
                      URL path prefix
                      <span className="ml-1 font-normal text-muted-foreground">(empty = root module)</span>
                    </label>
                    <Input
                      value={form.pathPrefix}
                      onChange={(e) => setField('pathPrefix', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder="e.g. risk"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium">Order</label>
                    <Input
                      type="number"
                      value={form.order}
                      onChange={(e) => setField('order', e.target.value)}
                      placeholder="99"
                      min={1}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <Input
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Short description shown on the dashboard card"
                  />
                </div>

                {/* Icon picker */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium">Icon</label>
                  <IconPicker value={form.icon} onChange={(v) => setField('icon', v)} />
                </div>

                {formError && <p className="text-sm text-destructive">{formError}</p>}
              </div>
            </TabsContent>

            <TabsContent value="knowledge">
              <div className="py-1 max-h-[60vh] overflow-y-auto pr-1">
                {!form.slug.trim() ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Enter a name (which derives the slug) on the Details tab first.
                  </p>
                ) : loadingModuleIntake ? (
                  <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />
                ) : (
                  <IntakeGroupForm
                    key={`${form.appSlug}-${form.slug}`}
                    app={form.appSlug}
                    scope="module"
                    slug={form.slug.trim()}
                    group={MODULE_INTAKE_GROUPS[0]}
                    initialAnswers={moduleAnswers}
                  />
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.slug.trim()}>
              {saving ? 'Saving…' : dialogMode === 'create' ? 'Create Module' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
