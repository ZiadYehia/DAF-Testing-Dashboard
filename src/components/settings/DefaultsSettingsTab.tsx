'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DEFAULT_BUG_FORMAT, type BugFormatConfig } from '@/lib/bug-format'
import { DEFAULT_CR_FORMAT, type CrFormatConfig } from '@/lib/cr-format'
import { BugVariantSection } from '@/components/settings/BugVariantSection'
import { CrVariantSection } from '@/components/settings/CrVariantSection'
import { ChipListEditor, GroupLabel } from '@/components/settings/fields'
import { fetchWithRetry } from '@/components/settings/fetchWithRetry'

export type AppSettings = {
  testerName: string
  testcaseEnvironment: string
  bugEnvironment: string
  jiraSubtaskIssueType: string
  jiraStoryBugIssueType: string
  jiraEpicBugIssueType: string
  jiraCrSubtaskIssueType: string
  jiraCrStoryIssueType: string
}

export const APP_SETTING_KEYS = [
  'testerName',
  'testcaseEnvironment',
  'bugEnvironment',
  'jiraSubtaskIssueType',
  'jiraStoryBugIssueType',
  'jiraEpicBugIssueType',
  'jiraCrSubtaskIssueType',
  'jiraCrStoryIssueType',
] as const

export function DefaultsSettingsTab({ app }: { app: string }) {
  // Per-app defaults
  const [appSettings, setAppSettings] = useState<AppSettings>({
    testerName: '',
    testcaseEnvironment: '',
    bugEnvironment: '',
    jiraSubtaskIssueType: '',
    jiraStoryBugIssueType: '',
    jiraEpicBugIssueType: '',
    jiraCrSubtaskIssueType: '',
    jiraCrStoryIssueType: '',
  })
  const [loadingApp, setLoadingApp] = useState(true)
  const [savingDefaults, setSavingDefaults] = useState(false)

  // Per-app bug report format (epic/story variants + shared value lists)
  const [bugFormat, setBugFormat] = useState<BugFormatConfig>(DEFAULT_BUG_FORMAT)
  const [loadingBugFormat, setLoadingBugFormat] = useState(true)

  // Per-app change-request format (story/epic variants + shared change-type list)
  const [crFormat, setCrFormat] = useState<CrFormatConfig>(DEFAULT_CR_FORMAT)
  const [loadingCrFormat, setLoadingCrFormat] = useState(true)

  const loadAppSettings = useCallback(async () => {
    setLoadingApp(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/settings`)
      if (!res.ok) throw new Error('Failed to load defaults')
      const data = await res.json()
      setAppSettings({
        testerName: data.testerName ?? '',
        testcaseEnvironment: data.testcaseEnvironment ?? '',
        bugEnvironment: data.bugEnvironment ?? '',
        jiraSubtaskIssueType: data.jiraSubtaskIssueType ?? '',
        jiraStoryBugIssueType: data.jiraStoryBugIssueType ?? '',
        jiraEpicBugIssueType: data.jiraEpicBugIssueType ?? '',
        jiraCrSubtaskIssueType: data.jiraCrSubtaskIssueType ?? '',
        jiraCrStoryIssueType: data.jiraCrStoryIssueType ?? '',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load defaults')
    } finally {
      setLoadingApp(false)
    }
  }, [app])

  const loadBugFormat = useCallback(async () => {
    if (!app) return
    setLoadingBugFormat(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/bug-format`)
      if (!res.ok) throw new Error('Failed to load bug report format')
      const data = await res.json()
      setBugFormat(data.config ?? DEFAULT_BUG_FORMAT)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load bug report format')
    } finally {
      setLoadingBugFormat(false)
    }
  }, [app])

  const loadCrFormat = useCallback(async () => {
    if (!app) return
    setLoadingCrFormat(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/cr-format`)
      if (!res.ok) throw new Error('Failed to load change request format')
      const data = await res.json()
      setCrFormat(data.config ?? DEFAULT_CR_FORMAT)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load change request format')
    } finally {
      setLoadingCrFormat(false)
    }
  }, [app])

  useEffect(() => {
    loadAppSettings()
    loadBugFormat()
    loadCrFormat()
  }, [loadAppSettings, loadBugFormat, loadCrFormat])

  async function saveAppSettings() {
    setSavingDefaults(true)
    try {
      await Promise.all([
        ...APP_SETTING_KEYS.map((key) =>
          fetch(`/api/${app}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: appSettings[key] }),
          }).then((r) => {
            if (!r.ok) throw new Error(`Failed to save ${key}`)
          })
        ),
        fetch(`/api/${app}/bug-format`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: bugFormat }),
        }).then((r) => {
          if (!r.ok) throw new Error('Failed to save bug report format')
        }),
        fetch(`/api/${app}/cr-format`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: crFormat }),
        }).then((r) => {
          if (!r.ok) throw new Error('Failed to save change request format')
        }),
      ])
      toast.success('Defaults saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingDefaults(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Test Case &amp; Bug Report Defaults</CardTitle>
          <CardDescription>
            These values are injected into generated test cases and bug reports for this app. Each app can have its own defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingApp ? (
            <div className="space-y-4">
              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-24 rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-24 rounded-lg bg-muted/40 animate-pulse" />
            </div>
          ) : (
            <>
              {/* Tester Display Name */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tester Display Name</label>
                <p className="text-xs text-muted-foreground">
                  Appears in the <code className="text-xs">Tester</code> column of every generated test case table.
                </p>
                <Input
                  value={appSettings.testerName}
                  onChange={(e) => setAppSettings((s) => ({ ...s, testerName: e.target.value }))}
                  placeholder="e.g. Jane Doe"
                  className="h-9"
                />
              </div>

              {/* Test Case Environment */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Environment (Test Cases)</label>
                <p className="text-xs text-muted-foreground">
                  Full string placed in the <code className="text-xs">Enviroment</code> column. The Role placeholder{' '}
                  <code className="text-xs">&lt;Admin|Auditor|…&gt;</code> is replaced per scenario by the AI.
                </p>
                <Textarea
                  value={appSettings.testcaseEnvironment}
                  onChange={(e) => setAppSettings((s) => ({ ...s, testcaseEnvironment: e.target.value }))}
                  className="min-h-[80px] resize-y font-mono text-sm"
                  placeholder="Browser: … | Environment: … | Role: <…>"
                />
              </div>

              {/* Bug Report Environment */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Environment (Bug Reports)</label>
                <p className="text-xs text-muted-foreground">
                  Injected into the <strong>Environment:</strong> section of generated bug reports.
                </p>
                <Textarea
                  value={appSettings.bugEnvironment}
                  onChange={(e) => setAppSettings((s) => ({ ...s, bugEnvironment: e.target.value }))}
                  className="min-h-[80px] resize-y font-mono text-sm"
                  placeholder="Browser: … | Environment: …"
                />
              </div>

            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bug Report Format</CardTitle>
          <CardDescription>
            Which fields appear in generated bug reports, the Jira labels offered at report
            time, and the Priority/Severity value lists — configured separately for Epic and
            Story bugs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingBugFormat ? (
            <div className="space-y-4">
              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />
            </div>
          ) : (
            <>
              <Tabs defaultValue="epic">
                <TabsList>
                  <TabsTrigger value="epic">Epic Bugs</TabsTrigger>
                  <TabsTrigger value="story">Story Bugs</TabsTrigger>
                </TabsList>
                <TabsContent value="epic">
                  <BugVariantSection
                    description="Bugs reported directly, with no parent story."
                    variant="epic"
                    app={app}
                    config={bugFormat.epic}
                    severityOptions={bugFormat.severityOptions}
                    onChange={(updater) => setBugFormat((prev) => ({ ...prev, epic: updater(prev.epic) }))}
                  />
                </TabsContent>
                <TabsContent value="story">
                  <BugVariantSection
                    description="Bugs linked to a parent story."
                    variant="story"
                    app={app}
                    config={bugFormat.story}
                    severityOptions={bugFormat.severityOptions}
                    onChange={(updater) => setBugFormat((prev) => ({ ...prev, story: updater(prev.story) }))}
                  />
                </TabsContent>
              </Tabs>

              <div className="space-y-2.5 border-t pt-4">
                <div>
                  <GroupLabel>Value lists (shared)</GroupLabel>
                  <p className="text-xs text-muted-foreground">
                    Apply to both Epic and Story bugs.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Priority values</label>
                    <p className="text-xs text-muted-foreground">
                      Values should start with P1–P4 to map to Jira priority (P1→Highest,
                      P2→High, P3→Medium, P4→Low); other values fall back to Medium.
                    </p>
                    <ChipListEditor
                      items={bugFormat.priorityOptions}
                      onAdd={(value) =>
                        setBugFormat((prev) =>
                          prev.priorityOptions.includes(value)
                            ? prev
                            : { ...prev, priorityOptions: [...prev.priorityOptions, value] }
                        )
                      }
                      onRemove={(value) =>
                        setBugFormat((prev) => ({
                          ...prev,
                          priorityOptions: prev.priorityOptions.filter((v) => v !== value),
                        }))
                      }
                      placeholder="e.g. P1 – Critical"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Severity values</label>
                    <p className="text-xs text-muted-foreground">
                      Used for the Severity dropdown in bug forms.
                    </p>
                    <ChipListEditor
                      items={bugFormat.severityOptions}
                      onAdd={(value) =>
                        setBugFormat((prev) =>
                          prev.severityOptions.includes(value)
                            ? prev
                            : { ...prev, severityOptions: [...prev.severityOptions, value] }
                        )
                      }
                      onRemove={(value) =>
                        setBugFormat((prev) => ({
                          ...prev,
                          severityOptions: prev.severityOptions.filter((v) => v !== value),
                        }))
                      }
                      placeholder="e.g. S1 – Critical"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Change Request Format</CardTitle>
          <CardDescription>
            Which fields appear on a Change Request, the Jira labels offered when filing one,
            and the editable Change Type list — configured separately for CRs filed under a
            Story (Jira sub-task) and under an Epic (Jira story).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingCrFormat ? (
            <div className="space-y-4">
              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-40 rounded-lg bg-muted/40 animate-pulse" />
            </div>
          ) : (
            <>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                The epic-to-child link uses Jira&apos;s <code className="text-xs">parent</code> field, which requires a
                team-managed (or new-Jira) project. Company-managed classic projects that use the legacy &quot;Epic
                Link&quot; custom field are not supported yet.
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Summary prefix</label>
                <p className="text-xs text-muted-foreground">
                  Prepended to the Jira summary for every change request, e.g. <code className="text-xs">CR: &lt;summary&gt;</code>.
                </p>
                <Input
                  value={crFormat.summaryPrefix}
                  onChange={(e) => setCrFormat((prev) => ({ ...prev, summaryPrefix: e.target.value }))}
                  placeholder="CR: "
                  className="h-9 font-mono text-sm"
                />
              </div>

              <Tabs defaultValue="story">
                <TabsList>
                  <TabsTrigger value="story">Story CRs (Sub-task)</TabsTrigger>
                  <TabsTrigger value="epic">Epic CRs (Story)</TabsTrigger>
                </TabsList>
                <TabsContent value="story">
                  <CrVariantSection
                    description="Change requests filed against a parent story — created in Jira as a sub-task of it."
                    variant="story"
                    app={app}
                    config={crFormat.story}
                    changeTypes={crFormat.changeTypes}
                    defaultIssueType={appSettings.jiraCrSubtaskIssueType || 'Sub-task'}
                    onChange={(updater) => setCrFormat((prev) => ({ ...prev, story: updater(prev.story) }))}
                  />
                </TabsContent>
                <TabsContent value="epic">
                  <CrVariantSection
                    description="Change requests filed against a parent epic — created in Jira as a story under it."
                    variant="epic"
                    app={app}
                    config={crFormat.epic}
                    changeTypes={crFormat.changeTypes}
                    defaultIssueType={appSettings.jiraCrStoryIssueType || 'Story'}
                    onChange={(updater) => setCrFormat((prev) => ({ ...prev, epic: updater(prev.epic) }))}
                  />
                </TabsContent>
              </Tabs>

              <div className="space-y-2.5 border-t pt-4">
                <div>
                  <GroupLabel>Change types (shared)</GroupLabel>
                  <p className="text-xs text-muted-foreground">
                    The list of change-type values offered when filing a CR under a story or an epic. The AI picks
                    one of these when drafting a change request.
                  </p>
                </div>
                <ChipListEditor
                  items={crFormat.changeTypes}
                  onAdd={(value) =>
                    setCrFormat((prev) =>
                      prev.changeTypes.includes(value) ? prev : { ...prev, changeTypes: [...prev.changeTypes, value] }
                    )
                  }
                  onRemove={(value) =>
                    setCrFormat((prev) => ({
                      ...prev,
                      changeTypes: prev.changeTypes.filter((v) => v !== value),
                    }))
                  }
                  placeholder="e.g. Scope add"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Jira Issue Types</CardTitle>
          <CardDescription>
            The Jira issue type names used when this app creates issues. These must match
            the issue type names configured in your Jira project. Each app can have its own.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingApp ? (
            <div className="space-y-4">
              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Testing Phase Sub-task Type</label>
                <p className="text-xs text-muted-foreground">
                  Created under the story when you set its state to Testcase Design, Execution, or Retest.
                </p>
                <Input
                  value={appSettings.jiraSubtaskIssueType}
                  onChange={(e) => setAppSettings((s) => ({ ...s, jiraSubtaskIssueType: e.target.value }))}
                  placeholder="Sub-task"
                  className="h-9 font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Story Bug Issue Type</label>
                <p className="text-xs text-muted-foreground">
                  Used when a bug is reported under a story (with a parent key).
                </p>
                <Input
                  value={appSettings.jiraStoryBugIssueType}
                  onChange={(e) => setAppSettings((s) => ({ ...s, jiraStoryBugIssueType: e.target.value }))}
                  placeholder="Dev Bug"
                  className="h-9 font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Epic Bug Issue Type</label>
                <p className="text-xs text-muted-foreground">
                  Used when a bug is reported at the epic/project level (no parent story).
                </p>
                <Input
                  value={appSettings.jiraEpicBugIssueType}
                  onChange={(e) => setAppSettings((s) => ({ ...s, jiraEpicBugIssueType: e.target.value }))}
                  placeholder="Bug"
                  className="h-9 font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">CR under Story</label>
                <p className="text-xs text-muted-foreground">
                  Default issue type for a change request filed under a story (a Jira sub-task), unless overridden
                  in the Change Request Format section above.
                </p>
                <Input
                  value={appSettings.jiraCrSubtaskIssueType}
                  onChange={(e) => setAppSettings((s) => ({ ...s, jiraCrSubtaskIssueType: e.target.value }))}
                  placeholder="Sub-task"
                  className="h-9 font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">General CR under Epic</label>
                <p className="text-xs text-muted-foreground">
                  Default issue type for a change request filed under an epic (a Jira story), unless overridden in
                  the Change Request Format section above.
                </p>
                <Input
                  value={appSettings.jiraCrStoryIssueType}
                  onChange={(e) => setAppSettings((s) => ({ ...s, jiraCrStoryIssueType: e.target.value }))}
                  placeholder="Story"
                  className="h-9 font-mono text-sm"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="pt-1">
        <Button
          onClick={saveAppSettings}
          disabled={savingDefaults || loadingApp || loadingBugFormat || loadingCrFormat}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {savingDefaults ? 'Saving…' : 'Save Defaults'}
        </Button>
      </div>
    </>
  )
}
