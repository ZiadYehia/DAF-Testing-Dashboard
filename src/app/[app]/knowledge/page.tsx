'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Save, FileText, BookOpen, ChevronLeft, Info, HelpCircle, Sparkles, ArrowRight, Layers, ListChecks, PencilRuler } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { usePermissions } from '@/lib/use-permissions'

interface KnowledgeFile {
  filename: string
  title: string
  size: number
}

interface KnowledgeGap {
  source: string
  tier: 'feature' | 'module' | 'app'
  items: string[]
}

export default function KnowledgePage() {
  const params = useParams()
  const pathname = usePathname()
  const app = params?.app as string
  // Detect module from pathname:
  //   /[app]/knowledge              → app-level (null)
  //   /[app]/m/[module]/knowledge   → whatever [module] is
  //   /[app]/[prefix]/knowledge     → module whose pathPrefix matches [prefix]
  const pathParts = pathname?.split('/') ?? []
  const appIdx = pathParts.indexOf(app)
  const knowledgeIdx = pathParts.indexOf('knowledge', appIdx + 1)
  const mid = knowledgeIdx > appIdx ? pathParts.slice(appIdx + 1, knowledgeIdx) : []
  const directModule = mid[0] === 'm' ? (mid[1] ?? null) : null
  const urlPrefix = mid[0] && mid[0] !== 'm' ? mid[0] : ''

  // undefined = still resolving the URL prefix to a module slug; null = app-level
  const [moduleParam, setModuleParam] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (directModule) { setModuleParam(directModule); return }
    if (!urlPrefix) { setModuleParam(null); return }
    let cancelled = false
    fetch(`/api/${app}/modules`)
      .then((r) => (r.ok ? r.json() : []))
      .then((modules: { slug: string; pathPrefix: string }[]) => {
        if (cancelled) return
        const matched = Array.isArray(modules) ? modules.find((m) => m.pathPrefix === urlPrefix) : undefined
        // Fall back to the segment itself — covers the legacy /[app]/framework route
        setModuleParam(matched?.slug ?? urlPrefix)
      })
      .catch(() => { if (!cancelled) setModuleParam(urlPrefix) })
    return () => { cancelled = true }
  }, [app, directModule, urlPrefix])

  const moduleQuery = moduleParam ? `?module=${moduleParam}` : ''

  // Display path for user-facing messages
  const knowledgeDirDisplay = moduleParam
    ? `data/${app}/modules/${moduleParam}/knowledge/`
    : `data/${app}/knowledge/`

  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null)
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(true)
  const { can } = usePermissions(app)
  const canEdit = can('knowledge.edit')
  const [gaps, setGaps] = useState<KnowledgeGap[]>([])
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (moduleParam === undefined) return // wait for prefix → module resolution
    fetch(`/api/${app}/knowledge${moduleQuery}`)
      .then((r) => r.json())
      .then((data: KnowledgeFile[]) => { setFiles(data); setLoadingList(false) })
  }, [app, moduleQuery, moduleParam])

  // Aggregated open questions across the app's knowledge (app-level view only).
  useEffect(() => {
    if (moduleParam !== null) return
    fetch(`/api/${app}/knowledge/gaps`)
      .then((r) => r.json())
      .then((d) => setGaps(Array.isArray(d.gaps) ? d.gaps : []))
      .catch(() => {})
  }, [app, moduleParam])

  const openFile = useCallback(async (file: KnowledgeFile) => {
    setSelectedFile(file)
    setLoadingFile(true)
    setPreview(true) // always start in preview; edit toggle only shown when canEdit
    const res = await fetch(`/api/${app}/knowledge/${file.filename}${moduleQuery}`)
    const data = await res.json()
    setContent(data.content ?? '')
    setOriginalContent(data.content ?? '')
    setLoadingFile(false)
  }, [app, moduleQuery])

  const saveFile = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      const res = await fetch(`/api/${app}/knowledge/${selectedFile.filename}${moduleQuery}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Save failed')
      }
      setOriginalContent(content)
      toast.success('Knowledge file saved!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
    setSaving(false)
  }

  const isDirty = content !== originalContent

  if (loadingList) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        {selectedFile && (
          <button
            onClick={() => { setSelectedFile(null); setContent(''); setOriginalContent('') }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            All files
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Knowledge Base
          </h1>
          {!selectedFile && (
            <p className="text-muted-foreground text-sm mt-1">
              {moduleParam
                ? `Module-level knowledge — injected when generating test cases for any ${moduleParam} feature.`
                : 'Platform-wide knowledge — injected into every test case and bug report generation.'}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHelpOpen(true)}
          className="ml-auto gap-1.5 shrink-0"
        >
          <HelpCircle className="h-4 w-4" />
          How generation works
        </Button>
      </div>

      {/* How-it-works dialog: explains the generation pipeline + knowledge roles */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              How AI generation works
            </DialogTitle>
            <DialogDescription>
              Test cases and bug reports come from a single AI call. The app assembles one prompt
              from your knowledge and settings, sends it to the model, and saves the result — the
              model never browses files or decides the order itself.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            {/* Pipeline */}
            <div className="flex items-center gap-2">
              {[
                { icon: Layers, label: 'Knowledge + workflow', sub: 'your files & settings' },
                { icon: Sparkles, label: 'AI model', sub: 'one prompt, one call' },
                { icon: FileText, label: 'Test cases / bug', sub: 'saved as a version' },
              ].map((s, i) => (
                <div key={s.label} className="contents">
                  <div className="flex-1 rounded-lg border bg-muted/30 p-3 text-center">
                    <s.icon className="h-5 w-5 mx-auto text-primary" />
                    <p className="mt-1.5 font-medium leading-tight">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.sub}</p>
                  </div>
                  {i < 2 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </div>

            {/* Three kinds of knowledge */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Three kinds of knowledge</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                  <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300"><PencilRuler className="h-4 w-4" /> Format</div>
                  <p className="mt-1.5 text-xs">What should the output look like?</p>
                  <p className="mt-1 text-xs text-muted-foreground">writing rules — table, columns, IDs</p>
                </div>
                <div className="rounded-lg border border-violet-200 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                  <div className="flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300"><ListChecks className="h-4 w-4" /> Method</div>
                  <p className="mt-1.5 text-xs">How do I reach full coverage?</p>
                  <p className="mt-1 text-xs text-muted-foreground">scenario enumeration + self-review</p>
                </div>
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><BookOpen className="h-4 w-4" /> Domain</div>
                  <p className="mt-1.5 text-xs">What is true about this product?</p>
                  <p className="mt-1 text-xs text-muted-foreground">platform / module / feature knowledge</p>
                </div>
              </div>
            </div>

            {/* Priority order */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">What goes into the prompt</p>
              <p className="text-xs text-muted-foreground mb-2">
                Knowledge is ordered by priority and packed into a token budget — higher priority survives if space runs out, and <strong>format rules are never dropped</strong>.
              </p>
              <ul className="space-y-1">
                {[
                  { p: '10', file: 'testcase-writing-rules.md', role: 'app · format · never dropped', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
                  { p: '9', file: 'testcase-generation-process.md', role: 'app · method', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
                  { p: '9', file: 'knowledge.md', role: 'this feature', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
                  { p: '7', file: '<module>-domain-knowledge.md', role: 'module', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
                  { p: '6', file: `${app}-platform-domain-knowledge.md`, role: 'app · domain', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300' },
                ].map((r) => (
                  <li key={r.file} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${r.cls}`}>{r.p}</span>
                    <code className="text-xs truncate">{r.file}</code>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">{r.role}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium text-foreground">Always added too:</span> the feature workflow, functional requirements (FRs), approved/example test cases, the fixed <strong>Instructions</strong> (table format &amp; coverage demands), and screenshots for vision models.
              </p>
            </div>

            {/* Footer note */}
            <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              Editing knowledge changes what the AI <em>knows</em>; the fixed instructions decide what it <em>produces</em>. More-specific knowledge (feature → module → app) wins when space is tight.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* How it works card */}
      {!selectedFile && (
        <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="flex gap-3 py-4">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-200">
                {moduleParam ? `How module knowledge works — ${moduleParam}` : 'How the 3-tier knowledge system works'}
              </p>
              {moduleParam ? (
                <>
                  <p className="text-blue-800 dark:text-blue-300">
                    Files here are injected into the AI prompt whenever it generates test cases for a <strong>{moduleParam}</strong> feature — on top of the platform-wide knowledge that applies to every feature.
                  </p>
                  <p className="text-blue-700 dark:text-blue-400 text-xs">
                    Use this tier for things specific to this module: its data models, workflows, edge cases, and terminology. Keep platform-wide rules in App Knowledge instead.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-blue-800 dark:text-blue-300 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400 pb-0.5">Tier 1 — App Knowledge (this page)</p>
                    <p>Injected into <em>every</em> test case and bug report, regardless of module or feature. Put platform-wide rules, writing style, and Jira format here.</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400 pt-1 pb-0.5">Tier 2 — Module Knowledge</p>
                    <p>Injected only when the feature belongs to that module. Edit via each module&apos;s <strong>Knowledge Base</strong> link in the sidebar, or use <strong>Module Knowledge</strong> in the sidebar to synthesize from user stories.</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400 pt-1 pb-0.5">Tier 3 — Feature Knowledge</p>
                    <p>Injected only for that specific feature. Generated from user stories via the <strong>Stories</strong> tab on each feature page.</p>
                  </div>
                  <p className="text-blue-700 dark:text-blue-400 text-xs mt-2">
                    {canEdit
                      ? 'Edit any file below to refine what the AI knows — changes take effect immediately.'
                      : 'These files are injected into every AI generation. Ask a lead to edit them.'}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* File list */}
      {!selectedFile && (
        <div className="grid gap-3">
          {files.length === 0 && (
            <p className="text-sm text-muted-foreground">No knowledge files found in <code>{knowledgeDirDisplay}</code></p>
          )}
          {files.map((file) => (
            <Card
              key={file.filename}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => openFile(file)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.title}</p>
                  <p className="text-xs text-muted-foreground">{file.filename} · {Math.round(file.size / 1024 * 10) / 10} KB</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{canEdit ? 'Click to edit →' : 'Click to view →'}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Knowledge gaps — aggregated open questions across all knowledge docs */}
      {!selectedFile && !moduleParam && gaps.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Open Questions &amp; Ambiguities
              <span className="text-xs font-normal text-muted-foreground">
                {gaps.reduce((n, g) => n + g.items.length, 0)} across {gaps.length} doc{gaps.length === 1 ? '' : 's'}
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Things knowledge synthesis flagged as underspecified — resolve these to improve AI accuracy.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {gaps.map((g) => (
              <div key={`${g.tier}:${g.source}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  {g.tier} · {g.source}
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {g.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* File editor */}
      {selectedFile && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{selectedFile.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <code>{knowledgeDirDisplay}{selectedFile.filename}</code>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canEdit ? (
                  <>
                    <button
                      onClick={() => setPreview((p) => !p)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-input rounded-md px-2.5 py-1"
                    >
                      {preview ? '✏ Edit' : '👁 Preview'}
                    </button>
                    <Button
                      onClick={saveFile}
                      disabled={saving || !isDirty}
                      size="sm"
                      className="gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground border border-input rounded-md px-2.5 py-1">
                    Read-only
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingFile ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : preview ? (
              <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-input bg-muted/30 px-4 py-3 min-h-[400px] overflow-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            ) : canEdit ? (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[500px] resize-y font-mono text-sm"
                spellCheck={false}
              />
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
