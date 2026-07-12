'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, Upload, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AppSelect } from '@/components/shared/AppSelect'
import { IntakeGroupForm } from '@/components/shared/IntakeGroupForm'
import { invalidateApps } from '@/lib/use-apps'
import { APP_TYPES, appSlugIsValid, defaultCapabilities, type AppConfig } from '@/lib/app-types'
import { APP_INTAKE_GROUPS, type IntakeValue } from '@/lib/intake-types'
import { slugify } from '@/lib/utils'

const TYPE_OPTIONS = APP_TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))

const STEPS = ['Basics', 'Capabilities', 'Domain', 'Testing', 'Bugs', 'Automation'] as const

// Steps 2-5 each render the matching APP_INTAKE_GROUPS entry (domain/testing/bugs/automation).
const INTAKE_STEP_OFFSET = 2

export default function NewAppPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [appCreated, setAppCreated] = useState(false)

  // Basics
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [type, setType] = useState<AppConfig['type']>('web')
  const [platform, setPlatform] = useState('')
  const [icon, setIcon] = useState('📦')
  const [logo, setLogo] = useState('')

  // Capabilities
  const [caps, setCaps] = useState(defaultCapabilities())

  // Intake answers collected so far, keyed by group id — lets "Back" show what
  // was last saved for a group instead of a blank form.
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, Record<string, IntakeValue>>>({})

  function onName(v: string) {
    setName(v)
    if (!slugEdited) setSlug(slugify(v))
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Logo must be an image'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setLogo(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  }

  const basicsValid = !!name.trim() && appSlugIsValid(slug)

  /** Creates the app (name/slug/capabilities only) then advances to the Domain step. */
  async function createApp() {
    if (!basicsValid) { setStep(0); toast.error('Name and a valid slug are required'); return }
    setSaving(true)
    const res = await fetch('/api/admin/apps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug, name: name.trim(), description, type, platform, icon, logo,
        capabilities: caps,
      }),
    })
    setSaving(false)
    if (res.ok) {
      invalidateApps()
      setAppCreated(true)
      toast.success(`App "${name}" created — now let's fill in what the AI needs to know`)
      setStep(2)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Failed to create app')
    }
  }

  function goToCapabilitiesNext() {
    // Once the app exists, Back → Capabilities → Next must not try to re-create it.
    if (appCreated) setStep(2)
    else void createApp()
  }

  function finishLater() {
    router.push('/admin/apps')
  }

  function handleGroupSaved(groupId: string, answers: Record<string, IntakeValue>, stepIndex: number) {
    setIntakeAnswers((prev) => ({ ...prev, [groupId]: answers }))
    if (stepIndex < STEPS.length - 1) {
      setStep(stepIndex + 1)
    } else {
      toast.success('App setup complete')
      router.push('/admin/apps')
    }
  }

  const isIntakeStep = step >= INTAKE_STEP_OFFSET
  const intakeGroup = isIntakeStep ? APP_INTAKE_GROUPS[step - INTAKE_STEP_OFFSET] : null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="xs" nativeButton={false} render={<Link href="/admin/apps" />}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Apps
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-semibold">Add an app</h1>
        <p className="text-sm text-muted-foreground">Set up a new app and give the AI the knowledge it needs to write good test cases.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
              i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={i === step ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
            {i < STEPS.length - 1 && <span className="text-muted-foreground/40 mx-1">→</span>}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-5 space-y-4">
          {step === 0 && (
            <>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Acme Portal" />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">URL slug</label>
                <Input
                  value={slug}
                  onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true) }}
                  placeholder="acme-portal"
                />
                <p className="text-xs text-muted-foreground">
                  Used in the URL: <code>/{slug || 'slug'}</code>. Lowercase letters, numbers and hyphens.
                  {slug && !appSlugIsValid(slug) && <span className="text-destructive"> Invalid slug.</span>}
                </p>
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Description</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  placeholder="One line describing what this app is." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Type</label>
                  <AppSelect options={TYPE_OPTIONS.map(o => ({ ...o }))} value={type}
                    onChange={(v) => setType(v as AppConfig['type'])} size="sm" />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Platform</label>
                  <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Browser / Android / Windows" />
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
                        Upload logo
                      </Button>
                      {logo && (
                        <Button variant="ghost" size="sm" onClick={() => setLogo('')}>
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
                    <p className="text-xs text-muted-foreground">PNG/SVG under 2 MB. The emoji is used when no logo is set.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose which dashboard features this app should have.</p>
              {([
                ['testCaseWriter', 'Test-case writer', 'AI generation of test cases from features and acceptance criteria.'],
                ['featureWizard', 'Feature wizard', 'Guided flow to create features and capture their workflow.'],
                ['moduleKnowledge', 'Module knowledge', 'Pull stories from the board and synthesize per-module domain knowledge. Best for large, multi-module web apps.'],
              ] as const).map(([key, label, desc]) => (
                <label key={key} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/40">
                  <input type="checkbox" className="mt-1" checked={caps[key]}
                    onChange={(e) => setCaps((c) => ({ ...c, [key]: e.target.checked }))} />
                  <span>
                    <span className="text-sm font-medium block">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {isIntakeStep && intakeGroup && (
            <div className="space-y-4">
              {!appCreated ? (
                <p className="text-sm text-muted-foreground">Create the app first (Basics + Capabilities) to continue.</p>
              ) : (
                <IntakeGroupForm
                  key={intakeGroup.id}
                  app={slug}
                  scope="app"
                  group={intakeGroup}
                  initialAnswers={intakeAnswers[intakeGroup.id]}
                  onSaved={(answers) => handleGroupSaved(intakeGroup.id, answers, step)}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {!isIntakeStep ? (
          <Button
            disabled={(step === 0 && !basicsValid) || saving}
            onClick={() => (step === 1 ? goToCapabilitiesNext() : setStep((s) => s + 1))}
          >
            {step === 1 && !appCreated ? (saving ? 'Creating…' : 'Create app') : 'Next'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => s + 1)}>
                Skip this step
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" onClick={finishLater}>
              Finish later
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
