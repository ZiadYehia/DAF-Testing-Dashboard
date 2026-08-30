'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowUp, ArrowDown, Plus, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AppSelect } from '@/components/shared/AppSelect'
import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@/lib/board-config'
import { fetchWithRetry } from '@/components/settings/fetchWithRetry'
import { JiraSourceCard } from '@/components/settings/JiraSourceCard'

export function BoardSettingsTab({ app }: { app: string }) {
  // Per-app retest board config
  const [boardConfig, setBoardConfig] = useState<BoardConfig>(DEFAULT_BOARD_CONFIG)
  const [loadingBoardConfig, setLoadingBoardConfig] = useState(true)
  const [savingBoard, setSavingBoard] = useState(false)
  const [jiraStatuses, setJiraStatuses] = useState<string[]>([])
  const [statusesError, setStatusesError] = useState(false)
  const [manualStatusInput, setManualStatusInput] = useState('')

  const loadBoardConfig = useCallback(async () => {
    if (!app) return
    setLoadingBoardConfig(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/board-config`)
      if (!res.ok) throw new Error('Failed to load board settings')
      const data = await res.json()
      setBoardConfig(data.config ?? DEFAULT_BOARD_CONFIG)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load board settings')
    } finally {
      setLoadingBoardConfig(false)
    }
  }, [app])

  const loadJiraStatuses = useCallback(async () => {
    if (!app) return
    try {
      const res = await fetchWithRetry(`/api/${app}/board/statuses`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setJiraStatuses(Array.isArray(data.statuses) ? data.statuses : [])
      setStatusesError(false)
    } catch {
      setStatusesError(true)
    }
  }, [app])

  useEffect(() => {
    loadBoardConfig()
    loadJiraStatuses()
  }, [loadBoardConfig, loadJiraStatuses])

  function toggleColumn(status: string) {
    setBoardConfig((prev) => {
      const has = prev.columns.includes(status)
      const columns = has ? prev.columns.filter((c) => c !== status) : [...prev.columns, status]
      const retestStatus = has && prev.retestStatus === status ? null : prev.retestStatus
      return { ...prev, columns, retestStatus }
    })
  }

  function moveColumn(status: string, dir: -1 | 1) {
    setBoardConfig((prev) => {
      const idx = prev.columns.indexOf(status)
      const newIdx = idx + dir
      if (idx < 0 || newIdx < 0 || newIdx >= prev.columns.length) return prev
      const columns = [...prev.columns]
      ;[columns[idx], columns[newIdx]] = [columns[newIdx], columns[idx]]
      return { ...prev, columns }
    })
  }

  function addManualStatus() {
    const value = manualStatusInput.trim()
    if (!value) return
    setJiraStatuses((prev) => (prev.includes(value) ? prev : [...prev, value]))
    setManualStatusInput('')
  }

  async function saveBoardConfig() {
    setSavingBoard(true)
    try {
      const res = await fetch(`/api/${app}/board-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: boardConfig }),
      })
      if (!res.ok) throw new Error('Failed to save board settings')
      const data = await res.json()
      setBoardConfig(data.config ?? boardConfig)
      toast.success('Board settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingBoard(false)
    }
  }

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Retest Board Columns</CardTitle>
        <CardDescription>
          Choose which Jira statuses appear as columns on the board, in display order,
          and which one represents &ldquo;ready to retest&rdquo;.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loadingBoardConfig ? (
          <div className="space-y-3">
            <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-24 rounded-lg bg-muted/40 animate-pulse" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Columns</label>
              <p className="text-xs text-muted-foreground">
                Shown left to right on the board. Use the arrows to reorder.
              </p>
              {boardConfig.columns.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No columns selected yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {boardConfig.columns.map((status, i) => (
                    <div key={status} className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5">
                      <span className="flex-1 text-sm truncate">{status}</span>
                      <Button
                        type="button" variant="ghost" size="icon" className="h-6 w-6"
                        disabled={i === 0}
                        onClick={() => moveColumn(status, -1)}
                        aria-label={`Move ${status} up`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button" variant="ghost" size="icon" className="h-6 w-6"
                        disabled={i === boardConfig.columns.length - 1}
                        onClick={() => moveColumn(status, 1)}
                        aria-label={`Move ${status} down`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                        onClick={() => toggleColumn(status)}
                        aria-label={`Remove ${status}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5 border-t pt-4">
              <label className="text-sm font-medium">Add a status</label>
              {statusesError && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Couldn&apos;t load statuses from Jira — add them manually below.
                </p>
              )}
              {jiraStatuses.filter((s) => !boardConfig.columns.includes(s)).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {jiraStatuses.filter((s) => !boardConfig.columns.includes(s)).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => toggleColumn(status)}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" /> {status}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Input
                  value={manualStatusInput}
                  onChange={(e) => setManualStatusInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualStatus() } }}
                  placeholder="Type a Jira status name…"
                  className="h-9"
                />
                <Button type="button" variant="outline" onClick={addManualStatus} className="shrink-0">
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 border-t pt-4">
              <label className="text-sm font-medium">Retest status</label>
              <p className="text-xs text-muted-foreground">
                Its column is visually highlighted on the board and drives the &ldquo;Awaiting Retest&rdquo; dashboard count.
              </p>
              <AppSelect
                options={[
                  { value: '__none__', label: 'None' },
                  ...boardConfig.columns.map((c) => ({ value: c, label: c })),
                ]}
                value={boardConfig.retestStatus ?? '__none__'}
                onChange={(v) => setBoardConfig((prev) => ({ ...prev, retestStatus: v === '__none__' ? null : v }))}
                className="w-[240px]"
              />
            </div>

            <div className="border-t pt-4">
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={boardConfig.showDraftColumn}
                  onChange={(e) => setBoardConfig((prev) => ({ ...prev, showDraftColumn: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                Show a &ldquo;Draft — not in Jira&rdquo; column for bugs without a Jira issue
              </label>
            </div>

            <div className="pt-1">
              <Button onClick={saveBoardConfig} disabled={savingBoard} className="gap-2">
                <Save className="h-4 w-4" />
                {savingBoard ? 'Saving…' : 'Save Board Settings'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
    <JiraSourceCard app={app} />
    </div>
  )
}
