"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ModelSelector } from "@/components/shared/ModelSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles, Plus, X } from "lucide-react";
import { useStreamingGenerate } from "@/hooks/useStreamingGenerate";
import { useModels } from "@/hooks/useModels";
import { AIProgressBar } from "@/components/shared/AIProgressBar";

interface QuickAddDialogProps {
  open: boolean;
  app: string;
  featureName: string;
  onDone: (data: { testcases: string; version: number }) => void;
  onClose: () => void;
}

export function QuickAddDialog({ open, app, featureName, onDone, onClose }: QuickAddDialogProps) {
  const [scenarios, setScenarios] = useState<string[]>([""]);
  const { generate, generating, phase } = useStreamingGenerate<{ testcases: string; version: number }>();
  const { models, selectedModel, setSelectedModel } = useModels();

  const updateScenario = (i: number, v: string) =>
    setScenarios((prev) => prev.map((s, idx) => (idx === i ? v : s)));
  const addScenario = () => setScenarios((prev) => [...prev, ""]);
  const removeScenario = (i: number) =>
    setScenarios((prev) => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));

  const handleClose = () => {
    if (!generating) { setScenarios([""]); onClose(); }
  };

  const handleGenerate = async () => {
    const clean = scenarios.map((s) => s.trim()).filter(Boolean);
    if (clean.length === 0) { toast.error("Add at least one scenario."); return; }
    try {
      const data = await generate(`/api/${app}/features/${featureName}/quick-add`, {
        model: selectedModel,
        scenarios: clean,
      });
      if (!data) return;
      setScenarios([""]);
      onDone(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Quick Add failed. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Add Test Cases</DialogTitle>
          <DialogDescription>
            Describe your test scenarios in plain English — one per field. The AI formats each
            into structured test case(s) using this feature&apos;s workflow, domain knowledge,
            and requirements, then appends them as a new version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 max-h-[40vh] overflow-y-auto pr-1">
          {scenarios.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={s}
                placeholder={`Scenario ${i + 1} — e.g. "User logs in with wrong password 3 times"`}
                onChange={(e) => updateScenario(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addScenario(); } }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeScenario(i)}
                disabled={scenarios.length === 1}
                aria-label="Remove scenario"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addScenario} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add scenario
          </Button>
        </div>

        <div className="py-1">
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">AI Model</label>
          <ModelSelector models={models} value={selectedModel} onChange={setSelectedModel} />
        </div>

        {generating && <AIProgressBar phase={phase} className="mt-2" />}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={generating}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
