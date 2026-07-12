import { redirect } from 'next/navigation'
import { getEnabledApps } from '@/lib/apps'
import { getSession } from '@/lib/auth'

export default async function Home() {
  const first = getEnabledApps()[0]
  if (first) redirect(`/${first.slug}`)

  // No apps yet (fresh install) — send admins to create one; show a minimal
  // empty state for everyone else instead of redirecting into a 404.
  const session = await getSession()
  if (session?.role === 'admin') redirect('/admin/apps')

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">No apps yet</p>
        <p className="text-sm text-muted-foreground">
          Ask an admin to create one in Admin &rarr; Apps.
        </p>
      </div>
    </div>
  )
}
