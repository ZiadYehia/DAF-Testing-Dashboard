"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppSelect } from "@/components/shared/AppSelect";
import { Bug, Loader2, Send, Sparkles, Link2, ExternalLink } from "lucide-react";
import type { AIModel } from "@/lib/ai";
import { useBugDraft } from "@/components/bugs/useBugDraft";
import { BugDraftForm } from "@/components/bugs/BugDraftForm";

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
  // This dialog never collects a parent story key, so bugs it creates are always
  // epic-level — the epic variant config applies throughout (enforced inside the hook).
  const draft = useBugDraft({
    open,
    app,
    feature: featureName,
    module,
    link: testcase ? { app, feature: featureName, testcaseId: testcase.id, version: execVersion } : null,
    model: selectedModel,
    fallbackTitle: `${testcase?.id} — ${testcase?.objective ?? "failure"}`,
  });

  // Whether a "link existing bug" request is in flight — kept separate from
  // draft.busy, which only tracks the generate/save/report flow.
  const [busyLink, setBusyLink] = useState(false);

  // Mode: describe a brand-new bug, or link a bug already filed for this feature.
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existingBugs, setExistingBugs] = useState<ExistingBug[]>([]);
  const [loadingBugs, setLoadingBugs] = useState(false);
  const [selectedBugSlug, setSelectedBugSlug] = useState<string>("");

  useEffect(() => {
    if (open && testcase) {
      draft.reset(seedNotes(testcase));
      setMode("new");
      setSelectedBugSlug("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, testcase]);

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
    if (!draft.busy && !busyLink && !draft.generating) onClose();
  };

  /** Links an already-filed bug to this test case (no new bug is created). */
  const handleLinkExisting = async () => {
    if (!testcase || !selectedBugSlug) return;
    setBusyLink(true);
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
      setBusyLink(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!testcase) return;
    const slug = await draft.saveDraft();
    if (!slug) return;
    onLinked(testcase.id, { slug, jiraKey: null, jiraUrl: null, status: "draft" });
    toast.success("Bug draft created and linked.", {
      action: {
        label: "Open bug",
        onClick: () => window.open(`/${app}/bugs/${featureName}/${slug}`, "_blank"),
      },
    });
    onClose();
  };

  const handleReport = async () => {
    if (!testcase) return;
    const result = await draft.report();
    if (!result) return;
    onLinked(testcase.id, {
      slug: result.slug,
      jiraKey: result.jiraKey,
      jiraUrl: result.jiraUrl,
      status: "reported",
    });
    if (result.attachmentWarning) toast.warning(`Reported, but attachments failed: ${result.attachmentWarning}`);
    else toast.success(`Reported to Jira as ${result.jiraKey}.`);
    onClose();
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
            disabled={!!draft.busy || busyLink || draft.generating}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50 ${
              mode === "new" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Describe new bug
          </button>
          <button
            type="button"
            onClick={() => setMode("existing")}
            disabled={!!draft.busy || busyLink || draft.generating}
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
                  disabled={busyLink}
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
          <BugDraftForm
            draft={draft}
            models={models}
            model={selectedModel}
            onModelChange={setSelectedModel}
            settingsHref={`/${app}/settings`}
          />
        </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={!!draft.busy || busyLink || draft.generating}>Cancel</Button>
          {mode === "existing" ? (
            <Button onClick={handleLinkExisting} disabled={!selectedBugSlug || busyLink}>
              {busyLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Link bug
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleSaveDraft} disabled={!draft.generated || !!draft.busy}>
                {draft.busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
                Save draft
              </Button>
              <Button onClick={handleReport} disabled={!draft.generated || !!draft.busy}>
                {draft.busy === "report" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Report to Jira
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
