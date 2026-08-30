"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronDown,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  FlaskConical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AcceptanceCriterion, useAcceptanceCriteria } from "./useAcceptanceCriteria";

// Presentational body of the Coverage tab. The tab-trigger badge (in page.tsx)
// reads `coverage.leafAcs`/`coverage.acCoveredCount` directly since base-ui Tabs
// unmounts this panel when another tab is active.
export function CoverageTab({
  coverage,
  testcases,
}: {
  coverage: ReturnType<typeof useAcceptanceCriteria>;
  testcases: string;
}) {
  const router = useRouter();
  const params = useParams();
  const app = params?.app as string;

  const {
    acs,
    leafAcs,
    acCoveredCount,
    acLastAnalyzed,
    topLevelAcs,
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
    addAc,
    addChildAc,
    deleteAc,
    toggleManualCoverage,
    analyzeAcs,
    clearAiMappings,
    saveAcs,
    getEffectiveCoverage,
  } = coverage;

  return (
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
  );
}
