"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { GeneratedBugReport } from "@/lib/ai";
import { useStreamingGenerate } from "@/hooks/useStreamingGenerate";
import { useBugFormat } from "@/hooks/useBugFormat";
import {
  getVariantConfig,
  type BugFormatConfig,
  type BugLayer,
  type BugVariantConfig,
} from "@/lib/bug-format";
import type { PhaseEvent } from "@/components/shared/AIProgressBar";

// AI-generated report, extended with the fields the generate route now returns
// (layer classification + optional severity) — kept as a local intersection so
// this file compiles regardless of exactly when ai.ts picks up the new fields.
export type GeneratedBugReportExt = GeneratedBugReport & { layer?: string; severity?: string };

/** Keep the bug's current value selectable even if it's since fallen out of the configured option list. */
export function withCurrentValue(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [...options, current] : options;
}

/** Where (if anywhere) the draft bug should be linked once created. */
export interface UseBugDraftLink {
  app: string;
  feature: string;
  testcaseId: string;
  version?: string;
}

export interface UseBugDraftParams {
  open: boolean;
  /** App the bug is created/reported under. */
  app: string;
  /** Feature the bug is filed against. */
  feature: string;
  module: string | null;
  /** Testcase (if any) the draft bug should be linked to once created. */
  link: UseBugDraftLink | null;
  model: string;
  /** Title used when the AI generate call doesn't return one. */
  fallbackTitle: string;
}

export interface UseBugDraftReportResult {
  slug: string;
  jiraKey: string | null;
  jiraUrl: string | null;
  attachmentWarning?: string;
}

export interface UseBugDraftResult {
  config: BugFormatConfig;
  variantConfig: BugVariantConfig;

  notes: string;
  setNotes: (v: string) => void;
  generated: boolean;
  preview: boolean;
  setPreview: React.Dispatch<React.SetStateAction<boolean>>;
  title: string;
  setTitle: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  priority: string;
  setPriority: (v: string) => void;
  bugType: string;
  setBugType: (v: string) => void;
  severity: string;
  setSeverity: (v: string) => void;
  layer: BugLayer;
  setLayer: (v: BugLayer) => void;
  selectedLabels: string[];
  setSelectedLabels: (v: string[]) => void;
  createdSlug: string | null;

  busy: null | "draft" | "report";
  generating: boolean;
  phase: PhaseEvent | null;
  warning: string[] | null;
  dismissWarning: () => void;

  /** Seeds notes with the given text and clears generated/edit state + createdSlug. */
  reset: (seedNotes: string) => void;
  handleGenerate: () => Promise<void>;
  /** Creates the draft bug (once) and links it, if a link target was given. Resolves to the slug, or null on failure. */
  saveDraft: () => Promise<string | null>;
  /** Ensures the draft exists, then reports it to Jira. Resolves to null on failure. */
  report: () => Promise<UseBugDraftReportResult | null>;
}

/**
 * State machine shared by the two bug-report dialogs (feature execution tab,
 * automation hub): describe → AI-generate → review/edit → save draft or
 * report to Jira. Callers own everything that differs between them — the
 * "link existing bug" mode, feature picking, model-selection storage, and all
 * success-path toasts/navigation — this hook only owns the generate/edit
 * field cluster and the two mutating calls (ensureDraft, report).
 */
export function useBugDraft({ open, app, feature, module, link, model, fallbackTitle }: UseBugDraftParams): UseBugDraftResult {
  const { config } = useBugFormat(app);
  const variantConfig = getVariantConfig(config, null);

  const [notes, setNotes] = useState("");
  const { generate, generating, phase, warning, dismissWarning } = useStreamingGenerate<GeneratedBugReportExt>();

  const [generated, setGenerated] = useState(false);
  const [preview, setPreview] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("P3 – Medium");
  const [bugType, setBugType] = useState("Functional");
  const [severity, setSeverity] = useState("");
  const [layer, setLayer] = useState<BugLayer>("unknown");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const [busy, setBusy] = useState<null | "draft" | "report">(null);
  // Slug of the draft once created, so a follow-up report doesn't create a duplicate.
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  // Pre-check all of the variant's configured labels — re-init whenever the
  // dialog (re)opens or the config finishes loading.
  useEffect(() => {
    if (open) setSelectedLabels(variantConfig.jiraLabels);
  }, [open, variantConfig]);

  const reset = useCallback((seedNotes: string) => {
    setNotes(seedNotes);
    setGenerated(false);
    setPreview(false);
    setTitle("");
    setBody("");
    setPriority("P3 – Medium");
    setBugType("Functional");
    setSeverity("");
    setLayer("unknown");
    setCreatedSlug(null);
  }, []);

  const handleGenerate = async () => {
    if (!notes.trim()) {
      toast.error("Describe the bug first.");
      return;
    }
    try {
      const data = await generate(`/api/${app}/bugs/generate`, { notes, model, variant: "epic" });
      if (!data) return;
      setTitle(data.title ?? fallbackTitle);
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

  /** Creates the draft bug (once) and records the link, if one was given. */
  const ensureDraft = async (): Promise<string> => {
    if (createdSlug) return createdSlug;
    if (!feature) throw new Error("Pick the feature this bug belongs to");
    if (!title.trim() || !body.trim()) throw new Error("Title and description are required");

    const res = await fetch(`/api/${app}/bugs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature,
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

    if (link) {
      const linkRes = await fetch(`/api/${link.app}/features/${link.feature}/execution/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testcaseId: link.testcaseId, bugSlug: slug, version: link.version }),
      });
      if (!linkRes.ok) throw new Error((await linkRes.json().catch(() => ({})))?.error ?? "Failed to link bug");
    }

    setCreatedSlug(slug);
    return slug;
  };

  const saveDraft = async (): Promise<string | null> => {
    setBusy("draft");
    try {
      return await ensureDraft();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const report = async (): Promise<UseBugDraftReportResult | null> => {
    setBusy("report");
    try {
      const slug = await ensureDraft();
      const res = await fetch(`/api/${app}/bugs/${feature}/${slug}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layer, labels: selectedLabels }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to report to Jira");
      return {
        slug,
        jiraKey: data.jira_key ?? null,
        jiraUrl: data.jira_url ?? null,
        attachmentWarning: data.attachment_warning,
      };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to report to Jira");
      return null;
    } finally {
      setBusy(null);
    }
  };

  return {
    config,
    variantConfig,
    notes,
    setNotes,
    generated,
    preview,
    setPreview,
    title,
    setTitle,
    body,
    setBody,
    priority,
    setPriority,
    bugType,
    setBugType,
    severity,
    setSeverity,
    layer,
    setLayer,
    selectedLabels,
    setSelectedLabels,
    createdSlug,
    busy,
    generating,
    phase,
    warning,
    dismissWarning,
    reset,
    handleGenerate,
    saveDraft,
    report,
  };
}
