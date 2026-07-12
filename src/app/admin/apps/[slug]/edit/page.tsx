'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Upload, X, Check, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AppSelect } from '@/components/shared/AppSelect'
import { invalidateApps } from '@/lib/use-apps'
import { APP_TYPES, appLogoKey, type AppConfig } from '@/lib/app-types'

const TYPE_OPTIONS = APP_TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))

export default function EditAppPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<AppConfig['type']>('web')
  const [platform, setPlatform] = useState('')
  const [icon, setIcon] = useState('📦')
  const [enabled, setEnabled] = useState(true)
  const [caps, setCaps] = useState({ testCaseWriter: true, featureWizard: true, moduleKnowledge: false })

  const [logo, setLogo] = useState('')
  const [logoChanged, setLogoChanged] = useState(false)

  useEffect(() => {
    async function load() {
      const [appsRes, logoRes] = await Promise.all([
        fetch('/api/admin/apps'),
        fetch('/api/logo'),
      ])
      if (appsRes.status === 401 || appsRes.status === 403) { router.push('/login'); return }
      const data = await appsRes.json().catch(() => ({ apps: [] }))
      const app = (data.apps as AppConfig[]).find((a) => a.slug === slug)
      if (!app) { setNotFound(true); setLoading(false); return }
      setName(app.name)
      setDescription(app.description)
      setType(app.type)
      setPlatform(app.platform)
      setIcon(app.icon)
      setEnabled(app.enabled)
      setCaps(app.capabilities)
      const logos = await logoRes.json().catch(() => ({}))
      setLogo(logos[appLogoKey(slug)] ?? '')
      setLoading(false)
    }
    load()
  }, [slug, router])

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Logo must be an image'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = () => { setLogo(typeof reader.result === 'string' ? reader.result : ''); setLogoChanged(true) }
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const body: Record<string, unknown> = {
      name: name.trim(), description, type, platform, icon, enabled, capabilities: caps,
    }
    if (logoChanged) body.logo = logo // '' clears it
    const res = await fetch(`/api/admin/apps/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      invalidateApps()
      toast.success('App updated')
      router.push('/admin/apps')
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Failed to update app')
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
  if (notFound) return <p className="text-sm text-muted-foreground py-8 text-center">App not found.</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="xs" nativeButton={false} render={<Link href="/admin/apps" />}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Apps
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Edit {name || slug}</h1>
          <p className="text-sm text-muted-foreground">Slug <code>/{slug}</code> can&apos;t be changed.</p>
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/${slug}/knowledge`} />}>
          <BookOpen className="h-3.5 w-3.5" />
          Edit knowledge
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Type</label>
              <AppSelect options={TYPE_OPTIONS.map(o => ({ ...o }))} value={type}
                onChange={(v) => setType(v as AppConfig['type'])} size="sm" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Platform</label>
              <Input value={platform} onChange={(e) => setPlatform(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Logo &amp; icon</label>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-md border bg-background text-2xl overflow-hidden">
                {logo ? <img src={logo} alt="" className="h-10 w-10 object-contain" /> : <span>{icon}</span>}
              </span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" nativeButton={false} render={<label htmlFor="logo-input" className="cursor-pointer" />}>
                    <Upload className="h-3.5 w-3.5" />
                    {logo ? 'Replace logo' : 'Upload logo'}
                  </Button>
                  {logo && (
                    <Button variant="ghost" size="sm" onClick={() => { setLogo(''); setLogoChanged(true) }}>
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                  <input id="logo-input" type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Emoji fallback:</span>
                  <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="w-16 h-7 text-center" maxLength={4} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Capabilities</label>
            {([
              ['testCaseWriter', 'Test-case writer'],
              ['featureWizard', 'Feature wizard'],
              ['moduleKnowledge', 'Module knowledge'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={caps[key]}
                  onChange={(e) => setCaps((c) => ({ ...c, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>

          <div className="rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span>
                <span className="font-medium">Active</span>
                <span className="text-muted-foreground"> — uncheck to archive (hides the app; data is kept).</span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/apps" />}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          <Check className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
