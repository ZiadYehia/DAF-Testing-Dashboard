'use client'

import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CredentialRow, type GlobalKeysProps } from '@/components/settings/fields'

const JIRA_KEYS = ['JIRA_BASE_URL', 'JIRA_PROJECT_KEY', 'JIRA_BOARD_ID']

export function CredentialsTab({ globals, loading, onChange, saveKeys }: GlobalKeysProps) {
  const [savingJira, setSavingJira] = useState(false)

  return (
    <>
      {/* AI provider keys live in the dedicated AI & Models tab (with key testing,
          the model registry, and per-app feature gating) — no duplicate here. */}

      {/* Jira Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Jira Integration</CardTitle>
          <CardDescription>
            Shared Jira instance config for this app — where bugs get filed. Each user&apos;s own Jira login lives in &quot;My Jira Account&quot; above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {JIRA_KEYS.map((k) => (
                <div key={k} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <CredentialRow
                label="Base URL"
                description="e.g. https://yourcompany.atlassian.net or https://jira.internal"
                fieldKey="JIRA_BASE_URL"
                value={globals['JIRA_BASE_URL'] ?? ''}
                onChange={onChange}
                type="text"
              />
              <CredentialRow
                label="Project Key"
                description="e.g. QA, PROJ, BUG"
                fieldKey="JIRA_PROJECT_KEY"
                value={globals['JIRA_PROJECT_KEY'] ?? ''}
                onChange={onChange}
                type="text"
              />
              <CredentialRow
                label="Board ID"
                description="Optional — the agile board ID for auto-assigning issues"
                fieldKey="JIRA_BOARD_ID"
                value={globals['JIRA_BOARD_ID'] ?? ''}
                onChange={onChange}
                type="text"
              />
              <div className="pt-1">
                <Button
                  onClick={() => saveKeys(JIRA_KEYS, setSavingJira)}
                  disabled={savingJira}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {savingJira ? 'Saving…' : 'Save Jira Settings'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
