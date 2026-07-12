import { useEffect, useState } from 'react'
import { DEFAULT_BUG_FORMAT, type BugFormatConfig } from '@/lib/bug-format'

/**
 * Fetches the app's configurable bug format (per-variant field toggles, editable
 * priority/severity option lists, extra Jira labels). Falls back to
 * DEFAULT_BUG_FORMAT before the request resolves or on failure, so callers can
 * render immediately without special-casing "not loaded yet".
 */
export function useBugFormat(app: string | null | undefined): { config: BugFormatConfig; loading: boolean } {
  const [config, setConfig] = useState<BugFormatConfig>(DEFAULT_BUG_FORMAT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!app) {
      setConfig(DEFAULT_BUG_FORMAT)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/${app}/bug-format`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load bug format'))))
      .then((data: { config: BugFormatConfig }) => {
        if (!cancelled) setConfig(data.config ?? DEFAULT_BUG_FORMAT)
      })
      .catch(() => {
        if (!cancelled) setConfig(DEFAULT_BUG_FORMAT)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [app])

  return { config, loading }
}
