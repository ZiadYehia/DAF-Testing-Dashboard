"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { titleCase } from "@/lib/utils";
import { useApp } from "@/lib/use-apps";
import { usePermissions } from "@/lib/use-permissions";
import type { PermissionKey } from "@/lib/permissions";
import { ModelSelector } from "@/components/shared/ModelSelector";
import { Lightbox, type LightboxItem } from "@/components/shared/Lightbox";
import { ReadinessBadge } from "@/components/shared/ReadinessBadge";
import { ContextWarningBanner } from "@/components/shared/ContextWarningBanner";
import { IntakeGroupForm } from "@/components/shared/IntakeGroupForm";
import { FEATURE_INTAKE_GROUPS, type IntakeValue } from "@/lib/intake-types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  Eye,
  Pencil,
  Upload,
  X,
  ChevronDown,
  Code,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  Download,
  FileText,
  Sheet,
  Plus,
  ExternalLink,
  Link2,
  BookOpen,
  FlaskConical,
  Bug,
  Undo2,
  Archive,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppSelect } from "@/components/shared/AppSelect";
import { exportAsMarkdown } from "@/lib/export-testcases";
import { EXECUTION_STATUSES, type ExecutionStatus } from "@/lib/execution-types";
import { useStreamingGenerate } from "@/hooks/useStreamingGenerate";
import { useModels } from "@/hooks/useModels";
import { AIProgressBar } from "@/components/shared/AIProgressBar";
import { AddCasesDialog } from "./AddCasesDialog";
import { ReportBugDialog, type LinkedBug } from "./ReportBugDialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TestcaseVersion {
  label: string;
  filename: string;
  content: string;
}

type TestingPhase = "testcase_design" | "testcase_execution" | "retesting";

const TESTING_PHASES: TestingPhase[] = ["testcase_design", "testcase_execution", "retesting"];

const TESTING_PHASE_META: Record<TestingPhase, { label: string; className: string }> = {
  testcase_design:    { label: "Testcase Design",    className: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800" },
  testcase_execution: { label: "Testcase Execution", className: "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800" },
  retesting:          { label: "Retesting",          className: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" },
};

interface Feature {
  name: string;
  workflow: string;
  testcases: string;
  testcaseVersions: TestcaseVersion[];
  screenshots: string[];
  jiraKey?: string;
  storyKey?: string;
  knowledge?: string;
  testingPhase?: string | null;
  testingSubtasks?: Record<string, string>;
  lastAddition?: { count: number; version: number; at: string } | null;
  archived?: boolean;
}

interface AcceptanceCriterion {
  id: string;
  text: string;
  parentId: string | null;
  manualCoverage: "covered" | "not_covered" | null;
  aiCoveredBy: string[];
  aiAnalyzedAt: string | null;
}

interface ExecutionRow {
  id: string;
  objective: string;
  steps?: string;
  status: ExecutionStatus;
  bug?: LinkedBug | null;
}

const EXECUTION_STATUS_META: Record<ExecutionStatus, { label: string; className: string }> = {
  new_added:     { label: "New Added",       className: "bg-red-900 text-white" },
  ready:         { label: "Ready for Test",  className: "bg-cyan-100 text-cyan-700 border border-cyan-300" },
  pass:          { label: "Pass",            className: "bg-green-600 text-white" },
  fail:          { label: "Fail",            className: "bg-red-100 text-red-800 border border-red-300" },
  blocked:       { label: "Blocked/Skipped", className: "bg-gray-500 text-white" },
  under_testing: { label: "Under Testing",   className: "bg-purple-100 text-purple-700 border border-purple-300" },
};

export default function FeatureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const app = params?.app as string;
  const name = params?.name as string;
  const appConfig = useApp(app);
  const hasTestCaseWriter = appConfig?.capabilities.testCaseWriter ?? false;
  const parts = pathname?.split('/') ?? [];
  const appIdx = parts.indexOf(app);
  const featuresIdx = parts.lastIndexOf('features');
  const moduleSlug = featuresIdx > appIdx + 1 ? parts[appIdx + 1] : null;

  const [feature, setFeature] = useState<Feature | null>(null);
  const [workflow, setWorkflow] = useState("");
  const [testcases, setTestcases] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [knowledgePreview, setKnowledgePreview] = useState(true);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [jiraKey, setJiraKey] = useState("");
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEditOpen, setJiraEditOpen] = useState(false);
  const [jiraEditValue, setJiraEditValue] = useState("");
  const [savingJira, setSavingJira] = useState(false);
  const [storyKey, setStoryKey] = useState("");
  const [storyEditOpen, setStoryEditOpen] = useState(false);
  const [storyEditValue, setStoryEditValue] = useState("");
  const [storyOptions, setStoryOptions] = useState<{ key: string; summary: string }[]>([]);
  const [savingStory, setSavingStory] = useState(false);
  const [testcaseVersions, setTestcaseVersions] = useState<TestcaseVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [workflowPreview, setWorkflowPreview] = useState(false);
  const [testcasesPreview, setTestcasesPreview] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("workflow");
  const { generate, generating, phase, warning, dismissWarning } = useStreamingGenerate<{ testcases: string; version: number }>();
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [addCasesOpen, setAddCasesOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const { models, selectedModel, setSelectedModel } = useModels();
  const [acs, setAcs] = useState<AcceptanceCriterion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [clearingAi, setClearingAi] = useState(false);
  const [deepMode, setDeepMode] = useState(false);
  const [newAcText, setNewAcText] = useState("");
  const [editingAcId, setEditingAcId] = useState<string | null>(null);
  const [editingAcText, setEditingAcText] = useState("");
  const [addingChildFor, setAddingChildFor] = useState<string | null>(null);
  const [newChildText, setNewChildText] = useState("");
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  // Which test-case version the execution tab is showing (filename, "" = latest).
  const [execVersion, setExecVersion] = useState<string>("");
  // Execution status/bug-links are scoped per version — this is the version
  // number to send on every read/write so they all target the same file.
  // undefined ("" selected) means "latest"; the API resolves that server-side.
  const execVersionNum = execVersion.match(/-v(\d+)\.md$/)?.[1];
  const [executionExporting, setExecutionExporting] = useState(false);
  const [bugDialogTc, setBugDialogTc] = useState<ExecutionRow | null>(null);
  const [testingPhase, setTestingPhase] = useState<string | null>(null);
  const [testingSubtasks, setTestingSubtasks] = useState<Record<string, string>>({});
  const [settingPhase, setSettingPhase] = useState(false);
  const [phaseConfirmOpen, setPhaseConfirmOpen] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<TestingPhase | null>(null);
  const [assignToMe, setAssignToMe] = useState(true);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, IntakeValue> | undefined>(undefined);
  // Bumped after an intake save so <ReadinessBadge> (self-fetching) remounts and re-fetches.
  const [readinessKey, setReadinessKey] = useState(0);
  const { can } = usePermissions(app);
  const canDelete = can("features.delete" as PermissionKey);

  const featuresBase = moduleSlug ? `/${app}/${moduleSlug}/features` : `/${app}/features`;

  const loadFeature = useCallback(async () => {
    const res = await fetch(`/api/${app}/features/${name}`);
    if (!res.ok) {
      router.push(featuresBase);
      return;
    }
    const data: Feature = await res.json();
    setFeature(data);
    setWorkflow(data.workflow);
    setKnowledge(data.knowledge ?? "");
    setJiraKey(data.jiraKey ?? "");
    setStoryKey(data.storyKey ?? "");
    setTestingPhase(data.testingPhase ?? null);
    setTestingSubtasks(data.testingSubtasks ?? {});
    const versions = data.testcaseVersions ?? [];
    setTestcaseVersions(versions);
    const latest = versions.length > 0 ? versions[versions.length - 1] : null;
    setSelectedVersion(latest?.filename ?? "");
    setTestcases(latest?.content ?? data.testcases ?? "");
  }, [app, name, router, featuresBase]);

  useEffect(() => {
    loadFeature();
  }, [loadFeature]);

  const loadIntake = useCallback(async () => {
    try {
      const res = await fetch(`/api/${app}/intake?scope=feature&slug=${name}`);
      if (!res.ok) return;
      const data = await res.json();
      setIntakeAnswers(data.answers?.workflow ?? {});
    } catch {
      // Edit-details form just starts blank — not fatal.
    }
  }, [app, name]);

  useEffect(() => {
    loadIntake();
  }, [loadIntake]);

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/${app}/features/${name}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Feature archived");
      router.push(featuresBase);
    } catch {
      toast.error("Failed to archive feature");
      setArchiving(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(`/api/${app}/features/${name}/restore`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Feature restored");
      await loadFeature();
    } catch {
      toast.error("Failed to restore feature");
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.JIRA_BASE_URL) setJiraBaseUrl(data.JIRA_BASE_URL.replace(/\/$/, ""));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!app) return;
    fetch(`/api/${app}/stories?source=local`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.stories)) setStoryOptions(data.stories); })
      .catch(() => {});
  }, [app]);

  const loadAcs = useCallback(async () => {
    const res = await fetch(`/api/${app}/features/${name}/coverage`);
    if (res.ok) setAcs(await res.json());
  }, [app, name]);

  useEffect(() => { loadAcs(); }, [loadAcs]);

  const loadExecutions = useCallback(async () => {
    setExecutionsLoading(true);
    try {
      const url = execVersionNum
        ? `/api/${app}/features/${name}/execution?version=${execVersionNum}`
        : `/api/${app}/features/${name}/execution`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const { testcases } = await res.json();
        setExecutions(testcases ?? []);
      }
    } finally {
      setExecutionsLoading(false);
    }
  }, [app, name, execVersion]);

  useEffect(() => { loadExecutions(); }, [loadExecutions]);

  const updateExecutionStatus = async (testcaseId: string, status: ExecutionStatus) => {
    const prev = executions;
    setExecutions((rows) => rows.map((r) => (r.id === testcaseId ? { ...r, status } : r)));
    try {
      const res = await fetch(`/api/${app}/features/${name}/execution`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testcaseId, status, version: execVersionNum }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setExecutions(prev);
      toast.error("Failed to update status");
    }
  };

  const handleBugLinked = (testcaseId: string, bug: LinkedBug) => {
    setExecutions((rows) => rows.map((r) => (r.id === testcaseId ? { ...r, bug } : r)));
  };

  const handleExecutionExport = async (format: "md" | "xlsx") => {
    setExecutionExporting(true);
    try {
      const res = await fetch(`/api/${app}/features/${name}/execution/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, version: execVersionNum }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}-execution.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed.");
    } finally {
      setExecutionExporting(false);
    }
  };

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

  const saveJiraKey = async () => {
    setSavingJira(true);
    try {
      await fetch(`/api/${app}/features/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metadata", jiraKey: jiraEditValue.trim() }),
      });
      setJiraKey(jiraEditValue.trim());
      setJiraEditOpen(false);
      toast.success("Jira story linked");
    } catch {
      toast.error("Failed to save");
    }
    setSavingJira(false);
  };

  const saveStoryKey = async (value: string) => {
    setSavingStory(true);
    try {
      await fetch(`/api/${app}/features/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metadata", storyKey: value }),
      });
      setStoryKey(value);
      setStoryEditOpen(false);
      toast.success(value ? "User story linked" : "User story removed");
    } catch {
      toast.error("Failed to save");
    }
    setSavingStory(false);
  };

  const setPhase = async (phase: string | null, assignToMeVal = false) => {
    setSettingPhase(true);
    try {
      const res = await fetch(`/api/${app}/features/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "testing-phase", phase, assignToMe: assignToMeVal }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTestingPhase(data.phase);
      setTestingSubtasks(data.testingSubtasks ?? {});
      if (data.subtaskCreated && data.subtaskKey) {
        toast.success(`Phase set · Jira subtask created: ${data.subtaskKey}`);
      } else if (phase === null) {
        toast.success("Testing phase cleared");
      } else {
        toast.success(`Phase set to ${TESTING_PHASE_META[phase as TestingPhase]?.label ?? phase}`);
      }
    } catch {
      toast.error("Failed to set testing phase");
    }
    setSettingPhase(false);
  };

  const save = async (type: "workflow" | "testcases") => {
    setSaving(true);
    try {
      await fetch(`/api/${app}/features/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          content: type === "workflow" ? workflow : testcases,
          ...(type === "testcases" && selectedVersion ? { versionFile: selectedVersion } : {}),
        }),
      });
      toast.success(
        `${type === "workflow" ? "Workflow" : "Test cases"} saved!`,
      );
    } catch {
      toast.error("Save failed");
    }
    setSaving(false);
  };

  // Promote the current test-case table into the few-shot "gold" pool so future
  // AI generations for this app prefer it over the static example files.
  const approveAsExample = async () => {
    setApproving(true);
    try {
      const vMatch = selectedVersion.match(/-v(\d+)\.md$/);
      const sourceVersion = vMatch ? parseInt(vMatch[1], 10) : null;
      const res = await fetch(`/api/${app}/features/${name}/approved-examples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: testcases, sourceVersion }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed to approve");
      }
      toast.success("Approved as a few-shot example — future AI generations will use it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve example");
    }
    setApproving(false);
  };

  const uploadScreenshots = async (files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++)
      formData.append("screenshots", files[i]);
    await fetch(`/api/${app}/features/${name}/screenshots`, {
      method: "POST",
      body: formData,
    });
    await loadFeature();
    toast.success(`${files.length} screenshot(s) uploaded!`);
  };

  const deleteScreenshot = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    await fetch(`/api/${app}/features/${name}/screenshots`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: confirmDelete }),
    });
    await loadFeature();
    setDeleting(false);
    setConfirmDelete(null);
    toast.success("Screenshot deleted");
  };

  const screenshots = feature?.screenshots ?? [];
  const screenshotItems: LightboxItem[] = screenshots.map((f) => ({
    src: `/api/${app}/features/${name}/screenshots/${f}`,
    name: f,
    isVideo: false,
  }));

  const runGenerate = async () => {
    setConfirmGenerate(false);
    try {
      const data = await generate(`/api/${app}/features/${name}/generate`, { model: selectedModel });
      if (!data) return;
      await loadFeature();
      setExecVersion(""); // snap execution view back to the new latest version
      await loadExecutions();
      setTestcasesPreview(true);
      setActiveTab("testcases");
      toast.success(`Version ${data.version} generated successfully!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed. Please try again.");
    }
  };

  // Additive flows (AddCasesDialog) append to the latest version in place.
  const handleCasesAdded = async (data: { testcases: string; version: number; added?: number }) => {
    await loadFeature();
    await loadExecutions();
    setTestcasesPreview(true);
    setActiveTab("testcases");
    setAddCasesOpen(false);
    toast.success(
      data.added
        ? `${data.added} case${data.added !== 1 ? "s" : ""} added to v${data.version} — undo available under Add Cases.`
        : `No new cases were added — v${data.version} is unchanged.`
    );
  };

  const undoLastAdd = async () => {
    setUndoing(true);
    try {
      const res = await fetch(`/api/${app}/features/${name}/undo-add`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Undo failed");
      await loadFeature();
      await loadExecutions();
      toast.success(`Removed ${data.removed} case${data.removed !== 1 ? "s" : ""} from v${data.version}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Undo failed.");
    }
    setUndoing(false);
  };

  if (!feature) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const acIds = new Set(acs.map(a => a.id));
  const acParentIds = new Set(acs.filter(a => a.parentId && acIds.has(a.parentId)).map(a => a.parentId as string));
  const topLevelAcs = acs.filter(a => !a.parentId || !acIds.has(a.parentId));
  const leafAcs = acs.filter(a => !acParentIds.has(a.id));
  const acCoveredCount = leafAcs.filter((ac) => getEffectiveCoverage(ac) === "covered").length;
  const acLastAnalyzed = acs.reduce((latest: string | null, ac) => {
    if (!ac.aiAnalyzedAt) return latest;
    return !latest || ac.aiAnalyzedAt > latest ? ac.aiAnalyzedAt : latest;
  }, null);

  const latestVersionNum =
    testcaseVersions.length > 0
      ? parseInt(
          testcaseVersions[testcaseVersions.length - 1].label.match(/v(\d+)/)?.[1] ?? "0",
          10,
        )
      : testcases.trim()
      ? 1  // base file exists — treat as implicit v1
      : 0;
  const nextVersionNum = latestVersionNum + 1;
  // Only the latest version is editable — older versions are read-only baselines.
  const latestVersionFile =
    testcaseVersions.length > 0 ? testcaseVersions[testcaseVersions.length - 1].filename : "";
  const isLatestSelected = !selectedVersion || selectedVersion === latestVersionFile;
  const existingCount = testcases
    ? testcases.split('\n').filter((l) => l.startsWith('|') && !l.includes('Feature ID') && !l.includes('|---|')).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Archived banner */}
      {feature.archived && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm flex-1">
            This feature is archived. It&apos;s hidden from the features list but keeps all test cases, knowledge, and execution history.
          </p>
          {canDelete && (
            <Button variant="outline" size="sm" onClick={handleRestore} disabled={restoring} className="shrink-0 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              {restoring ? "Restoring…" : "Restore"}
            </Button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(featuresBase)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-bold">{titleCase(name)}</h1>
        <ReadinessBadge key={readinessKey} app={app} feature={name} />
        <button
          onClick={() => setEditDetailsOpen(true)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit details
        </button>
        {jiraKey ? (
          <div className="flex items-center gap-1">
            {jiraBaseUrl ? (
              <a
                href={`${jiraBaseUrl}/browse/${jiraKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
              >
                <ExternalLink className="h-3 w-3" />
                {jiraKey}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium font-mono text-muted-foreground">
                {jiraKey}
              </span>
            )}
            <button
              onClick={() => { setJiraEditValue(jiraKey); setJiraEditOpen(true); }}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Edit Jira story"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setJiraEditValue(""); setJiraEditOpen(true); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Link2 className="h-3.5 w-3.5" /> Link story
          </button>
        )}

        {/* User story association */}
        {storyKey ? (
          <div className="flex items-center gap-1">
            <Badge
              variant="outline"
              className="shrink-0 gap-1 text-[10px] font-mono px-1.5 py-0.5 text-violet-700 border-violet-200 bg-violet-50 dark:text-violet-400 dark:border-violet-800 dark:bg-violet-950/30"
              title={storyOptions.find((s) => s.key === storyKey)?.summary}
            >
              <BookOpen className="h-2.5 w-2.5" />
              {storyKey}
            </Badge>
            <button
              onClick={() => { setStoryEditValue(storyKey); setStoryEditOpen(true); }}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Change user story"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setStoryEditValue(""); setStoryEditOpen(true); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" /> Link user story
          </button>
        )}

        {/* Testing phase */}
        {settingPhase ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : testingPhase && TESTING_PHASES.includes(testingPhase as TestingPhase) ? (
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium outline-none transition-opacity hover:opacity-85 ${TESTING_PHASE_META[testingPhase as TestingPhase].className}`}
              >
                <FlaskConical className="h-2.5 w-2.5" />
                {TESTING_PHASE_META[testingPhase as TestingPhase].label}
                <ChevronDown className="h-2.5 w-2.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {TESTING_PHASES.map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onClick={() => {
                      if (!testingSubtasks[p] && jiraKey) {
                        setPendingPhase(p);
                        setPhaseConfirmOpen(true);
                      } else {
                        setPhase(p);
                      }
                    }}
                    className="gap-2"
                  >
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TESTING_PHASE_META[p].className}`}>
                      {TESTING_PHASE_META[p].label}
                    </span>
                    {testingSubtasks[p] && (
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground">{testingSubtasks[p]}</span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPhase(null)} className="text-muted-foreground text-xs">
                  Clear phase
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {testingSubtasks[testingPhase] && jiraBaseUrl && (
              <a
                href={`${jiraBaseUrl}/browse/${testingSubtasks[testingPhase]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                title="Open Jira subtask"
              >
                {testingSubtasks[testingPhase]}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <FlaskConical className="h-3.5 w-3.5" /> Set phase
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {TESTING_PHASES.map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={() => {
                    if (jiraKey) {
                      setPendingPhase(p);
                      setPhaseConfirmOpen(true);
                    } else {
                      setPhase(p);
                    }
                  }}
                  className="gap-2"
                >
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TESTING_PHASE_META[p].className}`}>
                    {TESTING_PHASE_META[p].label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {canDelete && !feature.archived && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground hover:text-destructive"
            onClick={() => setArchiveConfirmOpen(true)}
            title="Archive feature"
          >
            <Archive className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
        <TabsList>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="screenshots">
            Screenshots ({feature.screenshots.length})
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            Knowledge
            {knowledge && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight h-4 ml-1">
                ✓
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="coverage">
            Coverage
            {leafAcs.length > 0 && (
              <Badge
                variant={leafAcs.length > acCoveredCount ? "destructive" : "secondary"}
                className="text-[10px] px-1 py-0 leading-tight h-4 ml-1"
              >
                {acCoveredCount}/{leafAcs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="testcases"
            disabled={!hasTestCaseWriter}
            className={!hasTestCaseWriter ? "opacity-50 cursor-not-allowed gap-1.5" : ""}
          >
            Test Cases
            {testcaseVersions.length > 1 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight h-4 ml-1">
                {testcaseVersions.length}v
              </Badge>
            )}
            {!hasTestCaseWriter && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight h-4">Soon</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="execution"
            disabled={!hasTestCaseWriter}
            className={!hasTestCaseWriter ? "opacity-50 cursor-not-allowed gap-1.5" : ""}
          >
            Test Execution
            {executions.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight h-4 ml-1">
                {executions.filter((e) => e.status === "pass").length}/{executions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="generate"
            disabled={!hasTestCaseWriter}
            className={!hasTestCaseWriter ? "opacity-50 cursor-not-allowed gap-1.5" : ""}
          >
            Generate
            {!hasTestCaseWriter && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight h-4">Soon</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        </div>

        {/* WORKFLOW TAB */}
        <TabsContent value="workflow">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2 pb-3">
              <CardTitle className="text-base">Workflow Definition</CardTitle>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex rounded-md border overflow-hidden">
                  <button
                    onClick={() => setWorkflowPreview(false)}
                    className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${!workflowPreview ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => setWorkflowPreview(true)}
                    className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${workflowPreview ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <Eye className="h-3 w-3" /> Preview
                  </button>
                </div>
                {!workflowPreview && (
                  <Button size="sm" onClick={() => save("workflow")} disabled={saving}>
                    <Save className="h-3.5 w-3.5 mr-1" />{" "}
                    {saving ? "Saving…" : "Save"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {workflowPreview ? (
                <div className="prose prose-sm dark:prose-invert max-w-none min-h-96 overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{workflow}</ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  value={workflow}
                  onChange={(e) => setWorkflow(e.target.value)}
                  className="font-mono text-sm min-h-[600px] resize-y"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SCREENSHOTS TAB */}
        <TabsContent value="screenshots">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2 pb-3">
              <CardTitle className="text-base">Screenshots</CardTitle>
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <Upload className="h-3.5 w-3.5" /> Upload
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files && uploadScreenshots(e.target.files)
                  }
                />
              </label>
            </CardHeader>
            <CardContent>
              {feature.screenshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <span className="text-3xl">📷</span>
                  <p className="text-sm">No screenshots uploaded yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {feature.screenshots.map((file, i) => (
                    <div
                      key={file}
                      className="relative group rounded-lg overflow-hidden border bg-muted aspect-[9/16]"
                    >
                      <img
                        src={`/api/${app}/features/${name}/screenshots/${file}`}
                        alt={file}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setLightboxIndex(i)}
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(file); }}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-opacity"
                        aria-label="Delete screenshot"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">
                        {file}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KNOWLEDGE TAB */}
        <TabsContent value="knowledge">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2 pb-3">
              <CardTitle className="text-base">Feature Knowledge</CardTitle>
              {knowledge && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex rounded-md border overflow-hidden">
                    <button
                      onClick={() => setKnowledgePreview(false)}
                      className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${!knowledgePreview ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => setKnowledgePreview(true)}
                      className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${knowledgePreview ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                  </div>
                  {!knowledgePreview && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        setKnowledgeSaving(true);
                        try {
                          await fetch(`/api/${app}/features/${name}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ type: "knowledge", content: knowledge }),
                          });
                          toast.success("Knowledge saved!");
                        } catch {
                          toast.error("Save failed");
                        }
                        setKnowledgeSaving(false);
                      }}
                      disabled={knowledgeSaving}
                    >
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {knowledgeSaving ? "Saving…" : "Save"}
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {knowledge ? (
                knowledgePreview ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none min-h-96 overflow-x-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{knowledge}</ReactMarkdown>
                  </div>
                ) : (
                  <Textarea
                    value={knowledge}
                    onChange={(e) => setKnowledge(e.target.value)}
                    className="font-mono text-sm min-h-[600px] resize-y"
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 text-center">
                  <Code className="h-8 w-8 text-muted-foreground/40" />
                  <p className="font-medium text-sm">No knowledge file yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Go to{" "}
                    <button
                      onClick={() => router.push(`/${app}/knowledge/stories`)}
                      className="text-primary underline underline-offset-2"
                    >
                      Module Knowledge
                    </button>{" "}
                    to synthesize knowledge from user stories and save it to this feature.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* COVERAGE TAB */}
        <TabsContent value="coverage">
          <Card>
            <CardHeader className="flex-row flex-nowrap items-center justify-between gap-x-3 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CardTitle className="text-base shrink-0">Acceptance Criteria Coverage</CardTitle>
                {leafAcs.length > 0 && (() => {
                  const pct = leafAcs.length ? Math.round((acCoveredCount / leafAcs.length) * 100) : 0;
                  const tone =
                    pct >= 80
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20"
                      : pct >= 40
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20";
                  const bar =
                    pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
                  return (
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset shrink-0 ${tone}`}
                        title={`${acCoveredCount} of ${leafAcs.length} acceptance criteria covered`}
                      >
                        {acCoveredCount}/{leafAcs.length}
                        <span className="opacity-70">covered</span>
                      </span>
                      <div
                        className="hidden sm:block h-1.5 w-16 rounded-full bg-muted overflow-hidden shrink-0"
                        aria-hidden
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {acLastAnalyzed && (
                        <span className="hidden md:inline text-xs text-muted-foreground truncate">
                          analyzed {new Date(acLastAnalyzed).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              {acs.length > 0 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Mode toggle: Standard / Deep segmented control */}
                  <div className="inline-flex items-center rounded-md border border-input bg-muted/40 p-0.5">
                    <button
                      type="button"
                      onClick={() => setDeepMode(false)}
                      disabled={analyzing}
                      aria-pressed={!deepMode}
                      title="Single pass over all acceptance criteria (faster)"
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        !deepMode
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeepMode(true)}
                      disabled={analyzing}
                      aria-pressed={deepMode}
                      title="Analyze each AC individually (slower, more thorough)"
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        deepMode
                          ? "bg-background text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FlaskConical className="h-3 w-3" />
                      Deep
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={analyzeAcs}
                    disabled={analyzing || !testcases.trim()}
                    className="gap-1.5"
                    title={
                      !testcases.trim()
                        ? "Generate test cases first"
                        : deepMode
                          ? "Analyze each AC individually (slower, more thorough)"
                          : "Analyze coverage in a single pass"
                    }
                  >
                    {analyzing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {analyzing
                      ? "Analyzing…"
                      : deepMode
                        ? "Deep Analyze"
                        : "Analyze Coverage"}
                  </Button>
                  {acLastAnalyzed && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        disabled={clearingAi || analyzing}
                        title="More actions"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                      >
                        {clearingAi ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={clearAiMappings}
                          disabled={clearingAi || analyzing}
                          className="gap-2 text-destructive focus:text-destructive"
                        >
                          <X className="h-4 w-4" />
                          Clear AI mappings
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </CardHeader>
            {analyzing && (
              <div
                className="h-0.5 w-full overflow-hidden bg-primary/15"
                role="progressbar"
                aria-label={deepMode ? "Deep analysis in progress" : "Analysis in progress"}
              >
                <div className="coverage-shimmer h-full w-1/4 rounded-full bg-primary/70" />
              </div>
            )}
            <CardContent>
              {acs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 text-center">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
                  <p className="font-medium text-sm">No acceptance criteria defined</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Add criteria manually below, or synthesize from{" "}
                    <button
                      onClick={() => router.push(`/${app}/knowledge/stories`)}
                      className="text-primary underline underline-offset-2"
                    >
                      Module Knowledge
                    </button>{" "}
                    to auto-extract them.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {topLevelAcs.map((ac) => {
                    const acChildren = acs.filter((c) => c.parentId === ac.id);
                    const hasChildren = acChildren.length > 0;
                    const isAddingChild = addingChildFor === ac.id;
                    const status = getEffectiveCoverage(ac);

                    const statusIcon = (s: "covered" | "not_covered" | "unknown") =>
                      s === "covered" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      ) : s === "not_covered" ? (
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 mt-0.5 shrink-0" />
                      );

                    const coverageButtons = (acItem: AcceptanceCriterion) =>
                      acItem.manualCoverage ? (
                        <button
                          onClick={() => toggleManualCoverage(acItem.id, null)}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors border rounded px-1.5 py-0.5 whitespace-nowrap"
                        >
                          Clear override
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleManualCoverage(acItem.id, "covered")}
                            className="text-[10px] text-muted-foreground hover:text-green-600 transition-colors border rounded px-1.5 py-0.5"
                          >
                            ✓ Covered
                          </button>
                          <button
                            onClick={() => toggleManualCoverage(acItem.id, "not_covered")}
                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors border rounded px-1.5 py-0.5"
                          >
                            ✗ Not covered
                          </button>
                        </div>
                      );

                    const editableText = (acItem: AcceptanceCriterion) =>
                      editingAcId === acItem.id ? (
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            value={editingAcText}
                            onChange={(e) => setEditingAcText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveAcs(acs.map((a) => a.id === acItem.id ? { ...a, text: editingAcText.trim() } : a));
                                setEditingAcId(null);
                              }
                              if (e.key === "Escape") setEditingAcId(null);
                            }}
                            className="flex-1 text-sm rounded border border-input bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring/50"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                            onClick={() => { saveAcs(acs.map((a) => a.id === acItem.id ? { ...a, text: editingAcText.trim() } : a)); setEditingAcId(null); }}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingAcId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <p
                          className="text-sm cursor-pointer hover:text-primary transition-colors"
                          title="Click to edit"
                          onClick={() => { setEditingAcId(acItem.id); setEditingAcText(acItem.text); }}
                        >
                          {acItem.text}
                        </p>
                      );

                    return (
                      <div key={ac.id} className="rounded-lg border bg-card">
                        {/* Parent row */}
                        <div className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors rounded-t-lg">
                          {statusIcon(status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {ac.id}
                              </span>
                              {!hasChildren && ac.manualCoverage && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  manual
                                </Badge>
                              )}
                              {hasChildren && (
                                <span className="text-[10px] text-muted-foreground">
                                  {acChildren.filter(c => getEffectiveCoverage(c) === "covered").length}/{acChildren.length} children covered
                                </span>
                              )}
                            </div>
                            {editableText(ac)}
                            {!hasChildren && ac.aiCoveredBy.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {ac.aiCoveredBy.map((tcId) => (
                                  <span key={tcId} className="text-[10px] font-mono bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800 px-1.5 py-0.5 rounded">
                                    {tcId}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 mt-0.5">
                            {!hasChildren && coverageButtons(ac)}
                            <button
                              onClick={() => { setAddingChildFor(isAddingChild ? null : ac.id); setNewChildText(""); }}
                              className="text-[10px] text-muted-foreground hover:text-primary transition-colors border rounded px-1.5 py-0.5 whitespace-nowrap"
                              title="Add a child criterion"
                            >
                              + Child
                            </button>
                            <button
                              onClick={() => deleteAc(ac.id)}
                              className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Children + add-child form */}
                        {(hasChildren || isAddingChild) && (
                          <div className="border-t ml-4 pl-3 pr-3 py-2 space-y-1.5">
                            {acChildren.map((child) => {
                              const childStatus = getEffectiveCoverage(child);
                              return (
                                <div key={child.id} className="flex items-start gap-3 p-2 rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                                  {statusIcon(childStatus)}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        {child.id}
                                      </span>
                                      {child.manualCoverage && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                          manual
                                        </Badge>
                                      )}
                                    </div>
                                    {editableText(child)}
                                    {child.aiCoveredBy.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {child.aiCoveredBy.map((tcId) => (
                                          <span key={tcId} className="text-[10px] font-mono bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800 px-1.5 py-0.5 rounded">
                                            {tcId}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                    {coverageButtons(child)}
                                    <button
                                      onClick={() => deleteAc(child.id)}
                                      className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {isAddingChild && (
                              <div className="flex gap-2 pt-1">
                                <input
                                  type="text"
                                  value={newChildText}
                                  onChange={(e) => setNewChildText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") addChildAc(ac.id);
                                    if (e.key === "Escape") { setAddingChildFor(null); setNewChildText(""); }
                                  }}
                                  placeholder="Add a child criterion…"
                                  className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/50"
                                  autoFocus
                                />
                                <Button size="sm" onClick={() => addChildAc(ac.id)} disabled={!newChildText.trim()} className="gap-1.5">
                                  <Plus className="h-3.5 w-3.5" /> Add
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setAddingChildFor(null); setNewChildText(""); }}>
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  value={newAcText}
                  onChange={(e) => setNewAcText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addAc()}
                  placeholder="Add an acceptance criterion…"
                  className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
                <Button size="sm" onClick={addAc} disabled={!newAcText.trim()} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEST CASES TAB */}
        <TabsContent value="testcases">
          {!hasTestCaseWriter ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <Code className="h-10 w-10 text-muted-foreground/40" />
                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                <p className="font-medium text-muted-foreground">Test Case Writer</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Test case generation is not yet configured for this app.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <CardTitle className="text-base shrink-0">Test Cases</CardTitle>
                    {testcases && existingCount > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        · {existingCount} case{existingCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {testcaseVersions.length > 1 && (() => {
                    const selectVersion = (filename: string | null) => {
                      const v = testcaseVersions.find((x) => x.filename === filename);
                      if (!v) return;
                      setSelectedVersion(v.filename);
                      setTestcases(v.content);
                      setTestcasesPreview(true);
                    };
                    return (
                      <AppSelect
                        aria-label="Select test case version"
                        size="sm"
                        value={selectedVersion}
                        onChange={selectVersion}
                        options={[...testcaseVersions].reverse().map((v) => ({
                          value: v.filename,
                          label: v.label,
                        }))}
                      />
                    );
                  })()}
                </div>
                {testcases && (
                  <div className="flex items-center gap-2 shrink-0">
                    {/* View mode toggle — older versions are read-only archives */}
                    {isLatestSelected ? (
                      <div className="flex rounded-md border overflow-hidden">
                        <button
                          onClick={() => setTestcasesPreview(false)}
                          className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${!testcasesPreview ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => setTestcasesPreview(true)}
                          className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1 ${testcasesPreview ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                          <Eye className="h-3 w-3" /> Preview
                        </button>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs" title="Older versions are read-only baselines — switch to the latest version to edit">
                        Read-only archive
                      </Badge>
                    )}

                    {/* Primary action: Save (edit mode, latest version only) */}
                    {!testcasesPreview && isLatestSelected && (
                      <Button size="sm" onClick={() => save("testcases")} disabled={saving}>
                        <Save className="h-3.5 w-3.5 mr-1" />{" "}
                        {saving ? "Saving…" : "Save"}
                      </Button>
                    )}

                    {/* Add Cases: gap-fill or user scenarios, appended in place + undo */}
                    <AppSelect
                      aria-label="Add test cases"
                      size="sm"
                      placeholder="Add Cases"
                      align="end"
                      value={null}
                      disabled={generating || undoing}
                      onChange={(v) => {
                        if (v === "add") setAddCasesOpen(true);
                        else if (v === "undo") undoLastAdd();
                      }}
                      options={[
                        {
                          value: "add",
                          label: "Add Cases",
                          description: "Fill coverage gaps or describe scenarios — appends to the latest version",
                          icon: <Plus />,
                          disabled: generating,
                        },
                        {
                          value: "undo",
                          label: undoing ? "Undoing…" : "Undo Last Add",
                          description: feature.lastAddition
                            ? `Remove the ${feature.lastAddition.count} case${feature.lastAddition.count !== 1 ? "s" : ""} added ${new Date(feature.lastAddition.at).toLocaleString()}`
                            : "Nothing to undo",
                          icon: <Undo2 />,
                          disabled: !feature.lastAddition || undoing,
                        },
                      ]}
                    />

                    {/* Approve current version as a few-shot gold example */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={approveAsExample}
                      disabled={approving || !testcases.trim()}
                      className="gap-1.5"
                      title="Use this version as a gold example for future AI generations"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{approving ? "Approving…" : "Approve as Example"}</span>
                    </Button>

                    {/* Export */}
                    <AppSelect
                      aria-label="Export test cases"
                      size="sm"
                      placeholder="Export"
                      align="end"
                      value={null}
                      onChange={async (v) => {
                        if (v === "md") {
                          exportAsMarkdown(testcases, name);
                          return;
                        }
                        try {
                          const res = await fetch(`/api/${app}/features/${name}/export`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ content: testcases }),
                          });
                          if (!res.ok) throw new Error("Export failed");
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${name}-testcases.xlsx`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error("Export failed: no table found in test cases.");
                        }
                      }}
                      options={[
                        { value: "md", label: "Markdown (.md)", icon: <FileText /> },
                        { value: "xlsx", label: "Excel (.xlsx)", icon: <Sheet /> },
                      ]}
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {warning && warning.length > 0 && (
                  <ContextWarningBanner
                    missing={warning}
                    onDismiss={dismissWarning}
                    onAction={() => setEditDetailsOpen(true)}
                    actionLabel="Edit feature details"
                    className="mb-4"
                  />
                )}
                {generating && <AIProgressBar phase={phase} className="mb-4" />}
                {testcases ? (
                  testcasesPreview ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{testcases}</ReactMarkdown>
                    </div>
                  ) : (
                    <Textarea
                      value={testcases}
                      onChange={(e) => setTestcases(e.target.value)}
                      className="font-mono text-sm min-h-[500px] resize-y"
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center py-16 gap-3 text-center">
                    <Code className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">No test cases yet</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Go to the{" "}
                      <button
                        onClick={() => setActiveTab("generate")}
                        className="text-primary underline underline-offset-2"
                      >
                        Generate tab
                      </button>{" "}
                      to create test cases with AI.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TEST EXECUTION TAB */}
        <TabsContent value="execution">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2 pb-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <CardTitle className="text-base">Test Execution</CardTitle>
                {testcaseVersions.length > 1 && (
                  <AppSelect
                    aria-label="Select execution version"
                    size="sm"
                    value={execVersion || testcaseVersions[testcaseVersions.length - 1].filename}
                    onChange={(v) => setExecVersion(v ?? "")}
                    options={[...testcaseVersions].reverse().map((v) => ({
                      value: v.filename,
                      label: v.label,
                    }))}
                  />
                )}
                {executions.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {executions.filter((e) => e.status === "pass").length} passed ·{" "}
                    {executions.filter((e) => e.status === "fail").length} failed ·{" "}
                    {executions.filter((e) => e.status === "blocked").length} blocked ·{" "}
                    {executions.length} total
                  </span>
                )}
              </div>
              {executions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={executionExporting}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" /> Export
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExecutionExport("md")} className="gap-2">
                      <FileText className="h-4 w-4" /> Markdown (.md)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExecutionExport("xlsx")} className="gap-2">
                      <Sheet className="h-4 w-4" /> Excel (.xlsx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent>
              {executionsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2 text-center">
                  <Code className="h-8 w-8 text-muted-foreground/40" />
                  <p className="font-medium text-sm">No test cases yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Go to the{" "}
                    <button
                      onClick={() => setActiveTab("generate")}
                      className="text-primary underline underline-offset-2"
                    >
                      Generate tab
                    </button>{" "}
                    to create test cases first.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4 font-medium whitespace-nowrap">Test Case</th>
                        <th className="py-2 pr-4 font-medium">Objective</th>
                        <th className="py-2 pr-4 font-medium w-48">Status</th>
                        <th className="py-2 font-medium w-44">Bug</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executions.map((row) => (
                        <tr key={row.id} className="border-b last:border-0 align-middle">
                          <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">{row.id}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.objective}</td>
                          <td className="py-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${EXECUTION_STATUS_META[row.status].className}`}
                              >
                                {EXECUTION_STATUS_META[row.status].label}
                                <ChevronDown className="h-3 w-3 opacity-70" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="min-w-44 p-1.5">
                                {EXECUTION_STATUSES.map((s) => (
                                  <DropdownMenuItem
                                    key={s}
                                    onClick={() => updateExecutionStatus(row.id, s)}
                                    className="p-1"
                                  >
                                    <span className={`inline-flex w-full items-center rounded-full px-3 py-1 text-xs font-medium ${EXECUTION_STATUS_META[s].className}`}>
                                      {EXECUTION_STATUS_META[s].label}
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                          <td className="py-2">
                            {row.bug ? (
                              row.bug.jiraUrl ? (
                                <a
                                  href={row.bug.jiraUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                >
                                  {row.bug.jiraKey}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <a
                                  href={`/${app}/bugs/${name}/${row.bug.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                                >
                                  <Bug className="h-3 w-3" />
                                  Draft
                                </a>
                              )
                            ) : row.status === "fail" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setBugDialogTc(row)}
                              >
                                <Bug className="h-3 w-3" />
                                Report bug
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GENERATE TAB */}
        <TabsContent value="generate">
          {!hasTestCaseWriter ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                <p className="font-medium text-muted-foreground">AI Test Case Generation</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Test case generation is not yet configured for this app.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Generate Test Cases</CardTitle>
                {testcaseVersions.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {testcaseVersions.length} version{testcaseVersions.length > 1 ? "s" : ""} generated
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Readiness Check */}
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <p className="text-sm font-medium">Readiness Check</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      {workflow ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span>
                        Workflow defined ({workflow ? `${workflow.split("\n").length} lines` : "empty"})
                      </span>
                      {!workflow && (
                        <button
                          onClick={() => setActiveTab("workflow")}
                          className="ml-auto text-xs text-primary underline underline-offset-2"
                        >
                          Add workflow →
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {feature.screenshots.length > 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                      )}
                      <span>Screenshots ({feature.screenshots.length} uploaded)</span>
                      {feature.screenshots.length === 0 && (
                        <button
                          onClick={() => setActiveTab("screenshots")}
                          className="ml-auto text-xs text-primary underline underline-offset-2"
                        >
                          Upload screenshots →
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {warning && warning.length > 0 && (
                  <ContextWarningBanner
                    missing={warning}
                    onDismiss={dismissWarning}
                    onAction={() => setEditDetailsOpen(true)}
                    actionLabel="Edit feature details"
                  />
                )}

                {/* Generate button */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setConfirmGenerate(true)}
                    disabled={!workflow || feature.screenshots.length === 0 || generating}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {generating ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                    ) : (
                      <><Sparkles className="h-4 w-4" />
                        {latestVersionNum > 0
                          ? `Generate New Version (v${nextVersionNum})`
                          : "Generate Test Cases (v1)"}
                      </>
                    )}
                  </Button>
                  {(!workflow || feature.screenshots.length === 0) && !generating && (
                    <p className="text-xs text-muted-foreground text-center">
                      {!workflow && feature.screenshots.length === 0
                        ? "Requires workflow definition and at least one screenshot"
                        : !workflow
                        ? "Requires workflow definition"
                        : "Requires at least one screenshot"}
                    </p>
                  )}
                  {generating && <AIProgressBar phase={phase} />}
                </div>

                {/* Previous versions */}
                {testcaseVersions.length > 0 && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generated Versions</p>
                    <div className="space-y-1">
                      {[...testcaseVersions].reverse().map((v) => (
                        <div key={v.filename} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{v.label}</span>
                          <button
                            onClick={() => {
                              setSelectedVersion(v.filename);
                              setTestcases(v.content);
                              setTestcasesPreview(true);
                              setActiveTab("testcases");
                            }}
                            className="text-xs text-primary underline underline-offset-2"
                          >
                            View →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm Generate Dialog (full regenerate = new version baseline) */}
      <Dialog open={confirmGenerate} onOpenChange={(open) => !open && setConfirmGenerate(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Test Cases</DialogTitle>
            <DialogDescription>
              {latestVersionNum > 0 ? (
                <>This will create <strong>version {nextVersionNum}</strong> as a fresh baseline and <strong>reset all execution statuses and bug links</strong>. Older versions are preserved and accessible from the Test Cases tab. To add cases without a new version, use <strong>Add Cases</strong> instead.</>
              ) : (
                <>This will generate <strong>version {nextVersionNum}</strong> of test cases for <strong>{name}</strong>. Workflow + {feature.screenshots.length} screenshot(s) will be analyzed.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">AI Model</label>
            <ModelSelector
              models={models}
              value={selectedModel}
              onChange={setSelectedModel}
              showVisionWarning
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmGenerate(false)}>Cancel</Button>
            <Button onClick={runGenerate} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Cases Dialog: gap-fill with optional direction, or exact scenarios */}
      <AddCasesDialog
        open={addCasesOpen}
        app={app}
        featureName={name}
        existingCount={existingCount}
        latestVersionNum={latestVersionNum}
        onDone={handleCasesAdded}
        onClose={() => setAddCasesOpen(false)}
      />

      <ReportBugDialog
        open={!!bugDialogTc}
        app={app}
        featureName={name}
        module={moduleSlug}
        testcase={bugDialogTc ? { id: bugDialogTc.id, objective: bugDialogTc.objective, steps: bugDialogTc.steps ?? "" } : null}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        execVersion={execVersionNum}
        onClose={() => setBugDialogTc(null)}
        onLinked={handleBugLinked}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Screenshot</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{confirmDelete}</span>?{" "}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteScreenshot} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Story Link Dialog */}
      <Dialog open={storyEditOpen} onOpenChange={(open) => !open && setStoryEditOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{storyKey ? "Change User Story" : "Link User Story"}</DialogTitle>
            <DialogDescription>
              Associate this feature with a user story to group it on the features list.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {storyOptions.length > 0 ? (
              <Select value={storyEditValue || "__none__"} onValueChange={(v) => setStoryEditValue(v == null || v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a user story…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {storyOptions.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.key} — {s.summary}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                type="text"
                value={storyEditValue}
                onChange={(e) => setStoryEditValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveStoryKey(storyEditValue.trim())}
                placeholder="e.g. ABC-123"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring/50"
                autoFocus
              />
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setStoryEditOpen(false)}>Cancel</Button>
            {storyKey && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => saveStoryKey("")}
                disabled={savingStory}
              >
                Remove
              </Button>
            )}
            <Button onClick={() => saveStoryKey(storyEditValue.trim())} disabled={savingStory}>
              {savingStory ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Testing Phase Confirm Dialog */}
      <Dialog open={phaseConfirmOpen} onOpenChange={(open) => { if (!open) { setPhaseConfirmOpen(false); setPendingPhase(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Testing Phase</DialogTitle>
            <DialogDescription>
              {pendingPhase && (
                <>
                  A Jira sub-task{" "}
                  <span className="font-medium text-foreground">
                    &ldquo;Testing: {TESTING_PHASE_META[pendingPhase].label}&rdquo;
                  </span>{" "}
                  will be created under story:
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm font-medium">{jiraKey}</span>
              {jiraBaseUrl && jiraKey && (
                <a
                  href={`${jiraBaseUrl}/browse/${jiraKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View in Jira ↗
                </a>
              )}
            </div>
            {pendingPhase && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Phase:</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TESTING_PHASE_META[pendingPhase].className}`}>
                  <FlaskConical className="h-2.5 w-2.5" />
                  {TESTING_PHASE_META[pendingPhase].label}
                </span>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={assignToMe}
                onChange={(e) => setAssignToMe(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span className="text-sm">Assign to me</span>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setPhaseConfirmOpen(false); setPendingPhase(null); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingPhase) {
                  setPhaseConfirmOpen(false);
                  setPhase(pendingPhase, assignToMe);
                  setPendingPhase(null);
                }
              }}
              disabled={settingPhase}
              className="gap-1.5"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Set Phase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Jira Link Dialog */}
      <Dialog open={jiraEditOpen} onOpenChange={(open) => !open && setJiraEditOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{jiraKey ? "Edit Jira Story" : "Link Jira Story"}</DialogTitle>
            <DialogDescription>
              Enter the Jira ticket key (e.g. <span className="font-mono">PROJ-123</span>). The link will open in Jira using your configured base URL.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <input
              type="text"
              value={jiraEditValue}
              onChange={(e) => setJiraEditValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveJiraKey()}
              placeholder="e.g. PROJ-123"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring/50"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setJiraEditOpen(false)}>Cancel</Button>
            {jiraKey && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  setSavingJira(true);
                  try {
                    await fetch(`/api/${app}/features/${name}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "metadata", jiraKey: "" }),
                    });
                    setJiraKey("");
                    setJiraEditOpen(false);
                    toast.success("Jira link removed");
                  } catch {
                    toast.error("Failed to remove");
                  }
                  setSavingJira(false);
                }}
                disabled={savingJira}
              >
                Remove
              </Button>
            )}
            <Button onClick={saveJiraKey} disabled={savingJira || !jiraEditValue.trim()}>
              {savingJira ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot lightbox (shared component) */}
      <Lightbox
        items={screenshotItems}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />

      {/* Edit Feature Details Dialog — same intake form the creation wizard uses,
          pre-filled from intake.json; saving recompiles workflow.md server-side. */}
      <Dialog open={editDetailsOpen} onOpenChange={(open) => !open && setEditDetailsOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Feature Details</DialogTitle>
            <DialogDescription>
              Updates the answers behind this feature&apos;s workflow.md — the spec the AI reads when generating test cases.
            </DialogDescription>
          </DialogHeader>
          <IntakeGroupForm
            app={app}
            scope="feature"
            slug={name}
            group={FEATURE_INTAKE_GROUPS[0]}
            initialAnswers={intakeAnswers}
            onSaved={async () => {
              setEditDetailsOpen(false);
              await loadFeature();
              await loadIntake();
              setReadinessKey((k) => k + 1);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Archive Feature Confirmation Dialog */}
      <Dialog open={archiveConfirmOpen} onOpenChange={(open) => !open && setArchiveConfirmOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive feature?</DialogTitle>
            <DialogDescription>
              It disappears from the list but keeps all test cases, knowledge, and execution history.
              You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setArchiveConfirmOpen(false)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving} className="gap-1.5">
              <Archive className="h-3.5 w-3.5" />
              {archiving ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
