"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSelect } from "@/components/shared/AppSelect";
import {
  ChevronDown,
  Code,
  Download,
  FileText,
  Sheet,
  Bug,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { EXECUTION_STATUSES, type ExecutionStatus } from "@/lib/execution-types";
import type { LinkedBug } from "./ReportBugDialog";

export interface TestcaseVersion {
  label: string;
  filename: string;
  content: string;
}

export interface ExecutionRow {
  id: string;
  objective: string;
  steps?: string;
  status: ExecutionStatus;
  bug?: LinkedBug | null;
  notes?: string | null;
}

export const EXECUTION_STATUS_META: Record<ExecutionStatus, { label: string; className: string }> = {
  new_added:     { label: "New Added",       className: "bg-red-900 text-white" },
  ready:         { label: "Ready for Test",  className: "bg-cyan-100 text-cyan-700 border border-cyan-300" },
  pass:          { label: "Pass",            className: "bg-green-600 text-white" },
  fail:          { label: "Fail",            className: "bg-red-100 text-red-800 border border-red-300" },
  blocked:       { label: "Blocked/Skipped", className: "bg-gray-500 text-white" },
  under_testing: { label: "Under Testing",   className: "bg-purple-100 text-purple-700 border border-purple-300" },
};

// Presentational only — execution state (rows, loading, version selection) and
// its mutation handlers stay in page.tsx because they're shared with the
// always-mounted tab-trigger badge, runGenerate, and <ReportBugDialog>.
export function ExecutionTab({
  app,
  name,
  executions,
  executionsLoading,
  testcaseVersions,
  execVersion,
  onExecVersionChange,
  execEnvironment,
  environments,
  onExecEnvironmentChange,
  exporting,
  onExport,
  onStatusChange,
  onNotesChange,
  onReportBug,
  onGoGenerate,
}: {
  app: string;
  name: string;
  executions: ExecutionRow[];
  executionsLoading: boolean;
  testcaseVersions: TestcaseVersion[];
  execVersion: string;
  onExecVersionChange: (v: string) => void;
  /** Selected environment; "" = the no-environment bucket. */
  execEnvironment: string;
  /** Every environment defined for this app, by name. */
  environments: string[];
  onExecEnvironmentChange: (v: string) => void;
  exporting: boolean;
  onExport: (format: "md" | "xlsx") => void;
  onStatusChange: (testcaseId: string, status: ExecutionStatus) => void;
  onNotesChange: (testcaseId: string, notes: string) => void;
  onReportBug: (row: ExecutionRow) => void;
  onGoGenerate: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  // Escape removes the (focused) textarea from the DOM, which fires a native
  // blur — without this guard that blur would run the onBlur save handler
  // right after cancel, silently reviving the discarded edit.
  const cancelledRef = useRef(false);

  const startEditing = (row: ExecutionRow) => {
    setEditingId(row.id);
    setDraftNote(row.notes ?? "");
  };

  const commitEdit = (testcaseId: string) => {
    if (cancelledRef.current) { cancelledRef.current = false; return; }
    setEditingId(null);
    onNotesChange(testcaseId, draftNote);
  };

  const cancelEdit = () => {
    cancelledRef.current = true;
    setEditingId(null);
    setDraftNote("");
  };
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2 pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <CardTitle className="text-base">Test Execution</CardTitle>
          {testcaseVersions.length > 1 && (
            <AppSelect
              aria-label="Select execution version"
              size="sm"
              value={execVersion || testcaseVersions[testcaseVersions.length - 1].filename}
              onChange={(v) => onExecVersionChange(v ?? "")}
              options={[...testcaseVersions].reverse().map((v) => ({
                value: v.filename,
                label: v.label,
              }))}
            />
          )}
          {environments.length > 0 && (
            <AppSelect
              aria-label="Select execution environment"
              size="sm"
              value={execEnvironment}
              onChange={(v) => onExecEnvironmentChange(v ?? "")}
              options={[
                // Named "No environment" rather than left blank: results recorded before
                // environments existed live here, and they are a real set someone may want to
                // look at, not an empty selection.
                { value: "", label: "No environment" },
                ...environments.map((e) => ({ value: e, label: e })),
              ]}
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
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport("md")} className="gap-2">
                <FileText className="h-4 w-4" /> Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("xlsx")} className="gap-2">
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
                onClick={onGoGenerate}
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
                  <th className="py-2 pr-4 font-medium w-44">Bug</th>
                  <th className="py-2 font-medium w-64">Notes</th>
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
                              onClick={() => onStatusChange(row.id, s)}
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
                    <td className="py-2 pr-4">
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
                          onClick={() => onReportBug(row)}
                        >
                          <Bug className="h-3 w-3" />
                          Report bug
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="py-2 align-top">
                      {editingId === row.id ? (
                        <textarea
                          autoFocus
                          value={draftNote}
                          onChange={(e) => setDraftNote(e.target.value)}
                          onBlur={() => commitEdit(row.id)}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                              e.preventDefault();
                              commitEdit(row.id);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          rows={3}
                          placeholder="Add a note…"
                          className="w-full min-w-[14rem] resize-y rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(row)}
                          title={row.notes ?? undefined}
                          className="group flex w-full max-w-[16rem] items-center gap-1 truncate rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                        >
                          {row.notes ? (
                            <span className="truncate text-muted-foreground">{row.notes}</span>
                          ) : (
                            <span className="flex items-center gap-1 text-muted-foreground/40 group-hover:text-muted-foreground">
                              <Pencil className="h-3 w-3" />
                              Add note
                            </span>
                          )}
                        </button>
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
  );
}
