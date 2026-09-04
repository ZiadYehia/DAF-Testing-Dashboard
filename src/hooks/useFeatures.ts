'use client'

import { useEffect, useState } from 'react'

export interface FeatureIndexEntry {
  name: string
  module: string | null
}

interface CacheEntry {
  promise: Promise<FeatureIndexEntry[]>
  expiresAt: number
}

const TTL_MS = 30_000

// Module-level cache shared across all consumers, keyed by app slug. Holds
// the in-flight/settled promise so two components mounting together (e.g.
// the automation hub and its bug dialog) issue exactly one request. Entries
// expire after TTL_MS so a later mount refetches instead of serving stale
// data forever. A failed fetch is never cached as a success — the entry is
// dropped once the failing promise settles, so the very next mount retries.
const cache = new Map<string, CacheEntry>()

function fetchFeatures(app: string): Promise<FeatureIndexEntry[]> {
  const promise = fetch(`/api/${app}/features`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load features'))))
    .then((data: Array<{ name: string; module?: string | null }>) =>
      Array.isArray(data) ? data.map((f) => ({ name: f.name, module: f.module ?? null })) : []
    )
    .catch((err) => {
      // Don't leave a failed lookup cached — the next mount should retry
      // (e.g. a 403 from missing features.view is expected and shouldn't
      // poison the cache for a differently-permissioned viewer).
      cache.delete(app)
      throw err
    })
  cache.set(app, { promise, expiresAt: Date.now() + TTL_MS })
  return promise
}

function getFeatures(app: string): Promise<FeatureIndexEntry[]> {
  const entry = cache.get(app)
  if (entry && entry.expiresAt > Date.now()) return entry.promise
  return fetchFeatures(app)
}

/**
 * Shared, cached feature index for an app — just the `name` + `module` pair
 * that pickers and module lookups need (see FeatureSummary in
 * src/lib/features.ts for the full shape this deliberately drops).
 * Requests are deduped and cached for 30s across all mounted consumers.
 *
 * A 403 (role has automation.view but not features.view) is expected and
 * normal, not an error to surface — same for network/JSON failures. Both
 * just resolve to an empty list with ok: false.
 */
export function useFeatures(app: string): {
  features: FeatureIndexEntry[]
  ok: boolean
  loading: boolean
} {
  const [features, setFeatures] = useState<FeatureIndexEntry[]>([])
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getFeatures(app)
      .then((list) => {
        if (cancelled) return
        setFeatures(list)
        setOk(true)
      })
      .catch(() => {
        if (cancelled) return
        setFeatures([])
        setOk(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [app])

  return { features, ok, loading }
}
