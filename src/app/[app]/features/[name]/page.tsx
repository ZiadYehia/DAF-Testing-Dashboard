"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { titleCase } from "@/lib/utils";
import { useApp } from "@/lib/use-apps";
import { usePermissions } from "@/lib/use-permissions";
import type { PermissionKey } from "@/lib/permissions";
import { ModelSelector } from "@/components/shared/ModelSelector";
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
  ChevronDown,
  Code,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  FileText,
  Sheet,
  Plus,
  ExternalLink,
  Link2,
  BookOpen,
  FlaskConical,
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
import type { ExecutionStatus } from "@/lib/execution-types";
import { useStreamingGenerate } from "@/hooks/useStreamingGenerate";
import { useModels } from "@/hooks/useModels";
import { AIProgressBar } from "@/components/shared/AIProgressBar";
import { AddCasesDialog } from "./AddCasesDialog";
import { ReportBugDialog, type LinkedBug } from "./ReportBugDialog";
import { useAcceptanceCriteria } from "./useAcceptanceCriteria";
import { CoverageTab } from "./CoverageTab";
import { ScreenshotsTab } from "./ScreenshotsTab";
import { ExecutionTab, type ExecutionRow, type TestcaseVersion } from "./ExecutionTab";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  const [activeTab, setActiveTab] = useState("workflow");
  const { generate, generating, phase, warning, dismissWarning } = useStreamingGenerate<{ testcases: string; version: number }>();
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [addCasesOpen, setAddCasesOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const { models, selectedModel, setSelectedModel } = useModels();
  const cov = useAcceptanceCriteria({ app, name, selectedModel });
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  // Which test-case version the execution tab is showing (filename, "" = latest).
  const [execVersion, setExecVersion] = useState<string>("");
  /**
   * Which environment's results are on screen. "" = the no-environment bucket, where every
   * result recorded before environments existed lives.
   *
   * Status, counts and the bug links all come from the one fetch below, so scoping the fetch
   * scopes everything the tab shows — there is no second place a stale environment could leak
   * in from.
   */
  const [execEnvironment, setExecEnvironment] = useState<string>("");
  const [environments, setEnvironments] = useState<string[]>([]);
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

  const loadExecutions = useCallback(async () => {
    setExecutionsLoading(true);
    try {
      const params = new URLSearchParams();
      if (execVersionNum) params.set("version", execVersionNum);
      if (execEnvironment) params.set("environment", execEnvironment);
      const qs = params.toString();
      const url = `/api/${app}/features/${name}/execution${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const { testcases } = await res.json();
        setExecutions(testcases ?? []);
      }
    } finally {
      setExecutionsLoading(false);
    }
  }, [app, name, execVersion, execEnvironment]);

  useEffect(() => { loadExecutions(); }, [loadExecutions]);

  // The environment list drives the selector. Fetched once per app; a failure leaves it
  // empty, which degrades to the no-environment bucket rather than blocking the tab.
  const loadEnvironments = useCallback(async () => {
    try {
      const res = await fetch(`/api/${app}/environments`);
      const list = res.ok ? await res.json() : [];
      setEnvironments(list.map((e: { name: string }) => e.name));
    } catch {
      setEnvironments([]);
    }
  }, [app]);

  useEffect(() => { loadEnvironments(); }, [loadEnvironments]);

  const updateExecutionStatus = async (testcaseId: string, status: ExecutionStatus) => {
    const prev = executions;
    setExecutions((rows) => rows.map((r) => (r.id === testcaseId ? { ...r, status } : r)));
    try {
      const res = await fetch(`/api/${app}/features/${name}/execution`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testcaseId, status, version: execVersionNum,
          environment: execEnvironment || undefined,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setExecutions(prev);
      toast.error("Failed to update status");
    }
  };

  const updateExecutionNotes = async (testcaseId: string, notes: string) => {
    const prev = executions;
    setExecutions((rows) => rows.map((r) => (r.id === testcaseId ? { ...r, notes } : r)));
    try {
      const res = await fetch(`/api/${app}/features/${name}/execution`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testcaseId, notes, version: execVersionNum,
          environment: execEnvironment || undefined,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setExecutions(prev);
      toast.error("Failed to update notes");
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
            {cov.leafAcs.length > 0 && (
              <Badge
                variant={cov.leafAcs.length > cov.acCoveredCount ? "destructive" : "secondary"}
                className="text-[10px] px-1 py-0 leading-tight h-4 ml-1"
              >
                {cov.acCoveredCount}/{cov.leafAcs.length}
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
          <ScreenshotsTab app={app} name={name} screenshots={feature.screenshots} onChanged={loadFeature} />
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
          <CoverageTab coverage={cov} testcases={testcases} />
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
          <ExecutionTab
            app={app}
            name={name}
            executions={executions}
            executionsLoading={executionsLoading}
            testcaseVersions={testcaseVersions}
            execVersion={execVersion}
            execEnvironment={execEnvironment}
            environments={environments}
            onExecEnvironmentChange={setExecEnvironment}
            onExecVersionChange={setExecVersion}
            exporting={executionExporting}
            onExport={handleExecutionExport}
            onStatusChange={updateExecutionStatus}
            onNotesChange={updateExecutionNotes}
            onReportBug={setBugDialogTc}
            onGoGenerate={() => setActiveTab("generate")}
          />
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
