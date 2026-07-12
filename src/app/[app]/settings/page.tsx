'use client'

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, EyeOff, Save, Settings2, CheckCircle2, XCircle, Upload, X, Lock, LockOpen, ArrowUp, ArrowDown, Plus, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AiSettingsTab } from '@/components/settings/AiSettingsTab'
import { IntakeGroupForm } from '@/components/shared/IntakeGroupForm'
import { ReadinessBadge } from '@/components/shared/ReadinessBadge'
import { AppSelect } from '@/components/shared/AppSelect'
import { APP_INTAKE_GROUPS, type IntakeValue } from '@/lib/intake-types'
import {
  DEFAULT_BUG_FORMAT,
  DEFAULT_JIRA_FIELD_SYNC,
  JIRA_SYNC_FIELDS,
  BUG_TYPE_OPTIONS,
  type BugFormatConfig,
  type BugVariantConfig,
  type JiraFieldSyncConfig,
  type JiraSyncFieldKey,
} from '@/lib/bug-format'
import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@/lib/board-config'

// ─── Types ────────────────────────────────────────────────────────────────────

type GlobalSettings = Record<string, string>
type AppSettings = {
  testerName: string
  testcaseEnvironment: string
  bugEnvironment: string
  jiraSubtaskIssueType: string
  jiraStoryBugIssueType: string
  jiraEpicBugIssueType: string
}
const APP_SETTING_KEYS = [
  'testerName',
  'testcaseEnvironment',
  'bugEnvironment',
  'jiraSubtaskIssueType',
  'jiraStoryBugIssueType',
  'jiraEpicBugIssueType',
] as const

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ value }: { value: string }) {
  if (value) {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CheckCircle2 className="h-3 w-3" />
        Configured
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
      <XCircle className="h-3 w-3" />
      Not set
    </Badge>
  )
}

interface CredentialRowProps {
  label: string
  description?: string
  fieldKey: string
  value: string
  onChange: (key: string, value: string) => void
  type?: 'text' | 'password'
}

function CredentialRow({ label, description, fieldKey, value, onChange, type = 'password' }: CredentialRowProps) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <label className="text-sm font-medium">{label}</label>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <StatusBadge value={value} />
      </div>
      <div className="flex gap-2">
        <Input
          type={isPassword && !revealed ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          placeholder={isPassword ? '••••••••••••••••' : `Enter ${label}`}
          className="font-mono text-sm h-9"
        />
        {isPassword && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => setRevealed((r) => !r)}
            title={revealed ? 'Hide' : 'Reveal'}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  )
}

interface ChipListEditorProps {
  items: string[]
  onAdd: (value: string) => void
  onRemove: (value: string) => void
  placeholder?: string
  disallowSpaces?: boolean
}

function ChipListEditor({ items, onAdd, onRemove, placeholder, disallowSpaces }: ChipListEditorProps) {
  const [input, setInput] = useState('')

  function handleAdd() {
    const value = input.trim()
    if (!value) return
    if (disallowSpaces && /\s/.test(value)) return
    onAdd(value)
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder={placeholder}
          className="h-9"
        />
        <Button type="button" variant="outline" onClick={handleAdd} className="shrink-0">
          Add
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const BUG_VARIANT_CORE_FIELDS = ['Title', 'Summary', 'Steps to Reproduce', 'Expected Result', 'Actual Result']

const BUG_VARIANT_OPTIONAL_FIELDS: { key: keyof BugVariantConfig['fields']; label: string }[] = [
  { key: 'environment', label: 'Environment' },
  { key: 'priority', label: 'Priority' },
  { key: 'severity', label: 'Severity' },
  { key: 'bugType', label: 'Bug Type' },
]

function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{children}</p>
}

/**
 * One field's "sync this to a Jira custom field" editor: enable toggle, field-ID
 * input, "Fetch options" (pulls Jira's real allowed values via createmeta), and a
 * per-value mapping dropdown once options are fetched. Fully generic over which
 * bug field it's editing — driven by `JIRA_SYNC_FIELDS` — so a new syncable field
 * is a registry entry, not a new copy of this component.
 */
interface JiraFieldSyncEditorProps {
  app: string
  variant: 'epic' | 'story'
  fieldKey: JiraSyncFieldKey
  label: string
  /** This field's acceptable values (e.g. severityOptions, or the fixed BUG_TYPE_OPTIONS list). */
  options: string[]
  value: JiraFieldSyncConfig
  onChange: (updater: (prev: JiraFieldSyncConfig) => JiraFieldSyncConfig) => void
}

function JiraFieldSyncEditor({ app, variant, fieldKey, label, options, value, onChange }: JiraFieldSyncEditorProps) {
  const [jiraOptions, setJiraOptions] = useState<{ id: string; value: string }[] | null>(null)
  const [fetchingOptions, setFetchingOptions] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  async function fetchJiraOptions() {
    if (!value.jiraFieldId) return
    setFetchingOptions(true)
    setFetchError(null)
    try {
      const res = await fetch(
        `/api/${app}/bug-format/jira-field-options?fieldId=${encodeURIComponent(value.jiraFieldId)}&variant=${variant}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to fetch Jira field options')
      const fetched: { id: string; value: string }[] = data.options ?? []
      setJiraOptions(fetched)
      if (fetched.length === 0) {
        setFetchError('Jira returned no options for this field — is it really a select-list field?')
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch Jira field options')
      setJiraOptions(null)
    } finally {
      setFetchingOptions(false)
    }
  }

  return (
    <div className="space-y-1.5 border-t pt-4">
      <GroupLabel>{label} → Jira</GroupLabel>
      <div className="flex items-center gap-3">
        <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={() => onChange((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className="h-4 w-4 accent-primary"
          />
          Send {label.toLowerCase()} as a Jira field
        </label>
        <Input
          value={value.jiraFieldId}
          onChange={(e) => {
            onChange(() => ({ enabled: value.enabled, jiraFieldId: e.target.value, valueMap: {} }))
            setJiraOptions(null)
            setFetchError(null)
          }}
          placeholder="customfield_10321"
          className="h-9 flex-1 font-mono text-sm"
          disabled={!value.enabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          disabled={!value.enabled || !value.jiraFieldId || fetchingOptions}
          onClick={fetchJiraOptions}
        >
          {fetchingOptions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Fetch options
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Turn on once the {label} field exists in Jira, set its custom field ID above, then fetch Jira&apos;s real
        options and map each of your {label.toLowerCase()} values below — Jira&apos;s option text (e.g. &quot;🟡
        Moderate&quot;) rarely matches yours verbatim.
      </p>
      {fetchError && <p className="text-xs text-destructive">{fetchError}</p>}
      {jiraOptions && jiraOptions.length > 0 && (
        <div className="space-y-1.5 rounded-lg border p-3">
          {options.map((optionValue) => (
            <div key={optionValue} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-sm">{optionValue}</span>
              <Select
                value={value.valueMap[optionValue] ?? ''}
                onValueChange={(id) =>
                  onChange((prev) => ({
                    ...prev,
                    valueMap: id
                      ? { ...prev.valueMap, [optionValue]: id }
                      : Object.fromEntries(Object.entries(prev.valueMap).filter(([k]) => k !== optionValue)),
                  }))
                }
              >
                <SelectTrigger className="h-8 flex-1 text-sm">
                  <SelectValue placeholder="— not mapped —" />
                </SelectTrigger>
                <SelectContent>
                  {jiraOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface BugVariantSectionProps {
  description: string
  /** Which variant this section edits — used only to word the "other tab" label hint. */
  variant: 'epic' | 'story'
  app: string
  config: BugVariantConfig
  /** Shared severity value list (same for epic/story) — mapped per-variant since the Jira field id can differ. */
  severityOptions: string[]
  onChange: (updater: (prev: BugVariantConfig) => BugVariantConfig) => void
}

function BugVariantSection({ description, variant, app, config, severityOptions, onChange }: BugVariantSectionProps) {
  const otherVariantLabel = variant === 'epic' ? 'Story' : 'Epic'

  function toggleField(field: keyof BugVariantConfig['fields']) {
    onChange((prev) => ({ ...prev, fields: { ...prev.fields, [field]: !prev.fields[field] } }))
  }

  function optionsForField(key: JiraSyncFieldKey): string[] {
    return key === 'severity' ? severityOptions : BUG_TYPE_OPTIONS
  }

  return (
    <div className="space-y-5 pt-4">
      <p className="text-xs text-muted-foreground">{description}</p>

      {/* Fields */}
      <div className="space-y-2.5">
        <GroupLabel>Fields</GroupLabel>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Always included: {BUG_VARIANT_CORE_FIELDS.join(' · ')}
        </p>
        <div className="flex flex-wrap gap-2">
          {BUG_VARIANT_OPTIONAL_FIELDS.map(({ key, label }) => {
            const checked = config.fields[key]
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  checked
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-input text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleField(key)}
                  className="h-4 w-4 accent-primary"
                />
                {label}
              </label>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Disabled fields are removed from the AI prompt, the bug form, and the report body.
        </p>
      </div>

      {/* Jira labels */}
      <div className="space-y-1.5 border-t pt-4">
        <GroupLabel>Jira labels</GroupLabel>
        <p className="text-xs text-muted-foreground">
          Pre-checked when reporting to Jira, in addition to the always-sent BUG label. No spaces (Jira restriction).
        </p>
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          These labels apply to {variant === 'epic' ? 'Epic' : 'Story'} bugs only — the {otherVariantLabel} tab has its own separate list.
        </p>
        <ChipListEditor
          items={config.jiraLabels}
          onAdd={(label) =>
            onChange((prev) => (prev.jiraLabels.includes(label) ? prev : { ...prev, jiraLabels: [...prev.jiraLabels, label] }))
          }
          onRemove={(label) => onChange((prev) => ({ ...prev, jiraLabels: prev.jiraLabels.filter((l) => l !== label) }))}
          placeholder="e.g. regression"
          disallowSpaces
        />
      </div>

      {/* Field -> Jira syncs (severity, bug type, ...) — one registry entry each, see JIRA_SYNC_FIELDS */}
      {JIRA_SYNC_FIELDS.map(({ key, label }) => (
        <JiraFieldSyncEditor
          key={key}
          app={app}
          variant={variant}
          fieldKey={key}
          label={label}
          options={optionsForField(key)}
          value={config.jiraFieldSyncs[key] ?? DEFAULT_JIRA_FIELD_SYNC}
          onChange={(updater) =>
            onChange((prev) => ({
              ...prev,
              jiraFieldSyncs: { ...prev.jiraFieldSyncs, [key]: updater(prev.jiraFieldSyncs[key] ?? DEFAULT_JIRA_FIELD_SYNC) },
            }))
          }
        />
      ))}
    </div>
  )
}

// One automatic retry for transient failures (dev HMR teardown, DB pool reconnect).
async function fetchWithRetry(url: string): Promise<Response> {
  try {
    const res = await fetch(url)
    if (res.status < 500) return res
  } catch { /* network error — retry below */ }
  await new Promise((r) => setTimeout(r, 700))
  return fetch(url)
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params = useParams()
  const app = params?.app as string

  // Edit lock — settings always open locked; user must explicitly unlock to edit.
  // Client-side only (no persistence, relocks on reload); server-side permissions
  // already gate who can actually save.
  const [locked, setLocked] = useState(true)

  // Global credentials
  const [globals, setGlobals] = useState<GlobalSettings>({})
  const [loadingGlobals, setLoadingGlobals] = useState(true)
  const [savingJira, setSavingJira] = useState(false)
  const [savingAutomation, setSavingAutomation] = useState(false)

  // Branding
  const [dashboardLogo, setDashboardLogo] = useState<string | null>(null)
  const [pendingLogo, setPendingLogo] = useState<string | null>(null)
  const [savingLogo, setSavingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Per-app defaults
  const [appSettings, setAppSettings] = useState<AppSettings>({
    testerName: '',
    testcaseEnvironment: '',
    bugEnvironment: '',
    jiraSubtaskIssueType: '',
    jiraStoryBugIssueType: '',
    jiraEpicBugIssueType: '',
  })
  const [loadingApp, setLoadingApp] = useState(true)
  const [savingDefaults, setSavingDefaults] = useState(false)

  // Per-app bug report format (epic/story variants + shared value lists)
  const [bugFormat, setBugFormat] = useState<BugFormatConfig>(DEFAULT_BUG_FORMAT)
  const [loadingBugFormat, setLoadingBugFormat] = useState(true)

  // Per-app retest board config
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG)
  const [loadingBoardConfig, setLoadingBoardConfig] = useState(true)
  const [savingBoard, setSavingBoard] = useState(false)
  const [jiraStatuses, setJiraStatuses] = useState<string[]>([])
  const [statusesError, setStatusesError] = useState(false)
  const [manualStatusInput, setManualStatusInput] = useState('')

  // App Profile (intake) tab
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, Record<string, IntakeValue>>>({})
  const [loadingIntake, setLoadingIntake] = useState(true)

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadGlobals = useCallback(async () => {
    setLoadingGlobals(true)
    try {
      const res = await fetchWithRetry('/api/settings')
      if (!res.ok) throw new Error('Failed to load credentials')
      const data: GlobalSettings = await res.json()
      setGlobals(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load credentials')
    } finally {
      setLoadingGlobals(false)
    }
  }, [])

  const loadAppSettings = useCallback(async () => {
    setLoadingApp(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/settings`)
      if (!res.ok) throw new Error('Failed to load defaults')
      const data = await res.json()
      setAppSettings({
        testerName: data.testerName ?? '',
        testcaseEnvironment: data.testcaseEnvironment ?? '',
        bugEnvironment: data.bugEnvironment ?? '',
        jiraSubtaskIssueType: data.jiraSubtaskIssueType ?? '',
        jiraStoryBugIssueType: data.jiraStoryBugIssueType ?? '',
        jiraEpicBugIssueType: data.jiraEpicBugIssueType ?? '',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load defaults')
    } finally {
      setLoadingApp(false)
    }
  }, [app])

  const loadBugFormat = useCallback(async () => {
    if (!app) return
    setLoadingBugFormat(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/bug-format`)
      if (!res.ok) throw new Error('Failed to load bug report format')
      const data = await res.json()
      setBugFormat(data.config ?? DEFAULT_BUG_FORMAT)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load bug report format')
    } finally {
      setLoadingBugFormat(false)
    }
  }, [app])

  const loadBoardConfig = useCallback(async () => {
    if (!app) return
    setLoadingBoardConfig(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/board-config`)
      if (!res.ok) throw new Error('Failed to load board settings')
      const data = await res.json()
      setBoardConfig(data.config ?? DEFAULT_BOARD_CONFIG)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load board settings')
    } finally {
      setLoadingBoardConfig(false)
    }
  }, [app])

  const loadJiraStatuses = useCallback(async () => {
    if (!app) return
    try {
      const res = await fetchWithRetry(`/api/${app}/board/statuses`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setJiraStatuses(Array.isArray(data.statuses) ? data.statuses : [])
      setStatusesError(false)
    } catch {
      setStatusesError(true)
    }
  }, [app])

  const loadLogos = useCallback(async () => {
    try {
      const res = await fetchWithRetry('/api/logo')
      if (res.ok) {
        const data: Record<string, string> = await res.json()
        const logo = data['dashboard'] ?? null
        setDashboardLogo(logo)
        setPendingLogo(logo)
      }
    } catch {}
  }, [])

  const loadIntake = useCallback(async () => {
    if (!app) return
    setLoadingIntake(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/intake?scope=app`)
      if (!res.ok) throw new Error('Failed to load app profile')
      const data = await res.json()
      setIntakeAnswers(data.answers ?? {})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load app profile')
    } finally {
      setLoadingIntake(false)
    }
  }, [app])

  useEffect(() => {
    loadGlobals()
    loadAppSettings()
    loadBugFormat()
    loadBoardConfig()
    loadJiraStatuses()
    loadLogos()
    loadIntake()
  }, [loadGlobals, loadAppSettings, loadBugFormat, loadBoardConfig, loadJiraStatuses, loadLogos, loadIntake])

  async function handleLogoFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setPendingLogo(dataUrl)
  }

  async function saveLogo() {
    setSavingLogo(true)
    try {
      const res = await fetch('/api/logo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'dashboard', value: pendingLogo ?? '' }),
      })
      if (res.ok) {
        setDashboardLogo(pendingLogo)
        toast.success('Logo saved — reload the page to see it in the sidebar')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error ?? 'Failed to save logo')
      }
    } finally {
      setSavingLogo(false)
    }
  }

  // ── Save helpers ─────────────────────────────────────────────────────────────

  function updateGlobal(key: string, value: string) {
    setGlobals((prev) => ({ ...prev, [key]: value }))
  }

  async function saveGlobalKeys(keys: string[], setSaving: (v: boolean) => void) {
    setSaving(true)
    try {
      // Skip fields still holding the masked value from GET (untouched) — resending
      // them would be rejected by the API (and would never carry the real secret anyway).
      const toSave = keys.filter((key) => !(globals[key] ?? '').startsWith('••••'))
      await Promise.all(
        toSave.map((key) =>
          fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: globals[key] ?? '' }),
          }).then((r) => {
            if (!r.ok) throw new Error(`Failed to save ${key}`)
          })
        )
      )
      toast.success('Saved successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveAppSettings() {
    setSavingDefaults(true)
    try {
      await Promise.all([
        ...APP_SETTING_KEYS.map((key) =>
          fetch(`/api/${app}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: appSettings[key] }),
          }).then((r) => {
            if (!r.ok) throw new Error(`Failed to save ${key}`)
          })
        ),
        fetch(`/api/${app}/bug-format`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: bugFormat }),
        }).then((r) => {
          if (!r.ok) throw new Error('Failed to save bug report format')
        }),
      ])
      toast.success('Defaults saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingDefaults(false)
    }
  }

  function toggleColumn(status: string) {
    setBoardConfig((prev) => {
      const has = prev.columns.includes(status)
      const columns = has ? prev.columns.filter((c) => c !== status) : [...prev.columns, status]
      const retestStatus = has && prev.retestStatus === status ? null : prev.retestStatus
      return { ...prev, columns, retestStatus }
    })
  }

  function moveColumn(status: string, dir: -1 | 1) {
    setBoardConfig((prev) => {
      const idx = prev.columns.indexOf(status)
      const newIdx = idx + dir
      if (idx < 0 || newIdx < 0 || newIdx >= prev.columns.length) return prev
      const columns = [...prev.columns]
      ;[columns[idx], columns[newIdx]] = [columns[newIdx], columns[idx]]
      return { ...prev, columns }
    })
  }

  function addManualStatus() {
    const value = manualStatusInput.trim()
    if (!value) return
    setJiraStatuses((prev) => (prev.includes(value) ? prev : [...prev, value]))
    setManualStatusInput('')
  }

  async function saveBoardConfig() {
    setSavingBoard(true)
    try {
      const res = await fetch(`/api/${app}/board-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: boardConfig }),
      })
      if (!res.ok) throw new Error('Failed to save board settings')
      const data = await res.json()
      setBoardConfig(data.config ?? boardConfig)
      toast.success('Board settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingBoard(false)
    }
  }

  const JIRA_KEYS =['JIRA_BASE_URL', 'JIRA_PROJECT_KEY', 'JIRA_BOARD_ID', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PAT']
  const AUTOMATION_KEYS = ['AUTOMATION_WEBHOOK_URL', 'AUTOMATION_SCHEDULE_ENABLED', 'AUTOMATION_SCHEDULE_TIME', 'AUTOMATION_SCHEDULE_TAG']
  const scheduleEnabled = globals['AUTOMATION_SCHEDULE_ENABLED'] === '1' || globals['AUTOMATION_SCHEDULE_ENABLED'] === 'true'

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Settings2 className="h-6 w-6 text-primary mt-0.5" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Credentials, integrations, and test case defaults</p>
          {locked && (
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">
              Locked — click Unlock to make changes
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => setLocked((l) => !l)}
        >
          {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          {locked ? 'Unlock to edit' : 'Lock'}
        </Button>
      </div>

      <Tabs defaultValue="credentials">
        <TabsList>
          <TabsTrigger value="profile">App Profile</TabsTrigger>
          <TabsTrigger value="credentials">Credentials &amp; Integrations</TabsTrigger>
          <TabsTrigger value="ai">AI &amp; Models</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="defaults">Test Case &amp; Bug Report Defaults</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
        </TabsList>

        {/* ── Tab: App Profile (structured intake) ── */}
        <TabsContent value="profile">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground max-w-2xl">
                The knowledge and formatting rules the AI reads for this app. Re-editing a section
                regenerates its compiled document immediately.
              </p>
              <ReadinessBadge app={app} />
            </div>
            {loadingIntake ? (
              <div className="space-y-3">
                {APP_INTAKE_GROUPS.map((g) => (
                  <div key={g.id} className="h-24 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : (
              APP_INTAKE_GROUPS.map((group) => (
                <Card key={group.id}>
                  <CardContent className="pt-5">
                    <IntakeGroupForm
                      app={app}
                      scope="app"
                      group={group}
                      initialAnswers={intakeAnswers[group.id]}
                      onSaved={(answers) => setIntakeAnswers((prev) => ({ ...prev, [group.id]: answers }))}
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          </fieldset>
        </TabsContent>

        {/* ── Tab: AI & Models ── */}
        <TabsContent value="ai">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`pt-4 ${locked ? 'opacity-75' : ''}`}>
            <AiSettingsTab app={app} />
          </div>
          </fieldset>
        </TabsContent>

        {/* ── Tab: Retest Board ── */}
        <TabsContent value="board">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Retest Board Columns</CardTitle>
                <CardDescription>
                  Choose which Jira statuses appear as columns on the board, in display order,
                  and which one represents &ldquo;ready to retest&rdquo;.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {loadingBoardConfig ? (
                  <div className="space-y-3">
                    <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                    <div className="h-24 rounded-lg bg-muted/40 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Columns</label>
                      <p className="text-xs text-muted-foreground">
                        Shown left to right on the board. Use the arrows to reorder.
                      </p>
                      {boardConfig.columns.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">No columns selected yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {boardConfig.columns.map((status, i) => (
                            <div key={status} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                              <span className="flex-1 text-sm truncate">{status}</span>
                              <Button
                                type="button" variant="ghost" size="icon" className="h-6 w-6"
                                disabled={i === 0}
                                onClick={() => moveColumn(status, -1)}
                                aria-label={`Move ${status} up`}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button" variant="ghost" size="icon" className="h-6 w-6"
                                disabled={i === boardConfig.columns.length - 1}
                                onClick={() => moveColumn(status, 1)}
                                aria-label={`Move ${status} down`}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                onClick={() => toggleColumn(status)}
                                aria-label={`Remove ${status}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 border-t pt-4">
                      <label className="text-sm font-medium">Add a status</label>
                      {statusesError && (
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          Couldn&apos;t load statuses from Jira — add them manually below.
                        </p>
                      )}
                      {jiraStatuses.filter((s) => !boardConfig.columns.includes(s)).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {jiraStatuses.filter((s) => !boardConfig.columns.includes(s)).map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => toggleColumn(status)}
                              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
                            >
                              <Plus className="h-3 w-3" /> {status}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Input
                          value={manualStatusInput}
                          onChange={(e) => setManualStatusInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualStatus() } }}
                          placeholder="Type a Jira status name…"
                          className="h-9"
                        />
                        <Button type="button" variant="outline" onClick={addManualStatus} className="shrink-0">
                          Add
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t pt-4">
                      <label className="text-sm font-medium">Retest status</label>
                      <p className="text-xs text-muted-foreground">
                        Its column is visually highlighted on the board and drives the &ldquo;Awaiting Retest&rdquo; dashboard count.
                      </p>
                      <AppSelect
                        options={[
                          { value: '__none__', label: 'None' },
                          ...boardConfig.columns.map((c) => ({ value: c, label: c })),
                        ]}
                        value={boardConfig.retestStatus ?? '__none__'}
                        onChange={(v) => setBoardConfig((prev) => ({ ...prev, retestStatus: v === '__none__' ? null : v }))}
                        className="w-[240px]"
                      />
                    </div>

                    <div className="border-t pt-4">
                      <label className="flex items-center gap-2.5 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={boardConfig.showDraftColumn}
                          onChange={(e) => setBoardConfig((prev) => ({ ...prev, showDraftColumn: e.target.checked }))}
                          className="h-4 w-4 accent-primary"
                        />
                        Show a &ldquo;Draft — not in Jira&rdquo; column for bugs without a Jira issue
                      </label>
                    </div>

                    <div className="pt-1">
                      <Button onClick={saveBoardConfig} disabled={savingBoard} className="gap-2">
                        <Save className="h-4 w-4" />
                        {savingBoard ? 'Saving…' : 'Save Board Settings'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          </fieldset>
        </TabsContent>

        {/* ── Tab 1: Credentials ── */}
        <TabsContent value="credentials">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>

            {/* AI provider keys live in the dedicated AI & Models tab (with key testing,
                the model registry, and per-app feature gating) — no duplicate here. */}

            {/* Jira Integration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Jira Integration</CardTitle>
                <CardDescription>
                  For creating and linking bug reports. Use PAT for Jira Server/Data Center, or Email + API Token for Jira Cloud. If PAT is set it takes precedence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingGlobals ? (
                  <div className="space-y-3">
                    {JIRA_KEYS.map((k) => (
                      <div key={k} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    <CredentialRow
                      label="Base URL"
                      description="e.g. https://yourcompany.atlassian.net or https://jira.internal"
                      fieldKey="JIRA_BASE_URL"
                      value={globals['JIRA_BASE_URL'] ?? ''}
                      onChange={updateGlobal}
                      type="text"
                    />
                    <CredentialRow
                      label="Project Key"
                      description="e.g. QA, PROJ, BUG"
                      fieldKey="JIRA_PROJECT_KEY"
                      value={globals['JIRA_PROJECT_KEY'] ?? ''}
                      onChange={updateGlobal}
                      type="text"
                    />
                    <CredentialRow
                      label="Board ID"
                      description="Optional — the agile board ID for auto-assigning issues"
                      fieldKey="JIRA_BOARD_ID"
                      value={globals['JIRA_BOARD_ID'] ?? ''}
                      onChange={updateGlobal}
                      type="text"
                    />
                    <div className="border-t pt-4 space-y-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Jira Cloud (Email + API Token)</p>
                      <CredentialRow
                        label="Email"
                        description="Your Atlassian account email"
                        fieldKey="JIRA_EMAIL"
                        value={globals['JIRA_EMAIL'] ?? ''}
                        onChange={updateGlobal}
                        type="text"
                      />
                      <CredentialRow
                        label="API Token"
                        description="Generate at id.atlassian.com → Security → API tokens"
                        fieldKey="JIRA_API_TOKEN"
                        value={globals['JIRA_API_TOKEN'] ?? ''}
                        onChange={updateGlobal}
                      />
                    </div>
                    <div className="border-t pt-4 space-y-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Jira Server / Data Center (PAT)</p>
                      <CredentialRow
                        label="Personal Access Token"
                        description="Profile → Personal Access Tokens in your Jira Server instance"
                        fieldKey="JIRA_PAT"
                        value={globals['JIRA_PAT'] ?? ''}
                        onChange={updateGlobal}
                      />
                    </div>
                    <div className="pt-1">
                      <Button
                        onClick={() => saveGlobalKeys(JIRA_KEYS, setSavingJira)}
                        disabled={savingJira}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {savingJira ? 'Saving…' : 'Save Jira Settings'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          </fieldset>
        </TabsContent>

        {/* ── Tab: Automation ── */}
        <TabsContent value="automation">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Scheduled Regression</CardTitle>
                <CardDescription>
                  Replays every automation on a daily schedule (server local time) and syncs
                  linked test-case statuses. Optionally limit the run to one tag.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingGlobals ? (
                  <div className="space-y-3">
                    <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                    <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <label className="flex items-center gap-2.5 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={scheduleEnabled}
                        onChange={(e) => updateGlobal('AUTOMATION_SCHEDULE_ENABLED', e.target.checked ? '1' : '0')}
                        className="h-4 w-4 accent-primary"
                      />
                      Run the regression automatically every day
                    </label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Time (HH:mm)</label>
                        <p className="text-xs text-muted-foreground">Server local time — e.g. 02:00 for a nightly run.</p>
                        <Input
                          value={globals['AUTOMATION_SCHEDULE_TIME'] ?? ''}
                          onChange={(e) => updateGlobal('AUTOMATION_SCHEDULE_TIME', e.target.value)}
                          placeholder="02:00"
                          className="h-9 font-mono"
                          disabled={!scheduleEnabled}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tag filter</label>
                        <p className="text-xs text-muted-foreground">Optional — only run automations with this tag (e.g. smoke).</p>
                        <Input
                          value={globals['AUTOMATION_SCHEDULE_TAG'] ?? ''}
                          onChange={(e) => updateGlobal('AUTOMATION_SCHEDULE_TAG', e.target.value)}
                          placeholder="all automations"
                          className="h-9"
                          disabled={!scheduleEnabled}
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Team Notifications</CardTitle>
                <CardDescription>
                  Regression summaries (scheduled or API-triggered) are posted here as{' '}
                  <code className="text-xs">{'{ text }'}</code> — works with Slack incoming
                  webhooks and Teams workflows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingGlobals ? (
                  <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                ) : (
                  <>
                    <CredentialRow
                      label="Webhook URL"
                      description="Leave empty to disable notifications"
                      fieldKey="AUTOMATION_WEBHOOK_URL"
                      value={globals['AUTOMATION_WEBHOOK_URL'] ?? ''}
                      onChange={updateGlobal}
                    />
                    <div className="pt-1">
                      <Button
                        onClick={() => saveGlobalKeys(AUTOMATION_KEYS, setSavingAutomation)}
                        disabled={savingAutomation}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {savingAutomation ? 'Saving…' : 'Save Automation Settings'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          </fieldset>
        </TabsContent>

        {/* ── Tab 3: Branding ── */}
        <TabsContent value="branding">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dashboard Logo</CardTitle>
                <CardDescription>
                  Shown in the sidebar next to &ldquo;Testing Dashboard&rdquo;. Square PNG or SVG recommended, max 2 MB.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview */}
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                    {pendingLogo
                      ? <img src={pendingLogo} alt="Logo preview" className="h-full w-full object-contain p-1" />
                      : <span className="text-2xl select-none">🧪</span>
                    }
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm text-muted-foreground">
                      {pendingLogo ? 'Preview of uploaded logo' : 'No logo uploaded — default icon is used'}
                    </p>
                    <div className="flex items-center gap-2">
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
                          className="gap-2 text-muted-foreground"
                          onClick={() => setPendingLogo(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFileSelect}
                />

                <div className="pt-1">
                  <Button
                    onClick={saveLogo}
                    disabled={savingLogo || pendingLogo === dashboardLogo}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {savingLogo ? 'Saving…' : 'Save Logo'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          </fieldset>
        </TabsContent>

        {/* ── Tab 2: Test Case & Bug Report Defaults ── */}
        <TabsContent value="defaults">
          <fieldset disabled={locked} className="contents min-w-0">
          <div className={`space-y-4 pt-4 ${locked ? 'opacity-75' : ''}`}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Test Case &amp; Bug Report Defaults</CardTitle>
                <CardDescription>
                  These values are injected into generated test cases and bug reports for this app. Each app can have its own defaults.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {loadingApp ? (
                  <div className="space-y-4">
                    <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                    <div className="h-24 rounded-lg bg-muted/40 animate-pulse" />
                    <div className="h-24 rounded-lg bg-muted/40 animate-pulse" />
                  </div>
                ) : (
                  <>
                    {/* Tester Display Name */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Tester Display Name</label>
                      <p className="text-xs text-muted-foreground">
                        Appears in the <code className="text-xs">Tester</code> column of every generated test case table.
                      </p>
                      <Input
                        value={appSettings.testerName}
                        onChange={(e) => setAppSettings((s) => ({ ...s, testerName: e.target.value }))}
                        placeholder="e.g. Jane Doe"
                        className="h-9"
                      />
                    </div>

                    {/* Test Case Environment */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Environment (Test Cases)</label>
                      <p className="text-xs text-muted-foreground">
                        Full string placed in the <code className="text-xs">Enviroment</code> column. The Role placeholder{' '}
                        <code className="text-xs">&lt;Admin|Auditor|…&gt;</code> is replaced per scenario by the AI.
                      </p>
                      <Textarea
                        value={appSettings.testcaseEnvironment}
                        onChange={(e) => setAppSettings((s) => ({ ...s, testcaseEnvironment: e.target.value }))}
                        className="min-h-[80px] resize-y font-mono text-sm"
                        placeholder="Browser: … | Environment: … | Role: <…>"
                      />
                    </div>

                    {/* Bug Report Environment */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Environment (Bug Reports)</label>
                      <p className="text-xs text-muted-foreground">
                        Injected into the <strong>Environment:</strong> section of generated bug reports.
                      </p>
                      <Textarea
                        value={appSettings.bugEnvironment}
                        onChange={(e) => setAppSettings((s) => ({ ...s, bugEnvironment: e.target.value }))}
                        className="min-h-[80px] resize-y font-mono text-sm"
                        placeholder="Browser: … | Environment: …"
                      />
                    </div>

                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bug Report Format</CardTitle>
                <CardDescription>
                  Which fields appear in generated bug reports, the Jira labels offered at report
                  time, and the Priority/Severity value lists — configured separately for Epic and
                  Story bugs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {loadingBugFormat ? (
                  <div className="space-y-4">
                    <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                    <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <Tabs defaultValue="epic">
                      <TabsList>
                        <TabsTrigger value="epic">Epic Bugs</TabsTrigger>
                        <TabsTrigger value="story">Story Bugs</TabsTrigger>
                      </TabsList>
                      <TabsContent value="epic">
                        <BugVariantSection
                          description="Bugs reported directly, with no parent story."
                          variant="epic"
                          app={app}
                          config={bugFormat.epic}
                          severityOptions={bugFormat.severityOptions}
                          onChange={(updater) => setBugFormat((prev) => ({ ...prev, epic: updater(prev.epic) }))}
                        />
                      </TabsContent>
                      <TabsContent value="story">
                        <BugVariantSection
                          description="Bugs linked to a parent story."
                          variant="story"
                          app={app}
                          config={bugFormat.story}
                          severityOptions={bugFormat.severityOptions}
                          onChange={(updater) => setBugFormat((prev) => ({ ...prev, story: updater(prev.story) }))}
                        />
                      </TabsContent>
                    </Tabs>

                    <div className="space-y-2.5 border-t pt-4">
                      <div>
                        <GroupLabel>Value lists (shared)</GroupLabel>
                        <p className="text-xs text-muted-foreground">
                          Apply to both Epic and Story bugs.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Priority values</label>
                          <p className="text-xs text-muted-foreground">
                            Values should start with P1–P4 to map to Jira priority (P1→Highest,
                            P2→High, P3→Medium, P4→Low); other values fall back to Medium.
                          </p>
                          <ChipListEditor
                            items={bugFormat.priorityOptions}
                            onAdd={(value) =>
                              setBugFormat((prev) =>
                                prev.priorityOptions.includes(value)
                                  ? prev
                                  : { ...prev, priorityOptions: [...prev.priorityOptions, value] }
                              )
                            }
                            onRemove={(value) =>
                              setBugFormat((prev) => ({
                                ...prev,
                                priorityOptions: prev.priorityOptions.filter((v) => v !== value),
                              }))
                            }
                            placeholder="e.g. P1 – Critical"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Severity values</label>
                          <p className="text-xs text-muted-foreground">
                            Used for the Severity dropdown in bug forms.
                          </p>
                          <ChipListEditor
                            items={bugFormat.severityOptions}
                            onAdd={(value) =>
                              setBugFormat((prev) =>
                                prev.severityOptions.includes(value)
                                  ? prev
                                  : { ...prev, severityOptions: [...prev.severityOptions, value] }
                              )
                            }
                            onRemove={(value) =>
                              setBugFormat((prev) => ({
                                ...prev,
                                severityOptions: prev.severityOptions.filter((v) => v !== value),
                              }))
                            }
                            placeholder="e.g. S1 – Critical"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Jira Issue Types</CardTitle>
                <CardDescription>
                  The Jira issue type names used when this app creates issues. These must match
                  the issue type names configured in your Jira project. Each app can have its own.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {loadingApp ? (
                  <div className="space-y-4">
                    <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                    <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                    <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Testing Phase Sub-task Type</label>
                      <p className="text-xs text-muted-foreground">
                        Created under the story when you set its state to Testcase Design, Execution, or Retest.
                      </p>
                      <Input
                        value={appSettings.jiraSubtaskIssueType}
                        onChange={(e) => setAppSettings((s) => ({ ...s, jiraSubtaskIssueType: e.target.value }))}
                        placeholder="Sub-task"
                        className="h-9 font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Story Bug Issue Type</label>
                      <p className="text-xs text-muted-foreground">
                        Used when a bug is reported under a story (with a parent key).
                      </p>
                      <Input
                        value={appSettings.jiraStoryBugIssueType}
                        onChange={(e) => setAppSettings((s) => ({ ...s, jiraStoryBugIssueType: e.target.value }))}
                        placeholder="Dev Bug"
                        className="h-9 font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Epic Bug Issue Type</label>
                      <p className="text-xs text-muted-foreground">
                        Used when a bug is reported at the epic/project level (no parent story).
                      </p>
                      <Input
                        value={appSettings.jiraEpicBugIssueType}
                        onChange={(e) => setAppSettings((s) => ({ ...s, jiraEpicBugIssueType: e.target.value }))}
                        placeholder="Bug"
                        className="h-9 font-mono text-sm"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="pt-1">
              <Button
                onClick={saveAppSettings}
                disabled={savingDefaults || loadingApp || loadingBugFormat}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {savingDefaults ? 'Saving…' : 'Save Defaults'}
              </Button>
            </div>
          </div>
          </fieldset>
        </TabsContent>
      </Tabs>
    </div>
  )
}
