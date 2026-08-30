import { notFound } from 'next/navigation'
import { getApp } from '@/lib/apps'
import { AutomationHub } from '@/components/automation/AutomationHub'

/**
 * Automation Hub tab — thin shell. All engine/storage/UI logic lives outside this
 * file (the /automation-hub folder + the AutomationHub client component) so the
 * hub can be iterated on independently of the rest of the dashboard.
 */
export default async function AutomationPage({
  params,
}: {
  params: Promise<{ app: string }>
}) {
  const { app } = await params
  if (!(await getApp(app))) notFound()
  return <AutomationHub app={app} />
}
