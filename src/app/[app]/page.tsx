import { getApp } from '@/lib/apps'
import { getAppStats, listFeatures, getRequirements } from '@/lib/features'
import { getBugStats, listBugs } from '@/lib/bugs'
import { listModules } from '@/lib/modules'
import type { ModuleManifest } from '@/lib/modules'
import { getBoardConfig } from '@/lib/board-config-server'
import { StatsCard } from '@/components/shared/StatsCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { formatDate, titleCase } from '@/lib/utils'
import {
  FlaskConical,
  Bug,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Layers,
  Shield,
  BarChart2,
  Lock,
  Package,
  Scale,
  ListChecks,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { notFound } from 'next/navigation'

function moduleIcon(iconName: string) {
  const cls = 'h-4 w-4 text-muted-foreground'
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

// Features always carry a module slug tag; bugs/requirements from the root module were
// created before module tags existed and sit in the DB with module = NULL (legacy).
function modFilterFeatures(m: ModuleManifest): string { return m.slug }
function modFilterLegacy(m: ModuleManifest): string | null {
  return m.pathPrefix === '' ? null : m.slug
}

export default async function AppDashboard({ params }: { params: Promise<{ app: string }> }) {
  const { app } = await params
  const appConfig = await getApp(app)
  if (!appConfig) notFound()

  const modules = await listModules(app)
  const hasModules = modules.length >= 2

  const [featureStats, bugStats, allFeatures, allBugs, reqContent, boardConfig] = await Promise.all([
    getAppStats(app),
    getBugStats(app),
    listFeatures(app),
    listBugs(app),
    getRequirements(app),
    getBoardConfig(app),
  ])

  const retestCount = boardConfig.retestStatus
    ? allBugs.filter(
        (b) => (b as typeof b & { jira_status?: string | null }).jira_status?.toLowerCase() === boardConfig.retestStatus!.toLowerCase()
      ).length
    : 0

  const moduleStatsData = hasModules
    ? await Promise.all(
        modules.map(async (m) => {
          const [features, bugs, req] = await Promise.all([
            listFeatures(app, modFilterFeatures(m)),
            listBugs(app, modFilterLegacy(m)),
            getRequirements(app, modFilterLegacy(m)),
          ])
          return { module: m, features, bugs, reqContent: req }
        })
      )
    : []

  function countReqRows(content: string) {
    const lines = content.split('\n').filter((l) => l.trim().startsWith('|'))
    return Math.max(0, lines.length - 2)
  }

  // Feature detail links must carry the owning module's pathPrefix so the
  // sidebar highlights the right module and back-nav stays in it.
  const prefixByModule = new Map(modules.map((m) => [m.slug, m.pathPrefix]))
  function featureHref(f: { name: string; module?: string | null }): string {
    const prefix = f.module ? prefixByModule.get(f.module) ?? '' : ''
    return `/${app}${prefix ? `/${prefix}` : ''}/features/${f.name}`
  }

  const recentFeatures = allFeatures
    .sort((a, b) => {
      if (!a.lastModified) return 1
      if (!b.lastModified) return -1
      return b.lastModified.localeCompare(a.lastModified)
    })
    .slice(0, 5)
  const recentBugs = allBugs
    .filter((b) => b.status === 'draft')
    .slice(0, 5)

  // Count requirements
  const reqLines = reqContent.split('\n').filter((l) => l.trim().startsWith('|'))
  const totalRequirements = Math.max(0, reqLines.length - 2)

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
          {appConfig.icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{appConfig.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{appConfig.description}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatsCard
          title="Features"
          value={featureStats.totalFeatures}
          icon={<FlaskConical className="h-4 w-4" />}
        />
        <StatsCard
          title="Test Cases"
          value={featureStats.totalTestcases}
          highlight
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatsCard
          title="With Test Cases"
          value={featureStats.featuresWithTestcases}
          subtitle={`of ${featureStats.totalFeatures} features`}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatsCard
          title="Screenshots"
          value={featureStats.totalScreenshots}
          icon={<ImageIcon className="h-4 w-4" />}
        />
        <StatsCard
          title="Bug Reports"
          value={bugStats.total}
          icon={<Bug className="h-4 w-4" />}
        />
        <StatsCard
          title="Open Bugs"
          value={bugStats.draft}
          subtitle={`${bugStats.reported} reported`}
          highlight={bugStats.draft > 0}
          icon={<AlertCircle className="h-4 w-4" />}
        />
        <Link href={`/${app}/board`} className="block">
          <StatsCard
            title="Awaiting Retest"
            value={boardConfig.retestStatus ? retestCount : '—'}
            subtitle={boardConfig.retestStatus ? undefined : 'Board not configured'}
            highlight={retestCount > 0}
            icon={<ListChecks className="h-4 w-4" />}
          />
        </Link>
      </div>

      {/* Module breakdown — data-driven from data/{app}/modules/ */}
      {hasModules && (
        <div className="grid gap-4 sm:grid-cols-2">
          {moduleStatsData.map(({ module: m, features, bugs, reqContent: req }) => {
            const featuresHref = m.pathPrefix ? `/${app}/${m.pathPrefix}/features` : `/${app}/features`
            return (
              <Card key={m.slug}>
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    {moduleIcon(m.icon)}
                    {m.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <FlaskConical className="h-3.5 w-3.5" />
                      <span className="font-semibold text-foreground">{features.length}</span> feature{features.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Bug className="h-3.5 w-3.5" />
                      <span className="font-semibold text-foreground">{bugs.length}</span> bug{bugs.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      <span className="font-semibold text-foreground">{countReqRows(req)}</span> req
                    </span>
                  </div>
                  <Link
                    href={featuresHref}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    View {m.name} Features →
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Two-column recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Features */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-semibold">Recent Features</CardTitle>
            <Link
              href={`/${app}/features`}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent className="pt-3 space-y-1">
            {recentFeatures.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No features yet.{' '}
                <Link href={`/${app}/features/new`} className="text-primary hover:underline">
                  Create one
                </Link>
              </p>
            ) : (
              recentFeatures.map((f) => (
                <Link
                  key={f.name}
                  href={featureHref(f)}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-accent/60 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FlaskConical className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium truncate">{titleCase(f.name)}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {f.hasTestcases && (
                      <Badge variant="secondary" className="text-xs">
                        {f.testcaseCount} cases
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatDate(f.lastModified)}</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Bugs (open/draft) */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-semibold">Open Bug Reports</CardTitle>
            <Link href={`/${app}/bugs`} className="text-xs text-primary hover:text-primary/80 transition-colors">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="pt-3 space-y-1">
            {recentBugs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No open bugs. 🎉
              </p>
            ) : (
              recentBugs.map((b) => (
                <Link
                  key={`${b.feature}/${b.slug}`}
                  href={`/${app}/bugs/${b.feature}/${b.slug}`}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-accent/60 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Bug className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium truncate">{b.title}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <PriorityBadge priority={b.priority} />
                    <StatusBadge status={b.status} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 flex flex-wrap gap-2">
          <Link
            href={`/${app}/features/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85 transition-colors"
          >
            <FlaskConical className="h-4 w-4" />
            New Feature
          </Link>
          <Link
            href={`/${app}/bugs`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Bug className="h-4 w-4" />
            View Bugs
          </Link>
          <Link
            href={`/${app}/requirements`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <FileText className="h-4 w-4" />
            Requirements ({totalRequirements})
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
