"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Eye, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIModel } from "@/lib/ai";
import { AIProgressBar } from "@/components/shared/AIProgressBar";
import { ModelSelector } from "@/components/shared/ModelSelector";
import { ContextWarningBanner } from "@/components/shared/ContextWarningBanner";
import { LabelMultiSelect } from "@/components/shared/LabelMultiSelect";
import { BUG_TYPE_OPTIONS, LAYER_OPTIONS, type BugLayer } from "@/lib/bug-format";
import { withCurrentValue, type UseBugDraftResult } from "./useBugDraft";

interface BugDraftFormProps {
  draft: UseBugDraftResult;
  models: AIModel[];
  model: string;
  onModelChange: (id: string) => void;
  settingsHref: string;
}

/**
 * "Describe → generate → review/edit" body shared by the two bug-report
 * dialogs. Purely presentational: every value it renders and every change it
 * makes flows through the `draft` state machine from useBugDraft.
 */
export function BugDraftForm({ draft, models, model, onModelChange, settingsHref }: BugDraftFormProps) {
  return (
    <>
      {/* Step 1 — describe & generate */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-muted-foreground">Describe the bug</label>
          <ModelSelector models={models} value={model} onChange={onModelChange} size="sm" />
        </div>
        <Textarea
          value={draft.notes}
          onChange={(e) => draft.setNotes(e.target.value)}
          disabled={draft.generating || !!draft.busy}
          className="min-h-32 resize-y font-mono text-xs"
        />
        <Button onClick={draft.handleGenerate} disabled={draft.generating || !!draft.busy || !draft.notes.trim()} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {draft.generating ? "Generating…" : draft.generated ? "Regenerate" : "Generate report"}
        </Button>
        {draft.generating && <AIProgressBar phase={draft.phase} />}
        {draft.warning && draft.warning.length > 0 && (
          <ContextWarningBanner missing={draft.warning} onDismiss={draft.dismissWarning} href={settingsHref} actionLabel="Review app profile" />
        )}
      </div>

      {/* Step 2 — review & edit */}
      {draft.generated && !draft.generating && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Review &amp; edit</span>
            <button
              onClick={() => draft.setPreview((p) => !p)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {draft.preview ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {draft.preview ? "Edit" : "Preview"}
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input value={draft.title} onChange={(e) => draft.setTitle(e.target.value)} disabled={!!draft.busy} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {draft.variantConfig.fields.priority && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <Select value={draft.priority} onValueChange={(v) => v && draft.setPriority(v)} disabled={!!draft.busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {withCurrentValue(draft.config.priorityOptions, draft.priority).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {draft.variantConfig.fields.severity && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Severity</label>
                <Select value={draft.severity} onValueChange={(v) => v && draft.setSeverity(v)} disabled={!!draft.busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {withCurrentValue(draft.config.severityOptions, draft.severity).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {draft.variantConfig.fields.bugType && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <Select value={draft.bugType} onValueChange={(v) => v && draft.setBugType(v)} disabled={!!draft.busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {withCurrentValue(BUG_TYPE_OPTIONS, draft.bugType).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Manual override of the AI's FE/BE classification — always shown. */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Layer</label>
              <Select value={draft.layer} onValueChange={(v) => v && draft.setLayer(v as BugLayer)} disabled={!!draft.busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LAYER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Report body</label>
            {draft.preview ? (
              <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/30 px-4 py-3 min-h-52">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.body}</ReactMarkdown>
              </div>
            ) : (
              <Textarea
                value={draft.body}
                onChange={(e) => draft.setBody(e.target.value)}
                disabled={!!draft.busy}
                className="min-h-52 resize-y font-mono text-xs"
              />
            )}
          </div>

          <LabelMultiSelect
            labels={draft.variantConfig.jiraLabels}
            selected={draft.selectedLabels}
            onChange={draft.setSelectedLabels}
            disabled={!!draft.busy}
          />
        </div>
      )}
    </>
  );
}
