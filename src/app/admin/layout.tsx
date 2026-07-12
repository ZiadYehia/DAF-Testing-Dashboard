import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AdminHeader } from './AdminHeader'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login?from=/admin')
  if (session.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
