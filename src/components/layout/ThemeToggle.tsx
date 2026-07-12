'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

const THEMES = [
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
] as const

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className={cn('h-7 w-7 rounded-md', className)} />
  }

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0]
  const Icon = current.icon

  function cycle() {
    const idx = THEMES.findIndex((t) => t.value === theme)
    const next = THEMES[(idx + 1) % THEMES.length]
    setTheme(next.value)
  }

  return (
    <button
      onClick={cycle}
      title={`Theme: ${current.label} (click to cycle)`}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">Toggle theme ({current.label})</span>
    </button>
  )
}
