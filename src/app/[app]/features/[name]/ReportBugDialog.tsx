"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppSelect } from "@/components/shared/AppSelect";
import { Bug, Loader2, Send, Sparkles, Eye, Pencil, Link2, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIModel, GeneratedBugReport } from "@/lib/ai";
import { useStreamingGenerate } from "@/hooks/useStreamingGenerate";
import { AIProgressBar } from "@/components/shared/AIProgressBar";
import { ModelSelector } from "@/components/shared/ModelSelector";
import { ContextWarningBanner } from "@/components/shared/ContextWarningBanner";
import { useBugFormat } from "@/hooks/useBugFormat";
import { LabelMultiSelect } from "@/components/shared/LabelMultiSelect";
import { BUG_TYPE_OPTIONS, LAYER_OPTIONS, getVariantConfig, type BugLayer } from "@/lib/bug-format";

// AI-generated report, extended with the fields the generate route now returns
// (layer classification + optional severity) — kept as a local intersection so
// this file compiles regardless of exactly when ai.ts picks up the new fields.
type GeneratedBugReportExt = GeneratedBugReport & { layer?: string; severity?: string };

/** Keep the bug's current value selectable even if it's since fallen out of the configured option list. */
function withCurrentValue(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options;
}

export interface LinkedBug {
  slug: string;
  jiraKey: string | null;
  jiraUrl: string | null;
  status: string;
}

interface ExistingBug {
  slug: string;
  feature: string;
  title: string;
  status: string;
  jira_key: string | null;
  jira_url: string | null;
}

interface ReportBugDialogProps {
  open: boolean;
  app: string;
  featureName: string;
  module: string | null;
  testcase: { id: string; objective: string; steps: string } | null;
  models: AIModel[];
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  /** Version number of the currently-viewed execution tab, if not "latest" —
   *  execution/bug-link data is scoped per version, so links must target the
   *  same version the tester is looking at. */
  execVersion?: string;
  onClose: () => void;
  onLinked: (testcaseId: string, bug: LinkedBug) => void;
}

// Seeds the description with the failing test case so the AI has context and the
// tester only adds what they actually observed.
function seedNotes(tc: { id: string; objective: string; steps: string }): string {
  const lines = [`Test case ${tc.id} failed.`];
  if (tc.objective) lines.push(`Objective: ${tc.objective}`);
  if (tc.steps?.trim()) lines.push(`Steps:\n${tc.steps.trim()}`);
  lines.push("", "What went wrong (describe what you observed):", "");
  return lines.join("\n");
}

export function ReportBugDialog({
  open,
  app,
  featureName,
  module,
  testcase,
  models,
  selectedModel,
  setSelectedModel,
  execVersion,
  onClose,
  onLinked,
}: ReportBugDialogProps) {
  const [notes, setNotes] = useState("");
  const { generate, generating, phase, warning, dismissWarning } = useStreamingGenerate<GeneratedBugReportExt>();

  // This dialog never collects a parent story key, so bugs it creates are always
  // epic-level — the epic variant config applies throughout.
  const { config } = useBugFormat(app);
  const variantConfig = getVariantConfig(config, null);

  // Generated / editable fields
  const [generated, setGenerated] = useState(false);
  const [preview, setPreview] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("P3 – Medium");
  const [bugType, setBugType] = useState("Functional");
  const [severity, setSeverity] = useState("");
  const [layer, setLayer] = useState<BugLayer>("unknown");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const [busy, setBusy] = useState<null | "draft" | "report" | "link">(null);
  // Slug of the draft once created, so a follow-up report doesn't create a duplicate.
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  // Mode: describe a brand-new bug, or link a bug already filed for this feature.
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existingBugs, setExistingBugs] = useState<ExistingBug[]>([]);
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [selectedBugSlug, setSelectedBugSlug] = useState<string>("");

  useEffect(() => {
    if (open && testcase) {
      setNotes(seedNotes(testcase));
      setGenerated(false);
      setPreview(false);
      setTitle("");
      setBody("");
      setPriority("P3 – Medium");
      setBugType("Functional");
      setSeverity("");
      setLayer("unknown");
      setCreatedSlug(null);
      setMode("new");
      setSelectedBugSlug("");
    }
  }, [open, testcase]);

  // Pre-check all of the variant's configured labels — re-init whenever the
  // dialog (re)opens or the config finishes loading.
  useEffect(() => {
    if (open) setSelectedLabels(variantConfig.jiraLabels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, variantConfig]);

  // Load this feature's existing bugs once the dialog opens, so the "Link
  // existing" picker is ready without a second round-trip when the user switches.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingBugs(true);
      try {
        const url = module
          ? `/api/${app}/bugs?module=${encodeURIComponent(module)}`
          : `/api/${app}/bugs`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load bugs");
        const all = (await res.json()) as ExistingBug[];
        if (!cancelled) setExistingBugs(all.filter((b) => b.feature === featureName));
      } catch {
        if (!cancelled) setExistingBugs([]);
      } finally {
        if (!cancelled) setLoadingBugs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, app, module, featureName]);

  const handleClose = () => {
    if (!busy && !generating) onClose();
  };

  const handleGenerate = async () => {
    if (!notes.trim()) {
      toast.error("Describe the bug first.");
      return;
    }
    try {
      const data = await generate(`/api/${app}/bugs/generate`, { notes, model: selectedModel, variant: "epic" });
      if (!data) return;
      setTitle(data.title ?? `${testcase?.id} — ${testcase?.objective ?? "failure"}`);
      setPriority(data.priority ?? "P3 – Medium");
      setBugType(data.bug_type ?? "Functional");
      setBody(data.body ?? "");
      setSeverity(data.severity ?? "");
      setLayer((data.layer as BugLayer) ?? "unknown");
      setGenerated(true);
      toast.success("Bug report generated — review and report.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    }
  };

  /** Creates the draft bug (once) and records the testcase → bug link. */
  const ensureDraft = async (): Promise<string> => {
    if (createdSlug) return createdSlug;
    if (!title.trim() || !body.trim()) throw new Error("Title and description are required");

    const res = await fetch(`/api/${app}/bugs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature: featureName,
        title: title.trim(),
        priority,
        bug_type: bugType,
        severity,
        layer,
        body,
        module,
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Failed to create bug");
    const { slug } = (await res.json()) as { slug: string };

    const linkRes = await fetch(`/api/${app}/features/${featureName}/execution/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testcaseId: testcase!.id, bugSlug: slug, version: execVersion }),
    });
    if (!linkRes.ok) throw new Error((await linkRes.json().catch(() => ({})))?.error ?? "Failed to link bug");

    setCreatedSlug(slug);
    return slug;
  };

  const handleSaveDraft = async () => {
    if (!testcase) return;
    setBusy("draft");
    try {
      const slug = await ensureDraft();
      onLinked(testcase.id, { slug, jiraKey: null, jiraUrl: null, status: "draft" });
      toast.success("Bug draft created and linked.", {
        action: {
          label: "Open bug",
          onClick: () => window.open(`/${app}/bugs/${featureName}/${slug}`, "_blank"),
        },
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setBusy(null);
    }
  };

  /** Links an already-filed bug to this test case (no new bug is created). */
  const handleLinkExisting = async () => {
    if (!testcase || !selectedBugSlug) return;
    setBusy("link");
    try {
      const res = await fetch(`/api/${app}/features/${featureName}/execution/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testcaseId: testcase.id, bugSlug: selectedBugSlug, version: execVersion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to link bug");
      onLinked(testcase.id, data.bug as LinkedBug);
      const linked = existingBugs.find((b) => b.slug === selectedBugSlug);
      toast.success(`Linked ${linked?.jira_key ?? "bug"} to ${testcase.id}.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link bug");
    } finally {
      setBusy(null);
    }
  };

  const handleReport = async () => {
    if (!testcase) return;
    setBusy("report");
    try {
      const slug = await ensureDraft();
      const res = await fetch(`/api/${app}/bugs/${featureName}/${slug}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layer, labels: selectedLabels }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to report to Jira");

      onLinked(testcase.id, {
        slug,
        jiraKey: data.jira_key ?? null,
        jiraUrl: data.jira_url ?? null,
        status: "reported",
      });
      if (data.attachment_warning) toast.warning(`Reported, but attachments failed: ${data.attachment_warning}`);
      else toast.success(`Reported to Jira as ${data.jira_key}.`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to report to Jira");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-red-600" />
            {mode === "existing" ? "Link a bug to" : "Report bug for"} {testcase?.id}
          </DialogTitle>
          <DialogDescription>
            {mode === "existing"
              ? "Pick a bug already filed for this feature to link it to this test case."
              : "Describe what went wrong, generate a structured report, then save a draft (to add screenshots) or report straight to Jira."}
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("new")}
            disabled={!!busy || generating}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 ${
              mode === "new" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Describe new bug
          </button>
          <button
            type="button"
            onClick={() => setMode("existing")}
            disabled={!!busy || generating}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 ${
              mode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" /> Link existing bug
          </button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-muted-foreground">
              Existing bug for {featureName}
            </label>
            {loadingBugs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading bugs…
              </div>
            ) : existingBugs.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                No bugs have been filed for this feature yet. Switch to{" "}
                <span className="font-medium text-foreground">Describe new bug</span> to create one.
              </p>
            ) : (
              <>
                <AppSelect
                  aria-label="Select a bug to link"
                  className="w-full"
                  contentClassName="max-w-[min(38rem,calc(100vw-3rem))]"
                  placeholder="Select a bug to link…"
                  value={selectedBugSlug || null}
                  onChange={setSelectedBugSlug}
                  disabled={!!busy}
                  options={existingBugs.map((b) => ({
                    value: b.slug,
                    label: `${b.jira_key ? `${b.jira_key} — ` : ""}${b.title}`,
                  }))}
                />
                {(() => {
                  const sel = existingBugs.find((b) => b.slug === selectedBugSlug);
                  if (!sel) return null;
                  return (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <span className="capitalize">{sel.status}</span>
                      {sel.jira_url && (
                        <a
                          href={sel.jira_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {sel.jira_key} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        ) : (
        <div className="space-y-4">
          {/* Step 1 — describe & generate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">Describe the bug</label>
              <ModelSelector models={models} value={selectedModel} onChange={setSelectedModel} size="sm" />
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={generating || !!busy}
              className="min-h-32 resize-y font-mono text-xs"
            />
            <Button onClick={handleGenerate} disabled={generating || !!busy || !notes.trim()} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {generating ? "Generating…" : generated ? "Regenerate" : "Generate report"}
            </Button>
            {generating && <AIProgressBar phase={phase} />}
            {warning && warning.length > 0 && (
              <ContextWarningBanner missing={warning} onDismiss={dismissWarning} href={`/${app}/settings`} actionLabel="Review app profile" />
            )}
          </div>

          {/* Step 2 — review & edit */}
          {generated && !generating && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Review &amp; edit</span>
                <button
                  onClick={() => setPreview((p) => !p)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {preview ? "Edit" : "Preview"}
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!!busy} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {variantConfig.fields.priority && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <Select value={priority} onValueChange={(v) => v && setPriority(v)} disabled={!!busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {withCurrentValue(config.priorityOptions, priority).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {variantConfig.fields.severity && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Severity</label>
                    <Select value={severity} onValueChange={(v) => v && setSeverity(v)} disabled={!!busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {withCurrentValue(config.severityOptions, severity).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {variantConfig.fields.bugType && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <Select value={bugType} onValueChange={(v) => v && setBugType(v)} disabled={!!busy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {withCurrentValue(BUG_TYPE_OPTIONS, bugType).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* Manual override of the AI's FE/BE classification — always shown. */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Layer</label>
                  <Select value={layer} onValueChange={(v) => v && setLayer(v as BugLayer)} disabled={!!busy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LAYER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Report body</label>
                {preview ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/30 px-4 py-3 min-h-52">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                  </div>
                ) : (
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={!!busy}
                    className="min-h-52 resize-y font-mono text-xs"
                  />
                )}
              </div>

              <LabelMultiSelect
                labels={variantConfig.jiraLabels}
                selected={selectedLabels}
                onChange={setSelectedLabels}
                disabled={!!busy}
              />
            </div>
          )}
        </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={!!busy || generating}>Cancel</Button>
          {mode === "existing" ? (
            <Button onClick={handleLinkExisting} disabled={!selectedBugSlug || !!busy}>
              {busy === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Link bug
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleSaveDraft} disabled={!generated || !!busy}>
                {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
                Save draft
              </Button>
              <Button onClick={handleReport} disabled={!generated || !!busy}>
                {busy === "report" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Report to Jira
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
