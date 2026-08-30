'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DEFAULT_JIRA_SOURCE, type JiraSourceConfig, type JiraSourceMode } from '@/lib/jira-source'
import { fetchWithRetry } from '@/components/settings/fetchWithRetry'

const MODE_OPTIONS: { value: JiraSourceMode; label: string }[] = [
  { value: 'global', label: 'Global default' },
  { value: 'board', label: 'Board ID' },
  { value: 'project', label: 'Project key' },
]

/**
 * Per-app Jira source config — lets an app fetch stories from a specific Jira
 * board or project instead of the shared global default. Apps that sit on the
 * same Jira project (e.g. GRC and DT both under project "DT") can scope by
 * board id to keep their story lists separate.
 */
export function JiraSourceCard({ app }: { app: string }) {
  const [config, setConfig] = useState<JiraSourceConfig>(DEFAULT_JIRA_SOURCE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!app) return
    setLoading(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/jira-source`)
      if (!res.ok) throw new Error('Failed to load Jira source settings')
      const data = await res.json()
      setConfig(data.config ?? DEFAULT_JIRA_SOURCE)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load Jira source settings')
    } finally {
      setLoading(false)
    }
  }, [app])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/${app}/jira-source`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) throw new Error('Failed to save Jira source settings')
      const data = await res.json()
      setConfig(data.config ?? config)
      toast.success('Jira source saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function setMode(mode: JiraSourceMode) {
    setConfig((prev) => ({ ...prev, mode }))
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Jira Source</CardTitle>
        <CardDescription>
          Apps can share one Jira project — scope by board ID to separate them (e.g. board 300 vs 102).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-9 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-9 rounded-lg bg-muted/40 animate-pulse" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Source</label>
              <div className="inline-flex flex-wrap gap-1.5">
                {MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMode(opt.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      config.mode === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted hover:bg-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {config.mode === 'board' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Board ID</label>
                <Input
                  value={config.boardId ?? ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, boardId: e.target.value }))}
                  placeholder="e.g. 300"
                  className="h-9 max-w-xs"
                />
              </div>
            )}

            {config.mode === 'project' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Project Key</label>
                <Input
                  value={config.projectKey ?? ''}
                  onChange={(e) => setConfig((prev) => ({ ...prev, projectKey: e.target.value }))}
                  placeholder="e.g. DT"
                  className="h-9 max-w-xs"
                />
              </div>
            )}

            <div className="pt-1">
              <Button onClick={save} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save Jira Source'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
