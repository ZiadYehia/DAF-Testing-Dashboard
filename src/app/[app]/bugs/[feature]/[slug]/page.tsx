'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { titleCase, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AppSelect } from '@/components/shared/AppSelect'
import { ArrowLeft, Save, Eye, Pencil, ExternalLink, Send, RefreshCw, Paperclip, UploadCloud, Trash2, X, Play } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { BugDetail, AttachmentSummary } from '@/lib/bugs'
import { Lightbox, type LightboxItem } from '@/components/shared/Lightbox'
import { useBugFormat } from '@/hooks/useBugFormat'
import { LabelMultiSelect } from '@/components/shared/LabelMultiSelect'
import { BUG_TYPE_OPTIONS, LAYER_OPTIONS, getVariantConfig, jiraSummaryForBug, type BugLayer } from '@/lib/bug-format'

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Keep the bug's current value selectable even if it's since fallen out of the configured option list. */
function withCurrentValue(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options
}

const PRIORITY_BADGE: Record<string, string> = {
  P1: 'bg-red-100 text-red-700 border-red-200/70 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/20',
  P2: 'bg-orange-100 text-orange-700 border-orange-200/70 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/20',
  P3: 'bg-amber-100 text-amber-700 border-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20',
  P4: 'bg-zinc-100 text-zinc-600 border-zinc-200/70 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/20',
}

function priorityBadgeCls(p: string) {
  const key = p?.includes('P1') ? 'P1' : p?.includes('P2') ? 'P2' : p?.includes('P3') ? 'P3' : 'P4'
  return PRIORITY_BADGE[key] ?? PRIORITY_BADGE.P4
}

export default function BugDetailPage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const app = params?.app as string
  const feature = params?.feature as string
  const parts = pathname?.split('/') ?? []
  const appIdx = parts.indexOf(app)
  const bugsIdx = parts.indexOf('bugs', appIdx)
  const moduleSlug = bugsIdx > appIdx + 1 ? parts[appIdx + 1] : null
  const bugsBase = moduleSlug ? `/${app}/${moduleSlug}/bugs` : `/${app}/bugs`
  const slug = params?.slug as string

  const { config } = useBugFormat(app)

  const [bug, setBug] = useState<BugDetail & { jira_url?: string | null } | null>(null)
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState('')
  const [bugType, setBugType] = useState('')
  const [severity, setSeverity] = useState('')
  const [layer, setLayer] = useState<BugLayer>('unknown')
  const [parentKey, setParentKey] = useState('')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  // Which fields to show follows the persisted parent story key being edited above.
  const variantConfig = getVariantConfig(config, parentKey || null)

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportScope, setReportScope] = useState<'story' | 'epic'>('epic')
  const [reportParentKey, setReportParentKey] = useState('')
  const [reportLabels, setReportLabels] = useState<string[]>([])
  const [reporting, setReporting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // The report modal's own scope choice ('story'/'epic' line up 1:1 with the
  // config's variant keys) — independent of the persisted parentKey above, since
  // the user can change scope in the modal before reporting.
  const reportVariantConfig = config[reportScope]

  // Attachments state
  const [attachments, setAttachments] = useState<AttachmentSummary[]>([])
  const [uploadingAttach, setUploadingAttach] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ name: string; pct: number }[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [confirmDeleteAttach, setConfirmDeleteAttach] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/${app}/bugs/${feature}/${slug}/attachments`)
      if (res.ok) setAttachments(await res.json())
    } catch { /* non-fatal */ }
  }, [app, feature, slug])

  const loadBug = useCallback(async () => {
    const res = await fetch(`/api/${app}/bugs/${feature}/${slug}`)
    if (!res.ok) { router.push(bugsBase); return }
    const data: BugDetail = await res.json()
    setBug(data)
    setBody(data.body)
    setPriority(data.priority)
    setBugType(data.bug_type)
    setSeverity(data.severity ?? '')
    setLayer((data.layer as BugLayer) ?? 'unknown')
    setParentKey(data.parent_key ?? '')
  }, [app, feature, slug, router])

  useEffect(() => { loadBug(); loadAttachments() }, [loadBug, loadAttachments])

  // Pre-check the report scope's configured labels — re-init whenever the modal
  // opens or the scope toggles, so the offered labels follow the user's choice.
  useEffect(() => {
    if (reportModalOpen) setReportLabels(reportVariantConfig.jiraLabels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportModalOpen, reportScope, config])

  // Upload a single file via XHR so we get real per-file progress (matters for videos)
  const uploadOne = (file: File): Promise<void> =>
    new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('attachments', file)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `/api/${app}/bugs/${feature}/${slug}/attachments`)
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return
        const pct = Math.round((e.loaded / e.total) * 100)
        setUploadProgress((prev) => prev.map((p) => (p.name === file.name ? { ...p, pct } : p)))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else {
          let msg = 'Upload failed'
          try { msg = JSON.parse(xhr.responseText).error ?? msg } catch { /* keep default */ }
          reject(new Error(msg))
        }
      }
      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(formData)
    })

  const uploadAttachments = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    const tooBig = list.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (tooBig) {
      toast.error(`${tooBig.name} is too large (max 25 MB)`)
      return
    }
    setUploadingAttach(true)
    setUploadProgress(list.map((f) => ({ name: f.name, pct: 0 })))
    let ok = 0
    for (const f of list) {
      try {
        await uploadOne(f)
        ok++
      } catch (err) {
        toast.error(`${f.name}: ${err instanceof Error ? err.message : 'upload failed'}`)
      }
    }
    await loadAttachments()
    if (ok > 0) toast.success(`${ok} attachment(s) uploaded`)
    setUploadProgress([])
    setUploadingAttach(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = async () => {
    if (!confirmDeleteAttach) return
    try {
      await fetch(`/api/${app}/bugs/${feature}/${slug}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: confirmDeleteAttach }),
      })
      await loadAttachments()
      toast.success('Attachment deleted')
    } catch {
      toast.error('Delete failed')
    }
    setConfirmDeleteAttach(null)
  }

  // Paste-to-upload: capture images from the clipboard (Snipping Tool, etc.)
  const uploadRef = useRef(uploadAttachments)
  uploadRef.current = uploadAttachments
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      // Don't hijack paste while typing in a text field
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      Array.from(items).forEach((it, i) => {
        if (it.kind !== 'file') return
        const f = it.getAsFile()
        if (f && f.type.startsWith('image/')) {
          const ext = f.type.split('/')[1] || 'png'
          files.push(new File([f], `pasted-${Date.now()}-${i}.${ext}`, { type: f.type }))
        }
      })
      if (files.length) { e.preventDefault(); uploadRef.current(files) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const openReportModal = () => {
    const savedParent = bug?.parent_key ?? ''
    setReportParentKey(savedParent)
    setReportScope(savedParent ? 'story' : 'epic')
    setReportModalOpen(true)
  }

  const saveBugHandler = async () => {
    setSaving(true)
    try {
      await fetch(`/api/${app}/bugs/${feature}/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, priority, bug_type: bugType, severity, layer, parent_key: parentKey || null }),
      })
      toast.success('Bug report saved!')
      await loadBug()
    } catch {
      toast.error('Save failed')
    }
    setSaving(false)
  }

  const confirmReport = async () => {
    if (reportScope === 'story' && !reportParentKey.trim()) {
      toast.error('Enter the parent story key (e.g. DT-2840)')
      return
    }
    setReporting(true)
    try {
      const res = await fetch(`/api/${app}/bugs/${feature}/${slug}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_key: reportScope === 'story' ? reportParentKey.trim() : null,
          layer,
          labels: reportLabels,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unknown error')
      setReportModalOpen(false)
      toast.success(`Reported to Jira as ${data.jira_key}!`)
      await loadBug()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Jira report failed')
    }
    setReporting(false)
  }

  const syncToJira = async () => {
    setSyncing(true)
    try {
      // Save local changes first, then push to Jira
      await fetch(`/api/${app}/bugs/${feature}/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, priority, bug_type: bugType, severity, layer, parent_key: parentKey || null }),
      })
      const res = await fetch(`/api/${app}/bugs/${feature}/${slug}/jira-sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Jira sync failed')
      toast.success('Saved and synced to Jira!')
      await loadBug()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    }
    setSyncing(false)
  }

  if (!bug) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const isReported = bug.status === 'reported'

  const attachmentItems: LightboxItem[] = attachments.map((a) => ({
    src: `/api/${app}/bugs/${feature}/${slug}/attachments/${encodeURIComponent(a.fileName)}`,
    name: a.fileName,
    isVideo: a.mimeType.startsWith('video/'),
  }))

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Report to Jira modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Bug to Jira</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <span className="text-sm font-medium">Bug Scope</span>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reportScope"
                    value="epic"
                    checked={reportScope === 'epic'}
                    onChange={() => setReportScope('epic')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Epic Bug</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reportScope"
                    value="story"
                    checked={reportScope === 'story'}
                    onChange={() => setReportScope('story')}
                    className="accent-primary"
                  />
                  <span className="text-sm">Story Bug</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                {reportScope === 'story'
                  ? 'Creates a Test subtask under the story.'
                  : 'Creates a standard Bug issue at the epic/project level.'}
              </p>
            </div>
            {reportScope === 'story' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Parent Story Key</label>
                <Input
                  value={reportParentKey}
                  onChange={(e) => setReportParentKey(e.target.value.toUpperCase())}
                  placeholder="e.g. DT-2840"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Jira key of the story this bug belongs to</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Jira summary: <span className="font-mono text-foreground">{jiraSummaryForBug(layer, bug.title)}</span>
              {' '}<span className="text-muted-foreground/80">(based on the Layer set above — Frontend/Backend/Unknown)</span>
            </p>
            <LabelMultiSelect
              labels={reportVariantConfig.jiraLabels}
              selected={reportLabels}
              onChange={setReportLabels}
              disabled={reporting}
            />
            {attachments.length > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Paperclip className="h-3 w-3" />
                {attachments.length} attachment(s) will be uploaded to the Jira ticket.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportModalOpen(false)} disabled={reporting}>
              Cancel
            </Button>
            <Button onClick={confirmReport} disabled={reporting}>
              <Send className="h-3.5 w-3.5 mr-1" />
              {reporting ? 'Reporting…' : 'Report to Jira'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(bugsBase)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">{bug.title}</h1>
          <p className="text-xs text-muted-foreground">
            {titleCase(feature)} · {slug}
          </p>
        </div>
      </div>

      {/* Meta Bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {variantConfig.fields.priority && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Priority</span>
                <AppSelect
                  variant="inline"
                  options={withCurrentValue(config.priorityOptions, priority).map((p) => ({ value: p, label: p, badgeClassName: priorityBadgeCls(p) }))}
                  value={priority}
                  onChange={setPriority}
                  triggerBadgeClassName={priorityBadgeCls(priority)}
                />
              </div>
            )}
            {(variantConfig.fields.severity || !!severity.trim()) && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Severity</span>
                <AppSelect
                  variant="inline"
                  options={withCurrentValue(config.severityOptions, severity).map((s) => ({ value: s, label: s }))}
                  value={severity || null}
                  onChange={setSeverity}
                  placeholder="Set severity"
                />
              </div>
            )}
            {variantConfig.fields.bugType && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Type</span>
                <AppSelect
                  variant="inline"
                  options={withCurrentValue(BUG_TYPE_OPTIONS, bugType).map((t) => ({ value: t, label: t }))}
                  value={bugType}
                  onChange={setBugType}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Layer</span>
              <AppSelect
                variant="inline"
                options={LAYER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={layer}
                onChange={(v) => setLayer(v as BugLayer)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Parent Story</span>
              <Input
                value={parentKey}
                onChange={(e) => setParentKey(e.target.value.toUpperCase())}
                placeholder="DT-XXXX (optional)"
                className="h-7 text-xs w-32"
              />
            </div>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <StatusBadge status={bug.status} />
            {bug.jira_key && bug.jira_url && (
              <a
                href={bug.jira_url}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                {bug.jira_key} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {bug.jira_key && !bug.jira_url && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                {bug.jira_key}
              </span>
            )}
            {bug.reported_at && (
              <span className="text-xs text-muted-foreground">
                Reported {formatDateTime(bug.reported_at)}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={saveBugHandler} disabled={saving || syncing}>
                <Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'Saving…' : 'Save'}
              </Button>
              {isReported ? (
                <Button size="sm" variant="outline" onClick={syncToJira} disabled={syncing || saving}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing…' : 'Sync to Jira'}
                </Button>
              ) : (
                <Button size="sm" onClick={openReportModal} disabled={saving}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Report to Jira
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2 pb-3">
          <CardTitle className="text-base">Bug Report</CardTitle>
          <div className="flex rounded-md border overflow-hidden">
            <button onClick={() => setPreview(false)}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${!preview ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button onClick={() => setPreview(true)}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${preview ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              <Eye className="h-3 w-3" /> Preview
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {preview ? (
            <div className="prose prose-sm max-w-none min-h-64 overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          ) : (
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-sm min-h-[500px] resize-y"
              placeholder="Bug report content..."
            />
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Attachments
            {attachments.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({attachments.length})</span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Images &amp; video, up to 25 MB each. Uploaded to Jira on report/sync.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              if (e.dataTransfer.files.length) uploadAttachments(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-6 px-4 text-center cursor-pointer transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50 hover:bg-muted/40'
            }`}
          >
            <UploadCloud className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {uploadingAttach ? 'Uploading…' : 'Drag & drop or click to upload screenshots / videos'}
            </p>
            {!uploadingAttach && (
              <p className="text-xs text-muted-foreground/70">…or paste a screenshot with Ctrl+V</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) uploadAttachments(e.target.files) }}
            />
          </div>

          {/* Upload progress */}
          {uploadProgress.length > 0 && (
            <div className="space-y-2">
              {uploadProgress.map((p) => (
                <div key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate pr-2">{p.name}</span>
                    <span className="tabular-nums shrink-0">{p.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-150" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grid */}
          {attachments.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {attachments.map((att, i) => {
                const src = attachmentItems[i].src
                const isVideo = attachmentItems[i].isVideo
                return (
                  <div key={att.fileName} className="group relative rounded-lg border overflow-hidden bg-muted/30">
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className="relative block w-full aspect-video bg-black/5 dark:bg-white/5 cursor-pointer"
                      title="Click to view"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <video
                        src={src}
                        muted
                        preload="metadata"
                        className={`absolute inset-0 h-full w-full object-contain ${isVideo ? '' : 'hidden'}`}
                      />
                      {!isVideo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={att.fileName} className="absolute inset-0 h-full w-full object-contain" />
                      )}
                      {isVideo && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="h-9 w-9 rounded-full bg-black/55 text-white flex items-center justify-center group-hover:bg-black/70 transition-colors">
                            <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
                          </span>
                        </span>
                      )}
                    </button>
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <div className="min-w-0">
                        <p className="text-xs truncate" title={att.fileName}>{att.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatBytes(att.size)} · {isVideo ? 'video' : 'image'}
                        </p>
                      </div>
                      <button
                        onClick={() => setConfirmDeleteAttach(att.fileName)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete attachment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete attachment confirm */}
      <Dialog open={!!confirmDeleteAttach} onOpenChange={(o) => !o && setConfirmDeleteAttach(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete attachment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-1 break-all">{confirmDeleteAttach}</p>
          <p className="text-xs text-muted-foreground">
            This removes it from the dashboard. It will not be removed from Jira if already synced.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteAttach(null)}>Cancel</Button>
            <Button variant="destructive" onClick={removeAttachment}>
              <X className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment lightbox */}
      <Lightbox
        items={attachmentItems}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  )
}
