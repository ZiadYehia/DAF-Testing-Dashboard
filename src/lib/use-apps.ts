'use client'

// Client-side access to the app registry. Server code uses lib/apps.ts (fs); the
// browser gets the list from GET /api/apps. A module-level cache + shared in-flight
// promise means many components (sidebar, wizards) trigger at most one fetch.

import { useEffect, useState } from 'react'
import type { AppConfig } from './app-types'

let cache: AppConfig[] | null = null
let inflight: Promise<AppConfig[]> | null = null
const subscribers = new Set<(apps: AppConfig[]) => void>()

async function fetchApps(): Promise<AppConfig[]> {
  const res = await fetch('/api/apps')
  if (!res.ok) throw new Error('Failed to load apps')
  const data = (await res.json()) as AppConfig[]
  return Array.isArray(data) ? data : []
}

function load(): Promise<AppConfig[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetchApps()
      .then((apps) => {
        cache = apps
        inflight = null
        subscribers.forEach((fn) => fn(apps))
        return apps
      })
      .catch((e) => {
        inflight = null
        throw e
      })
  }
  return inflight
}

/** Force a refetch (call after creating/editing/archiving an app). */
export function invalidateApps(): void {
  cache = null
  inflight = null
}

export function useApps(): { apps: AppConfig[]; loading: boolean } {
  const [apps, setApps] = useState<AppConfig[]>(cache ?? [])
  const [loading, setLoading] = useState(cache === null)

  useEffect(() => {
    let active = true
    const onUpdate = (next: AppConfig[]) => {
      if (active) setApps(next)
    }
    subscribers.add(onUpdate)
    load()
      .then((next) => {
        if (active) {
          setApps(next)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      subscribers.delete(onUpdate)
    }
  }, [])

  return { apps, loading }
}

/** The single app matching `slug`, or undefined while loading / if unknown. */
export function useApp(slug: string | undefined): AppConfig | undefined {
  const { apps } = useApps()
  if (!slug) return undefined
  return apps.find((a) => a.slug === slug)
}
