'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CredentialRow, type GlobalKeysProps } from '@/components/settings/fields'
import { EnvironmentsCard } from '@/components/settings/EnvironmentsCard'

const AUTOMATION_KEYS = ['AUTOMATION_WEBHOOK_URL', 'AUTOMATION_SCHEDULE_ENABLED', 'AUTOMATION_SCHEDULE_TIME', 'AUTOMATION_SCHEDULE_TAG']

export function AutomationSettingsTab({
  app, globals, loading, onChange, saveKeys,
}: GlobalKeysProps & { app: string }) {
  const [savingAutomation, setSavingAutomation] = useState(false)
  const scheduleEnabled = globals['AUTOMATION_SCHEDULE_ENABLED'] === '1' || globals['AUTOMATION_SCHEDULE_ENABLED'] === 'true'

  return (
    <>
      {/* Environments first: which server everything below runs against is the setting
          people come here looking for, and it was previously reachable only from the
          Automation Hub header. */}
      <EnvironmentsCard app={app} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Scheduled Regression</CardTitle>
          <CardDescription>
            Replays every automation on a daily schedule (server local time) and syncs
            linked test-case statuses. Optionally limit the run to one tag.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => onChange('AUTOMATION_SCHEDULE_ENABLED', e.target.checked ? '1' : '0')}
                  className="h-4 w-4 accent-primary"
                />
                Run the regression automatically every day
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Time (HH:mm)</label>
                  <p className="text-xs text-muted-foreground">Server local time — e.g. 02:00 for a nightly run.</p>
                  <Input
                    value={globals['AUTOMATION_SCHEDULE_TIME'] ?? ''}
                    onChange={(e) => onChange('AUTOMATION_SCHEDULE_TIME', e.target.value)}
                    placeholder="02:00"
                    className="h-9 font-mono"
                    disabled={!scheduleEnabled}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tag filter</label>
                  <p className="text-xs text-muted-foreground">Optional — only run automations with this tag (e.g. smoke).</p>
                  <Input
                    value={globals['AUTOMATION_SCHEDULE_TAG'] ?? ''}
                    onChange={(e) => onChange('AUTOMATION_SCHEDULE_TAG', e.target.value)}
                    placeholder="all automations"
                    className="h-9"
                    disabled={!scheduleEnabled}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Team Notifications</CardTitle>
          <CardDescription>
            Regression summaries (scheduled or API-triggered) are posted here as{' '}
            <code className="text-xs">{'{ text }'}</code> — works with Slack incoming
            webhooks and Teams workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
          ) : (
            <>
              <CredentialRow
                label="Webhook URL"
                description="Leave empty to disable notifications"
                fieldKey="AUTOMATION_WEBHOOK_URL"
                value={globals['AUTOMATION_WEBHOOK_URL'] ?? ''}
                onChange={onChange}
              />
              <div className="pt-1">
                <Button
                  onClick={() => saveKeys(AUTOMATION_KEYS, setSavingAutomation)}
                  disabled={savingAutomation}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {savingAutomation ? 'Saving…' : 'Save Automation Settings'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
