'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { IntakeGroupForm } from '@/components/shared/IntakeGroupForm'
import { ReadinessBadge } from '@/components/shared/ReadinessBadge'
import { appIntakeGroupsFor, type IntakeValue } from '@/lib/intake-types'
import { useApp } from '@/lib/use-apps'
import { fetchWithRetry } from '@/components/settings/fetchWithRetry'

export function ProfileSettingsTab({ app }: { app: string }) {
  // Type-aware: an API app is not asked for browser login steps (see appIntakeGroupsFor).
  const appConfig = useApp(app)
  const intakeGroups = appIntakeGroupsFor(appConfig?.type)
  // App Profile (intake) tab
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, Record<string, IntakeValue>>>({})
  const [loadingIntake, setLoadingIntake] = useState(true)

  const loadIntake = useCallback(async () => {
    if (!app) return
    setLoadingIntake(true)
    try {
      const res = await fetchWithRetry(`/api/${app}/intake?scope=app`)
      if (!res.ok) throw new Error('Failed to load app profile')
      const data = await res.json()
      setIntakeAnswers(data.answers ?? {})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load app profile')
    } finally {
      setLoadingIntake(false)
    }
  }, [app])

  useEffect(() => {
    loadIntake()
  }, [loadIntake])

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground max-w-2xl">
          The knowledge and formatting rules the AI reads for this app. Re-editing a section
          regenerates its compiled document immediately.
        </p>
        <ReadinessBadge app={app} />
      </div>
      {loadingIntake ? (
        <div className="space-y-3">
          {intakeGroups.map((g) => (
            <div key={g.id} className="h-24 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        intakeGroups.map((group) => (
          <Card key={group.id}>
            <CardContent className="pt-5">
              <IntakeGroupForm
                app={app}
                scope="app"
                group={group}
                initialAnswers={intakeAnswers[group.id]}
                onSaved={(answers) => setIntakeAnswers((prev) => ({ ...prev, [group.id]: answers }))}
              />
            </CardContent>
          </Card>
        ))
      )}
    </>
  )
}
