import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export interface AcceptanceCriterion {
  id: string;
  text: string;
  parentId: string | null;
  manualCoverage: "covered" | "not_covered" | null;
  aiCoveredBy: string[];
  aiAnalyzedAt: string | null;
}

// Owns the acceptance-criteria coverage state for a feature: the criteria list,
// AI/manual coverage analysis, and the inline-edit state for the Coverage tab.
// Instantiated in page.tsx (rather than inside the tab component) because the
// always-mounted tab-trigger badge reads its derived counts even while the
// Coverage panel itself is unmounted (base-ui Tabs unmounts inactive panels).
export function useAcceptanceCriteria({
  app,
  name,
  selectedModel,
}: {
  app: string;
  name: string;
  selectedModel: string;
}) {
  const [acs, setAcs] = useState<AcceptanceCriterion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [clearingAi, setClearingAi] = useState(false);
  const [deepMode, setDeepMode] = useState(false);
  const [newAcText, setNewAcText] = useState("");
  const [editingAcId, setEditingAcId] = useState<string | null>(null);
  const [editingAcText, setEditingAcText] = useState("");
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  const [newChildText, setNewChildText] = useState("");

  const loadAcs = useCallback(async () => {
    const res = await fetch(`/api/${app}/features/${name}/coverage`);
    if (res.ok) setAcs(await res.json());
  }, [app, name]);

  useEffect(() => { loadAcs(); }, [loadAcs]);

  const saveAcs = async (updated: AcceptanceCriterion[]) => {
    setAcs(updated);
    try {
      await fetch(`/api/${app}/features/${name}/coverage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acs: updated }),
      });
    } catch {
      toast.error("Failed to save acceptance criteria");
    }
  };

  const addAc = () => {
    if (!newAcText.trim()) return;
    const topLevel = acs.filter(a => !a.parentId);
    const nums = topLevel.map(a => parseInt(a.id.replace("AC-", ""), 10)).filter(n => !isNaN(n));
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    const id = `AC-${String(nextNum).padStart(2, "0")}`;
    const newAc: AcceptanceCriterion = { id, text: newAcText.trim(), parentId: null, manualCoverage: null, aiCoveredBy: [], aiAnalyzedAt: null };
    saveAcs([...acs, newAc]);
    setNewAcText("");
  };

  const addChildAc = (parentId: string) => {
    if (!newChildText.trim()) return;
    const siblings = acs.filter(a => a.parentId === parentId);
    const id = `${parentId}.${siblings.length + 1}`;
    const newAc: AcceptanceCriterion = { id, text: newChildText.trim(), parentId, manualCoverage: null, aiCoveredBy: [], aiAnalyzedAt: null };
    saveAcs([...acs, newAc]);
    setNewChildText("");
    setAddingChildFor(null);
  };

  const deleteAc = (id: string) => {
    saveAcs(acs.filter((ac) => ac.id !== id && ac.parentId !== id));
  };

  const toggleManualCoverage = (id: string, status: "covered" | "not_covered" | null) => {
    saveAcs(acs.map((ac) => (ac.id === id ? { ...ac, manualCoverage: status } : ac)));
  };

  const analyzeAcs = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/${app}/features/${name}/coverage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: selectedModel, ...(deepMode ? { mode: "deep" } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Coverage analysis failed");
      } else {
        const { acs: updated } = await res.json();
        setAcs(updated);
        toast.success(deepMode ? "Deep coverage analysis complete" : "Coverage analysis complete");
      }
    } catch {
      toast.error("Coverage analysis failed");
    }
    setAnalyzing(false);
  };

  const clearAiMappings = async () => {
    if (!window.confirm("Clear all AI coverage mappings? This cannot be undone.")) return;
    setClearingAi(true);
    try {
      const res = await fetch(`/api/${app}/features/${name}/coverage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: "", mode: "reset" }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to clear AI mappings");
      } else {
        const { acs: updated } = await res.json();
        setAcs(updated);
        toast.success("AI coverage mappings cleared");
      }
    } catch {
      toast.error("Failed to clear AI mappings");
    }
    setClearingAi(false);
  };

  const getEffectiveCoverage = (ac: AcceptanceCriterion): "covered" | "not_covered" | "unknown" => {
    const children = acs.filter(a => a.parentId === ac.id);
    if (children.length > 0) {
      const statuses = children.map(c => {
        if (c.manualCoverage) return c.manualCoverage;
        if (c.aiAnalyzedAt !== null) return c.aiCoveredBy.length > 0 ? "covered" : "not_covered";
        return "unknown";
      });
      if (statuses.every(s => s === "covered")) return "covered";
      if (statuses.some(s => s === "not_covered")) return "not_covered";
      return "unknown";
    }
    if (ac.manualCoverage) return ac.manualCoverage;
    if (ac.aiAnalyzedAt !== null) return ac.aiCoveredBy.length > 0 ? "covered" : "not_covered";
    return "unknown";
  };

  const acIds = new Set(acs.map(a => a.id));
  const acParentIds = new Set(acs.filter(a => a.parentId && acIds.has(a.parentId)).map(a => a.parentId as string));
  const topLevelAcs = acs.filter(a => !a.parentId || !acIds.has(a.parentId));
  const leafAcs = acs.filter(a => !acParentIds.has(a.id));
  const acCoveredCount = leafAcs.filter((ac) => getEffectiveCoverage(ac) === "covered").length;
  const acLastAnalyzed = acs.reduce((latest: string | null, ac) => {
    if (!ac.aiAnalyzedAt) return latest;
    return !latest || ac.aiAnalyzedAt > latest ? ac.aiAnalyzedAt : latest;
  }, null);

  return {
    acs,
    loadAcs,
    saveAcs,
    addAc,
    addChildAc,
    deleteAc,
    toggleManualCoverage,
    analyzeAcs,
    clearAiMappings,
    getEffectiveCoverage,
    analyzing,
    clearingAi,
    deepMode,
    setDeepMode,
    newAcText,
    setNewAcText,
    editingAcId,
    setEditingAcId,
    editingAcText,
    setEditingAcText,
    addingChildFor,
    setAddingChildFor,
    newChildText,
    setNewChildText,
    acIds,
    topLevelAcs,
    leafAcs,
    acCoveredCount,
    acLastAnalyzed,
  };
}
