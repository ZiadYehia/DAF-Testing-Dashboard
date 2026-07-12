"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ModelSelector } from "@/components/shared/ModelSelector";
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
import { Sparkles, Plus, X, Search, ListChecks } from "lucide-react";
import { useStreamingGenerate } from "@/hooks/useStreamingGenerate";
import { useModels } from "@/hooks/useModels";
import { AIProgressBar } from "@/components/shared/AIProgressBar";
import { ContextWarningBanner } from "@/components/shared/ContextWarningBanner";

export interface AddCasesResult {
  testcases: string;
  version: number;
  added?: number;
}

interface AddCasesDialogProps {
  open: boolean;
  app: string;
  featureName: string;
  existingCount: number;
  latestVersionNum: number;
  onDone: (data: AddCasesResult) => void;
  onClose: () => void;
}

type AddMode = "gaps" | "scenarios";

/** Unified "Add Cases" dialog: gap-fill (with optional direction for the AI) or
 *  exact user-described scenarios. Both append to the LATEST version in place —
 *  no new version is created, and existing execution statuses are kept. */
export function AddCasesDialog({
  open,
  app,
  featureName,
  existingCount,
  latestVersionNum,
  onDone,
  onClose,
}: AddCasesDialogProps) {
  const [mode, setMode] = useState<AddMode>("gaps");
  const [guidance, setGuidance] = useState("");
  const [scenarios, setScenarios] = useState<string[]>([""]);
  const { generate, generating, phase, warning, dismissWarning } = useStreamingGenerate<AddCasesResult>();
  const { models, selectedModel, setSelectedModel } = useModels();

  const updateScenario = (i: number, v: string) =>
    setScenarios((prev) => prev.map((s, idx) => (idx === i ? v : s)));
  const addScenario = () => setScenarios((prev) => [...prev, ""]);
  const removeScenario = (i: number) =>
    setScenarios((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const reset = () => {
    setGuidance("");
    setScenarios([""]);
  };

  const handleClose = () => {
    if (!generating) {
      reset();
      onClose();
    }
  };

  const handleGenerate = async () => {
    try {
      let data: AddCasesResult | null;
      if (mode === "gaps") {
        data = await generate(`/api/${app}/features/${featureName}/generate`, {
          model: selectedModel,
          mode: "add-more",
          ...(guidance.trim() ? { guidance: guidance.trim() } : {}),
        });
      } else {
        const clean = scenarios.map((s) => s.trim()).filter(Boolean);
        if (clean.length === 0) {
          toast.error("Add at least one scenario.");
          return;
        }
        data = await generate(`/api/${app}/features/${featureName}/quick-add`, {
          model: selectedModel,
          scenarios: clean,
        });
      }
      if (!data) return;
      reset();
      onDone(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adding test cases failed. Please try again.");
    }
  };

  const modeOptions: Array<{ value: AddMode; title: string; description: string; icon: React.ReactNode }> = [
    {
      value: "gaps",
      title: "Fill coverage gaps",
      description: "AI analyzes existing cases and adds what's missing",
      icon: <Search className="h-4 w-4" />,
    },
    {
      value: "scenarios",
      title: "Exactly what I describe",
      description: "AI formats only your scenarios into cases",
      icon: <ListChecks className="h-4 w-4" />,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Test Cases</DialogTitle>
          <DialogDescription>
            New cases are appended to <strong>v{latestVersionNum}</strong>{" "}
            ({existingCount} case{existingCount !== 1 ? "s" : ""}) — no new version is created and
            existing execution results are kept. You can undo the batch afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {modeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              disabled={generating}
              className={`rounded-md border p-3 text-left transition-colors ${
                mode === opt.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-input hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-1.5 text-sm font-medium">
                {opt.icon} {opt.title}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
            </button>
          ))}
        </div>

        {mode === "gaps" ? (
          <div className="py-1">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Direction for the AI <span className="font-normal">(optional)</span>
            </label>
            <Textarea
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              placeholder={'e.g. "Focus on permission checks and concurrent edits" — leave empty for a general gap sweep'}
              className="min-h-[72px] resize-y text-sm"
              disabled={generating}
            />
          </div>
        ) : (
          <div className="space-y-2 py-1 max-h-[40vh] overflow-y-auto pr-1">
            {scenarios.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={s}
                  placeholder={`Scenario ${i + 1} — e.g. "User logs in with wrong password 3 times"`}
                  onChange={(e) => updateScenario(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addScenario(); } }}
                  disabled={generating}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeScenario(i)}
                  disabled={scenarios.length === 1 || generating}
                  aria-label="Remove scenario"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={addScenario} disabled={generating} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add scenario
            </Button>
          </div>
        )}

        <div className="py-1">
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">AI Model</label>
          <ModelSelector models={models} value={selectedModel} onChange={setSelectedModel} />
        </div>

        {warning && warning.length > 0 && (
          <ContextWarningBanner missing={warning} onDismiss={dismissWarning} className="mt-2" />
        )}
        {generating && <AIProgressBar phase={phase} className="mt-2" />}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={generating}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Add Cases
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
