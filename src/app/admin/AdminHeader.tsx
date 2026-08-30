'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Beaker, LogOut, Users, Layers, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin/apps',    label: 'Apps',    icon: Package },
  { href: '/admin/users',   label: 'Users',   icon: Users },
  { href: '/admin/modules', label: 'Modules', icon: Layers },
]

export function AdminHeader() {
  const router = useRouter()
  const pathname = usePathname()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-background">
      <div className="mx-auto max-w-4xl px-4 h-14 flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity"
        >
          <Beaker className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">zTestGround</span>
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm text-muted-foreground">Admin</span>

        <nav className="flex items-center gap-1 ml-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                pathname?.startsWith(href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
