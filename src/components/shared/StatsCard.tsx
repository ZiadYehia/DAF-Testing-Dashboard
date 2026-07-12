import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon?: React.ReactNode
  highlight?: boolean
}

export function StatsCard({ title, value, subtitle, icon, highlight }: StatsCardProps) {
  return (
    <Card
      className={cn(
        'hover-lift transition-all duration-150',
        highlight
          ? 'border-primary/25 bg-primary/5 dark:bg-primary/10'
          : 'bg-card'
      )}
    >
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p
              className={cn(
                'text-2xl font-bold mt-1 tabular-nums',
                highlight ? 'text-primary' : 'text-foreground'
              )}
            >
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                highlight
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted/80 text-muted-foreground'
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
