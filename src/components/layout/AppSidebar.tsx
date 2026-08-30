'use client'

import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useApps } from '@/lib/use-apps'
import { usePermissions } from '@/lib/use-permissions'
import type { PermissionKey } from '@/lib/permissions'
import {
  LayoutDashboard,
  FlaskConical,
  Bug,
  Columns3,
  FileText,
  ChevronDown,
  Beaker,
  BookOpen,
  Network,
  Menu,
  Settings,
  LogOut,
  Users,
  Layers,
  Shield,
  BarChart2,
  Lock,
  Package,
  Scale,
  Bot,
  GitPullRequestArrow,
  UserCog,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ModuleManifest } from '@/lib/modules'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  /** Permission key gating this link's *.view section. Omit for ungated items (e.g. admin). */
  permKey?: PermissionKey
}

interface SessionUser { id: number; email: string; name: string; role: string }

interface AppSidebarProps {
  /** Pre-fetched module list from the server layout — eliminates the loading flash. */
  initialModules?: ModuleManifest[]
}

const MIN_SIDEBAR_WIDTH = 52
const MAX_SIDEBAR_WIDTH = 400
const COLLAPSE_THRESHOLD = 100
const DEFAULT_SIDEBAR_WIDTH = 240

function getModuleIcon(iconName: string, size = 'h-3.5 w-3.5'): React.ReactNode {
  const cls = size
  switch (iconName) {
    case 'Shield':    return <Shield className={cls} />
    case 'Layers':    return <Layers className={cls} />
    case 'BarChart2': return <BarChart2 className={cls} />
    case 'Lock':      return <Lock className={cls} />
    case 'Package':   return <Package className={cls} />
    case 'Scale':     return <Scale className={cls} />
    default:          return <Layers className={cls} />
  }
}

function getModuleNavItems(appSlug: string, moduleSlug: string, pathPrefix: string): NavItem[] {
  const base = pathPrefix ? `/${appSlug}/${pathPrefix}` : `/${appSlug}`
  const knowledgeHref = pathPrefix ? `${base}/knowledge` : `/${appSlug}/m/${moduleSlug}/knowledge`
  return [
    { label: 'Features & Test Cases', href: `${base}/features`,    icon: <FlaskConical className="h-4 w-4" />, permKey: 'features.view' },
    { label: 'Bug Reports',           href: `${base}/bugs`,         icon: <Bug className="h-4 w-4" />,          permKey: 'bugs.view' },
    { label: 'Change Requests',       href: `${base}/change-requests`, icon: <GitPullRequestArrow className="h-4 w-4" />, permKey: 'changerequests.view' },
    { label: 'Board',                 href: `${base}/board`,        icon: <Columns3 className="h-4 w-4" />,     permKey: 'bugs.view' },
    { label: 'Requirements',          href: `${base}/requirements`, icon: <FileText className="h-4 w-4" />,     permKey: 'requirements.view' },
    { label: 'Knowledge Base',        href: knowledgeHref,          icon: <BookOpen className="h-4 w-4" />,     permKey: 'knowledge.view' },
  ]
}

/** While loading, hide every gated item (avoids a flash of links that then disappear). */
function filterByPermission(items: NavItem[], can: (key: PermissionKey) => boolean, loading: boolean): NavItem[] {
  if (loading) return items.filter((it) => !it.permKey)
  return items.filter((it) => !it.permKey || can(it.permKey))
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 42%)`
}

// border-l-2 is always present (transparent when inactive) so padding never shifts on state change
const navBase = 'flex items-center gap-3 rounded-md border-l-2 py-2 pl-3 pr-3 text-sm font-medium transition-colors'
const navActive = 'border-primary bg-primary/10 text-primary'
const navInactive = 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'

const navChildBase = 'flex items-center gap-3 rounded-md border-l-2 py-2 pl-5 pr-3 text-sm font-medium transition-colors'
const navChildActive = 'border-primary bg-primary/10 text-primary'
const navChildInactive = 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'

/** Icon-only nav link with a right-side tooltip — used in the collapsed sidebar. */
function ColIconLink({ href, label, children, active }: {
  href: string
  label: string
  children: React.ReactNode
  active: boolean
}) {
  const cls = cn(
    'flex items-center justify-center rounded-md p-2 transition-colors',
    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  )
  return (
    <Tooltip>
      {/* base-ui uses render prop for polymorphic rendering */}
      <TooltipTrigger render={<Link href={href} className={cls} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function AppSidebar({ initialModules }: AppSidebarProps = {}) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { apps } = useApps()
  // Outside an /[app] route, fall back to the first registered app.
  const appSlug = (params?.app as string) ?? apps[0]?.slug ?? ''
  const { can, loading: permsLoading } = usePermissions(appSlug)
  const currentApp = apps.find((a) => a.slug === appSlug)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [modules, setModules] = useState<ModuleManifest[] | null>(initialModules ?? null)
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())
  const [logos, setLogos] = useState<Record<string, string>>({})
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const isCollapsed = sidebarWidth < COLLAPSE_THRESHOLD

  const isResizingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) setSessionUser(d.user) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/logo')
      .then(r => r.ok ? r.json() : {})
      .then(setLogos)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!appSlug) return
    fetch(`/api/${appSlug}/modules`)
      .then(r => r.ok ? r.json() : [])
      .then((data: ModuleManifest[]) => setModules(Array.isArray(data) ? data : []))
      .catch(() => setModules([]))
  }, [appSlug])

  // Load persisted accordion state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sidebar-open-${appSlug}`)
      if (saved) {
        setOpenModules(new Set(JSON.parse(saved)))
        return
      }
    } catch {}
    setOpenModules(new Set())
  }, [appSlug])

  // Load persisted sidebar width
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-width')
      if (saved) {
        const w = Number(saved)
        if (w >= MIN_SIDEBAR_WIDTH && w <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(w)
          startWidthRef.current = w
        }
      }
    } catch {}
  }, [])

  // Global mouse handlers for the resize drag
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizingRef.current) return
      const delta = e.clientX - startXRef.current
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidthRef.current + delta))
      setSidebarWidth(newWidth)
    }
    function onMouseUp(e: MouseEvent) {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      const delta = e.clientX - startXRef.current
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidthRef.current + delta))
      try { localStorage.setItem('sidebar-width', String(newWidth)) } catch {}
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleResizeMouseDown(e: React.MouseEvent) {
    isResizingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  // Grouped (collapsible per-module) nav whenever the app has any module —
  // keeps the collapse/expand UI even with a single module.
  const hasMultipleModules = modules !== null && modules.length >= 1

  function getActiveModuleSlug(): string | null {
    if (!modules || modules.length === 0) return null
    const sorted = [...modules].sort((a, b) => (b.pathPrefix ?? '').length - (a.pathPrefix ?? '').length)
    for (const m of sorted) {
      if (m.pathPrefix && pathname?.startsWith(`/${appSlug}/${m.pathPrefix}`)) return m.slug
    }
    return modules.find(m => !m.pathPrefix)?.slug ?? null
  }

  const activeModuleSlug = getActiveModuleSlug()

  // Auto-expand the active module when navigating
  useEffect(() => {
    if (!activeModuleSlug) return
    setOpenModules(prev => {
      if (prev.has(activeModuleSlug)) return prev
      const next = new Set(prev)
      next.add(activeModuleSlug)
      try { localStorage.setItem(`sidebar-open-${appSlug}`, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [activeModuleSlug, appSlug])

  function toggleModule(slug: string) {
    setOpenModules(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      try { localStorage.setItem(`sidebar-open-${appSlug}`, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function isActive(href: string, scopeItems?: NavItem[]): boolean {
    if (href === `/${appSlug}`) return pathname === href
    if (pathname === href) return true
    if (!pathname?.startsWith(`${href}/`)) return false
    const items = scopeItems ?? []
    return !items.some(
      (it) =>
        it.href !== href &&
        it.href.startsWith(`${href}/`) &&
        (pathname === it.href || pathname.startsWith(`${it.href}/`))
    )
  }

  const adminNavItems: NavItem[] = sessionUser?.role === 'admin'
    ? [
        { label: 'Manage Apps', href: '/admin/apps', icon: <Layers className="h-4 w-4" /> },
        { label: 'User Management', href: '/admin/users', icon: <Users className="h-4 w-4" /> },
        { label: 'Roles & Permissions', href: '/admin/roles', icon: <Shield className="h-4 w-4" /> },
      ]
    : []

  const flatNavItems: NavItem[] = filterByPermission([
    { label: 'Dashboard',            href: `/${appSlug}`,                    icon: <LayoutDashboard className="h-4 w-4" />, permKey: 'dashboard.view' },
    { label: 'Features & Test Cases', href: `/${appSlug}/features`,           icon: <FlaskConical className="h-4 w-4" />,    permKey: 'features.view' },
    { label: 'Bug Reports',           href: `/${appSlug}/bugs`,               icon: <Bug className="h-4 w-4" />,             permKey: 'bugs.view' },
    { label: 'Change Requests',       href: `/${appSlug}/change-requests`,    icon: <GitPullRequestArrow className="h-4 w-4" />, permKey: 'changerequests.view' },
    { label: 'Board',                 href: `/${appSlug}/board`,              icon: <Columns3 className="h-4 w-4" />,        permKey: 'bugs.view' },
    { label: 'Requirements',          href: `/${appSlug}/requirements`,       icon: <FileText className="h-4 w-4" />,        permKey: 'requirements.view' },
    { label: 'Knowledge Base',        href: `/${appSlug}/knowledge`,          icon: <BookOpen className="h-4 w-4" />,        permKey: 'knowledge.view' },
    ...(currentApp?.capabilities.moduleKnowledge
      ? [{ label: 'Module Knowledge', href: `/${appSlug}/knowledge/stories`, icon: <Network className="h-4 w-4" />, permKey: 'knowledge.view' as PermissionKey }]
      : []),
    { label: 'Automation Hub',        href: `/${appSlug}/automation`,         icon: <Bot className="h-4 w-4" />,             permKey: 'automation.view' },
    { label: 'Settings',              href: `/${appSlug}/settings`,           icon: <Settings className="h-4 w-4" />,        permKey: 'settings.view' },
  ], can, permsLoading)

  // Shared dropdown content (used in both expanded and collapsed)
  const appSwitcherItems = (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Switch App</DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      {apps.map((app) => {
        const appLogo = logos[`app_${app.slug}`]
        return (
          <DropdownMenuItem key={app.slug}
            onClick={() => { window.location.href = `/${app.slug}` }}>
            {appLogo
              ? <img src={appLogo} alt="" className="h-4 w-4 object-contain rounded" />
              : <span>{app.icon}</span>}
            <span className="flex-1">{app.name}</span>
            {app.slug === appSlug && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        )
      })}
    </>
  )

  const userDropdownItems = sessionUser && (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="font-normal py-1.5">
          <p className="text-xs font-medium">{sessionUser.name}</p>
          <p className="text-xs text-muted-foreground truncate">{sessionUser.email}</p>
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => { window.location.href = '/account' }}
        className="cursor-pointer"
      >
        <UserCog className="h-4 w-4 mr-2" />
        My Account
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={logout}
        className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sign out
      </DropdownMenuItem>
    </>
  )

  // ── Expanded sidebar (mobile + desktop when width >= COLLAPSE_THRESHOLD) ──
  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2 border-b px-4 py-4">
        {logos.dashboard
          ? <img src={logos.dashboard} alt="" className="h-5 w-5 object-contain rounded shrink-0" />
          : <Beaker className="h-5 w-5 text-primary shrink-0" />
        }
        <span className="font-semibold text-sm leading-tight">zTestGround</span>
      </div>

      {/* App Switcher */}
      <div className="border-b px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none">
            <span className="flex items-center gap-2">
              {logos[`app_${appSlug}`]
                ? <img src={logos[`app_${appSlug}`]} alt="" className="h-4 w-4 object-contain rounded" />
                : <span>{currentApp?.icon}</span>}
              <span>{currentApp?.name ?? appSlug}</span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {appSwitcherItems}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {hasMultipleModules ? (
          <>
            {!permsLoading && can('dashboard.view') && (
              <Link href={`/${appSlug}`} className={cn(navBase, pathname === `/${appSlug}` ? navActive : navInactive)}>
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            )}

            {!permsLoading && can('knowledge.view') && (
              <Link href={`/${appSlug}/knowledge`} className={cn(navBase, pathname === `/${appSlug}/knowledge` ? navActive : navInactive)}>
                <BookOpen className="h-4 w-4" />
                App Knowledge
              </Link>
            )}

            {(modules ?? []).map((mod) => {
              const items = filterByPermission(getModuleNavItems(appSlug, mod.slug, mod.pathPrefix), can, permsLoading)
              if (items.length === 0) return null
              const isActiveModule = activeModuleSlug === mod.slug
              const isOpen = openModules.has(mod.slug)
              const moduleLogo = logos[`module_${appSlug}_${mod.slug}`]

              return (
                <div key={mod.slug} className="pt-2">
                  {/* Entire header row (icon + name + chevron) toggles the accordion */}
                  <button
                    onClick={() => toggleModule(mod.slug)}
                    className={cn(
                      'flex items-center justify-between w-full px-2 py-1 rounded-md transition-colors',
                      isActiveModule
                        ? 'text-primary hover:bg-primary/5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    )}
                    aria-label={isOpen ? `Collapse ${mod.name}` : `Expand ${mod.name}`}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider flex-1 min-w-0">
                      {moduleLogo
                        ? <img src={moduleLogo} alt="" className="h-3.5 w-3.5 object-contain rounded shrink-0" />
                        : getModuleIcon(mod.icon)
                      }
                      <span className="truncate">{mod.name}</span>
                    </span>
                    <ChevronDown className={cn('h-3 w-3 transition-transform duration-200 shrink-0 ml-1', isOpen ? 'rotate-0' : '-rotate-90')} />
                  </button>

                  {isOpen && (
                    <div className="mt-1 space-y-0.5">
                      {items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(navChildBase, isActive(item.href, items) ? navChildActive : navChildInactive)}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {currentApp?.capabilities.moduleKnowledge && !permsLoading && can('knowledge.view') && (
              <div className="pt-2">
                <Link
                  href={`/${appSlug}/knowledge/stories`}
                  className={cn(navBase, pathname === `/${appSlug}/knowledge/stories` ? navActive : navInactive)}
                >
                  <Network className="h-4 w-4" />
                  Module Knowledge
                </Link>
              </div>
            )}

            {!permsLoading && can('automation.view') && (
              <div className="pt-2">
                <Link
                  href={`/${appSlug}/automation`}
                  className={cn(navBase, pathname?.startsWith(`/${appSlug}/automation`) ? navActive : navInactive)}
                >
                  <Bot className="h-4 w-4" />
                  Automation Hub
                </Link>
              </div>
            )}

            {!permsLoading && can('settings.view') && (
              <div className="pt-2">
                <Link
                  href={`/${appSlug}/settings`}
                  className={cn(navBase, pathname === `/${appSlug}/settings` ? navActive : navInactive)}
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </div>
            )}
          </>
        ) : (
          flatNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(navBase, isActive(item.href) ? navActive : navInactive)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))
        )}

        {adminNavItems.length > 0 && (
          <>
            <div className="my-2 border-t border-border/60" />
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(navBase, pathname?.startsWith(item.href) ? navActive : navInactive)}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t px-3 py-3 space-y-2">
        {sessionUser && (
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent transition-colors text-left focus:outline-none">
              <span
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 select-none"
                style={{ backgroundColor: getAvatarColor(sessionUser.email) }}
              >
                {getInitials(sessionUser.name)}
              </span>
              <span className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate leading-tight">{sessionUser.name}</p>
                <p className="text-xs text-muted-foreground truncate leading-tight">{sessionUser.email}</p>
              </span>
              <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-52 mb-1">
              {userDropdownItems}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground truncate">
            {currentApp?.platform} · {currentApp?.type}
          </p>
          <ThemeToggle />
        </div>
      </div>
    </>
  )

  // ── Collapsed sidebar (desktop icons-only when width < COLLAPSE_THRESHOLD) ─
  const collapsedSidebarContent = (
    <>
      {/* Brand */}
      <div className="flex items-center justify-center border-b py-[18px]">
        {logos.dashboard
          ? <img src={logos.dashboard} alt="" className="h-5 w-5 object-contain rounded" />
          : <Beaker className="h-5 w-5 text-primary" />
        }
      </div>

      {/* App Switcher — icon only */}
      <div className="border-b py-3 flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-md p-2 hover:bg-accent transition-colors focus:outline-none"
            title={currentApp?.name ?? appSlug}
          >
            {logos[`app_${appSlug}`]
              ? <img src={logos[`app_${appSlug}`]} alt="" className="h-5 w-5 object-contain rounded" />
              : <span className="text-base leading-none">{currentApp?.icon}</span>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {appSwitcherItems}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation — icons only */}
      <nav className="flex-1 overflow-y-auto py-4 flex flex-col items-center gap-1">
        {hasMultipleModules ? (
          <>
            {!permsLoading && can('dashboard.view') && (
              <ColIconLink href={`/${appSlug}`} label="Dashboard" active={pathname === `/${appSlug}`}>
                <LayoutDashboard className="h-4 w-4" />
              </ColIconLink>
            )}

            {!permsLoading && can('knowledge.view') && (
              <ColIconLink href={`/${appSlug}/knowledge`} label="App Knowledge" active={pathname === `/${appSlug}/knowledge`}>
                <BookOpen className="h-4 w-4" />
              </ColIconLink>
            )}

            {(modules ?? []).map((mod) => {
              const items = filterByPermission(getModuleNavItems(appSlug, mod.slug, mod.pathPrefix), can, permsLoading)
              if (items.length === 0) return null
              const moduleLogo = logos[`module_${appSlug}_${mod.slug}`]
              const isActiveModule = activeModuleSlug === mod.slug
              return (
                <ColIconLink key={mod.slug} href={items[0]?.href ?? `/${appSlug}`} label={mod.name} active={isActiveModule}>
                  {moduleLogo
                    ? <img src={moduleLogo} alt="" className="h-4 w-4 object-contain rounded" />
                    : getModuleIcon(mod.icon, 'h-4 w-4')
                  }
                </ColIconLink>
              )
            })}

            {currentApp?.capabilities.moduleKnowledge && !permsLoading && can('knowledge.view') && (
              <ColIconLink href={`/${appSlug}/knowledge/stories`} label="Module Knowledge" active={pathname === `/${appSlug}/knowledge/stories`}>
                <Network className="h-4 w-4" />
              </ColIconLink>
            )}

            {!permsLoading && can('automation.view') && (
              <ColIconLink href={`/${appSlug}/automation`} label="Automation Hub" active={!!pathname?.startsWith(`/${appSlug}/automation`)}>
                <Bot className="h-4 w-4" />
              </ColIconLink>
            )}

            {!permsLoading && can('settings.view') && (
              <ColIconLink href={`/${appSlug}/settings`} label="Settings" active={pathname === `/${appSlug}/settings`}>
                <Settings className="h-4 w-4" />
              </ColIconLink>
            )}
          </>
        ) : (
          flatNavItems.map((item) => (
            <ColIconLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)}>
              {item.icon}
            </ColIconLink>
          ))
        )}

        {adminNavItems.length > 0 && (
          <>
            <div className="w-6 border-t border-border/60 my-1" />
            {adminNavItems.map((item) => (
              <ColIconLink key={item.href} href={item.href} label={item.label} active={!!pathname?.startsWith(item.href)}>
                {item.icon}
              </ColIconLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer — avatar + theme toggle */}
      <div className="border-t py-3 flex flex-col items-center gap-2">
        {sessionUser && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded-full focus:outline-none"
              title={sessionUser.name}
            >
              <span
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white select-none"
                style={{ backgroundColor: getAvatarColor(sessionUser.email) }}
              >
                {getInitials(sessionUser.name)}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-52 mb-1">
              {userDropdownItems}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ThemeToggle />
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar — fixed, only visible below md */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className="rounded-md p-2 hover:bg-accent transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-60 gap-0 p-0" showCloseButton={false}>
            {sidebarContent}
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          {logos.dashboard
            ? <img src={logos.dashboard} alt="" className="h-5 w-5 object-contain rounded shrink-0" />
            : <Beaker className="h-5 w-5 text-primary" />
          }
          <span className="font-semibold text-sm">zTestGround</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {sessionUser && (
            <button
              onClick={logout}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop sidebar — only visible at md+ */}
      <aside
        className="hidden md:flex h-screen flex-col border-r bg-background relative shrink-0 overflow-hidden"
        style={{ width: sidebarWidth }}
      >
        {isCollapsed ? collapsedSidebarContent : sidebarContent}

        {/* Resize drag handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize z-20"
          aria-hidden
        />
      </aside>
    </>
  )
}
