'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { useEnvironmentManager } from '@/components/environments/useEnvironmentManager'
import { EnvironmentList } from '@/components/environments/EnvironmentList'
import { EnvironmentFormDialog } from '@/components/environments/EnvironmentFormDialog'

/**
 * Manage this app's run targets from Settings.
 *
 * The Automation Hub header has a compact switcher, but that is the only place environments
 * were reachable — so an app whose Hub you had not opened looked as though it had none, and
 * there was nowhere to create the first one outside the Hub. Both surfaces share
 * components/environments/* so they cannot disagree about what a row looks like or what
 * activating and saving do.
 *
 * Environments are per app. That is deliberate: an app's environment carries ITS base URLs and
 * credentials, and the dashboard app and the API app of the same product target different
 * services with different keys. An environment created for one app is therefore not visible in
 * another — create one per app that needs it.
 */
export function EnvironmentsCard({ app }: { app: string }) {
  const mgr = useEnvironmentManager(app)

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Environments</CardTitle>
          <CardDescription>
            Which server this app&apos;s automation runs against. The active environment&apos;s
            variables are applied to every run and override <code>automation-hub/.env</code>;
            anything it does not define still falls back to that file. Run history and execution
            status are recorded per environment, so results from one server never overwrite
            another&apos;s.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <EnvironmentList
            envs={mgr.envs}
            busy={mgr.busy}
            onActivate={mgr.activate}
            onEdit={mgr.startEdit}
            onDelete={mgr.remove}
          />
          <Button variant="secondary" className="gap-1" onClick={mgr.startNew}>
            <Plus className="h-4 w-4" /> New environment
          </Button>
        </CardContent>
      </Card>

      <EnvironmentFormDialog mgr={mgr} />
    </>
  )
}
