'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { slugify } from '@/lib/utils'
import { useApp } from '@/lib/use-apps'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ChevronRight, ChevronLeft, Plus, X, Check } from 'lucide-react'
import type { IntakeValue } from '@/lib/intake-types'

const PRIORITIES = ['P1', 'P2', 'P3', 'P4']
const STEPS = ['Basic Info', 'Screenshots', 'Workflow Details', 'Review & Create']

/** One free-form row for `list` intake questions (screens, fields, related features, roles). */
type Row = Record<string, string>

function emptyScreen(): Row {
  return { name: '', description: '' }
}
function emptyField(): Row {
  return { name: '', inputType: '', required: 'Yes', validation: '' }
}
function emptyRelated(): Row {
  return { name: '', relationship: '' }
}

export default function NewFeaturePage() {
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const app = params?.app as string
  const appConfig = useApp(app)
  const parts = pathname?.split('/') ?? []
  const appIdx = parts.indexOf(app)
  const featuresIdx = parts.lastIndexOf('features')
  const moduleSlug = featuresIdx > appIdx + 1 ? parts[appIdx + 1] : null

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [storyKey, setStoryKey] = useState('')
  const [storyOptions, setStoryOptions] = useState<{ key: string; summary: string }[]>([])

  // Roles come from the app's domain intake (GET /api/{app}/intake?scope=app →
  // answers.domain.roles). When that hasn't been answered yet, fall back to a
  // free-text field instead of hardcoding a role list.
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [rolesLoaded, setRolesLoaded] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [customRoles, setCustomRoles] = useState('')

  useEffect(() => {
    if (!app) return
    fetch(`/api/${app}/stories?source=local`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.stories)) setStoryOptions(data.stories) })
      .catch(() => {})
  }, [app])

  useEffect(() => {
    if (!app) return
    fetch(`/api/${app}/intake?scope=app`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { answers?: Record<string, Record<string, IntakeValue>> } | null) => {
        const domainRoles = data?.answers?.domain?.roles
        if (Array.isArray(domainRoles)) {
          const names = (domainRoles as Row[])
            .map((r) => (typeof r?.name === 'string' ? r.name.trim() : ''))
            .filter(Boolean)
          setAvailableRoles(names)
        }
      })
      .catch(() => {})
      .finally(() => setRolesLoaded(true))
  }, [app])

  const [featureName, setFeatureName] = useState('')
  const [featureId, setFeatureId] = useState('')
  const [modulePath, setModulePath] = useState('')
  const [priority, setPriority] = useState('P2')
  const [appVersion, setAppVersion] = useState('')
  const [businessPurpose, setBusinessPurpose] = useState('')
  const [screens, setScreens] = useState<Row[]>([emptyScreen()])
  const [userFlow, setUserFlow] = useState('')
  const [fields, setFields] = useState<Row[]>([emptyField()])
  const [businessRules, setBusinessRules] = useState('')
  const [edgeCases, setEdgeCases] = useState('')
  const [relatedFeatures, setRelatedFeatures] = useState<Row[]>([])
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([])

  const slug = slugify(featureName)

  const toggleRole = (role: string) =>
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))

  const updateScreen = (i: number, key: string, val: string) =>
    setScreens((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)))

  const updateField = (i: number, key: string, val: string) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)))

  const updateRelated = (i: number, key: string, val: string) =>
    setRelatedFeatures((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))

  const handleCreate = async () => {
    if (!slug) { toast.error('Feature name is required'); return }
    setLoading(true)
    try {
      const createRes = await fetch(`/api/${app}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: slug, storyKey: storyKey || undefined, module: moduleSlug ?? null }),
      })
      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to create feature')
      }

      const roles = availableRoles.length > 0
        ? selectedRoles
        : customRoles.split(',').map((r) => r.trim()).filter(Boolean)

      const answers: Record<string, IntakeValue> = {
        featureName,
        featureId,
        roles: roles.map((name) => ({ name })),
        modulePath,
        priority,
        appVersion,
        purpose: businessPurpose,
        screens: screens.filter((s) => s.name),
        userFlow,
        fields: fields.filter((f) => f.name),
        businessRules,
        edgeCases,
        relatedFeatures: relatedFeatures.filter((r) => r.name),
      }

      // Server compiles workflow.md from these answers. On a brand-new feature a
      // 409 (hand-written workflow.md) can only mean a pre-existing file that
      // predates this wizard run — the user's explicit intent here is to define
      // it, so retry once with force.
      let intakeRes = await fetch(`/api/${app}/intake`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'feature', slug, groupId: 'workflow', answers }),
      })
      if (intakeRes.status === 409) {
        intakeRes = await fetch(`/api/${app}/intake`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'feature', slug, groupId: 'workflow', answers, force: true }),
        })
      }
      if (!intakeRes.ok) {
        const data = await intakeRes.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save feature workflow')
      }

      if (screenshotFiles.length > 0) {
        const formData = new FormData()
        screenshotFiles.forEach((f) => formData.append('screenshots', f))
        await fetch(`/api/${app}/features/${slug}/screenshots`, {
          method: 'POST',
          body: formData,
        })
      }

      toast.success(`Feature "${featureName}" created!`)
      router.push(moduleSlug ? `/${app}/${moduleSlug}/features/${slug}` : `/${app}/features/${slug}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create feature')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create New Feature</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {appConfig ? `${appConfig.name} · ` : ''}Define a feature to generate test cases for
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold border-2 transition-colors',
                i < step
                  ? 'bg-primary border-primary text-primary-foreground'
                  : i === step
                  ? 'border-primary text-primary'
                  : 'border-muted text-muted-foreground'
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn('text-xs hidden sm:block', i === step ? 'font-semibold' : 'text-muted-foreground')}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px w-4 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Feature Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Feature Name *</label>
                <Input
                  value={featureName}
                  onChange={(e) => setFeatureName(e.target.value)}
                  placeholder="e.g., User Login"
                />
                {slug && <p className="text-xs text-muted-foreground">Folder: features/{slug}/</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Feature / Story ID</label>
                <Input
                  value={featureId}
                  onChange={(e) => setFeatureId(e.target.value)}
                  placeholder="e.g., FEAT-42"
                />
              </div>
            </div>

            {storyOptions.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">User Story <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Select value={storyKey || '__none__'} onValueChange={(v) => setStoryKey(v == null || v === '__none__' ? '' : v)}>
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
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role(s)</label>
              {!rolesLoaded ? (
                <p className="text-xs text-muted-foreground">Loading roles…</p>
              ) : availableRoles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableRoles.map((r) => (
                    <button
                      key={r} type="button" onClick={() => toggleRole(r)}
                      className={cn('rounded-full px-3 py-1 text-sm border transition-colors',
                        selectedRoles.includes(r)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input hover:bg-muted')}
                    >{r}</button>
                  ))}
                </div>
              ) : (
                <>
                  <Input
                    value={customRoles}
                    onChange={(e) => setCustomRoles(e.target.value)}
                    placeholder="e.g., Admin, Manager, Viewer (comma-separated)"
                  />
                  <p className="text-xs text-muted-foreground">
                    No user roles found yet — define them under App Profile to get a picker here next time.
                  </p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Module / Navigation Path</label>
              <Input
                value={modulePath}
                onChange={(e) => setModulePath(e.target.value)}
                placeholder="e.g., Settings → Users"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Priority</label>
                <Select value={priority} onValueChange={(v) => setPriority(v ?? 'P2')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">App Version</label>
                <Input
                  value={appVersion}
                  onChange={(e) => setAppVersion(e.target.value)}
                  placeholder="e.g., v1.0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Business Purpose / Objective</label>
              <Textarea
                value={businessPurpose}
                onChange={(e) => setBusinessPurpose(e.target.value)}
                placeholder="What does this feature do and why does it exist?"
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!featureName}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Screenshots */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Upload Screenshots / Mockups</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload UI screenshots or design mockups to help the AI understand the layout and fields.
            </p>
            <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer hover:bg-muted transition-colors">
              <span className="text-2xl mb-2">📷</span>
              <span className="text-sm font-medium">Click or drag to upload</span>
              <span className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP supported</span>
              <input type="file" multiple accept="image/*" className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  setScreenshotFiles((prev) => [...prev, ...files])
                }} />
            </label>
            {screenshotFiles.length > 0 && (
              <div className="space-y-1">
                {screenshotFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm truncate">{f.name}</span>
                    <button onClick={() => setScreenshotFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={() => setStep(2)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Workflow Details */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Workflow Details</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* Screens */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Screens / Pages</label>
              {screens.map((s, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., List View, Detail View, Create Form"
                      value={s.name}
                      onChange={(e) => updateScreen(i, 'name', e.target.value)}
                    />
                    <button onClick={() => setScreens((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                  <Textarea
                    placeholder="What this screen shows and allows the user to do..."
                    value={s.description}
                    onChange={(e) => updateScreen(i, 'description', e.target.value)}
                    rows={2}
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setScreens((p) => [...p, emptyScreen()])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Screen
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">User Flow (numbered steps)</label>
              <Textarea
                value={userFlow}
                onChange={(e) => setUserFlow(e.target.value)}
                rows={6}
                placeholder={'1. User opens the module\n2. Clicks New\n3. Fills in the form\n4. Submits'}
              />
            </div>

            {/* Field Definitions */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Field Definitions</label>
              <div className="overflow-x-auto">
                {fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-[2fr_1.5fr_80px_2fr_32px] gap-2 items-center min-w-[520px] mb-2">
                    <Input
                      placeholder="Field name"
                      value={f.name}
                      onChange={(e) => updateField(i, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="e.g., text, dropdown"
                      value={f.inputType}
                      onChange={(e) => updateField(i, 'inputType', e.target.value)}
                    />
                    <Select value={f.required} onValueChange={(v) => updateField(i, 'required', v ?? 'Yes')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Validation rules"
                      value={f.validation}
                      onChange={(e) => updateField(i, 'validation', e.target.value)}
                    />
                    <button onClick={() => setFields((p) => p.filter((_, idx) => idx !== i))}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => setFields((p) => [...p, emptyField()])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Field
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Business Rules (one per line)</label>
              <Textarea
                value={businessRules}
                onChange={(e) => setBusinessRules(e.target.value)}
                rows={4}
                placeholder={'Only Admin can delete\nAll required fields must be filled before submission'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Edge Cases / Known Behaviors</label>
              <Textarea
                value={edgeCases}
                onChange={(e) => setEdgeCases(e.target.value)}
                rows={3}
                placeholder={'If no data exists, show empty state\nTimeout after 30 minutes of inactivity'}
              />
            </div>

            {/* Related Features */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Related Features <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              {relatedFeatures.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Feature name"
                    value={r.name}
                    onChange={(e) => updateRelated(i, 'name', e.target.value)}
                  />
                  <Input
                    placeholder="Relationship — e.g. Row click destination"
                    value={r.relationship}
                    onChange={(e) => updateRelated(i, 'relationship', e.target.value)}
                  />
                  <button onClick={() => setRelatedFeatures((p) => p.filter((_, idx) => idx !== i))}>
                    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setRelatedFeatures((p) => [...p, emptyRelated()])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Related Feature
              </Button>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={() => setStep(3)}>Review <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Create */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Review & Create</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
              {[
                ['Name', featureName],
                ['Folder', `features/${slug}/`],
                ['User Story', storyKey || '—'],
                ['Feature ID', featureId || '—'],
                ['Role(s)', (availableRoles.length > 0 ? selectedRoles : customRoles.split(',').map((r) => r.trim()).filter(Boolean)).join(', ') || '—'],
                ['Priority', priority],
                ['App Version', appVersion || '—'],
                ['Screenshots', `${screenshotFiles.length} files`],
                ['Screens', `${screens.filter((s) => s.name).length} defined`],
                ['Fields', `${fields.filter((f) => f.name).length} defined`],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="font-medium w-32 shrink-0">{k}:</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-4 text-sm text-blue-900 dark:text-blue-300 space-y-1">
              <p className="font-semibold mb-2">What happens next:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Creates <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">features/{slug}/</code> folder</li>
                <li>Saves workflow as <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">workflow.md</code></li>
                {screenshotFiles.length > 0 && <li>Uploads {screenshotFiles.length} screenshot(s)</li>}
                <li>Go to the <strong>Generate</strong> tab to create test cases with AI</li>
              </ol>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={handleCreate} disabled={loading || !slug}>
                {loading ? 'Creating...' : <><Check className="h-4 w-4 mr-1" /> Create Feature</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
