import { notFound, redirect } from 'next/navigation'
import { getApp } from '@/lib/apps'
import { listModules } from '@/lib/modules'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { requireAppMember } from '@/lib/auth'

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ app: string }>
}) {
  const { app } = await params
  const appConfig = getApp(app)
  // Archived (disabled) apps 404 on direct access — they stay restorable from /admin/apps.
  if (!appConfig || !appConfig.enabled) notFound()

  try {
    await requireAppMember(app)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) redirect(`/login?from=/${app}`)
    notFound()
  }

  const initialModules = listModules(app)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar initialModules={initialModules} />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Mobile spacer for fixed top bar */}
        <div className="md:hidden h-14 shrink-0" />
        <div className="min-h-full p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
