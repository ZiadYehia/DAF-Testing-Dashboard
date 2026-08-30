import { useEffect, useState } from 'react'
import { DEFAULT_CR_FORMAT, type CrFormatConfig } from '@/lib/cr-format'

/**
 * Fetches the app's configurable change-request (CR) format (editable
 * change-type list, story/epic issue-type variants). Falls back to
 * DEFAULT_CR_FORMAT before the request resolves or on failure, so callers can
 * render immediately without special-casing "not loaded yet". Mirrors
 * useBugFormat.ts.
 */
export function useCrFormat(app: string | null | undefined): { config: CrFormatConfig; loading: boolean } {
  const [config, setConfig] = useState<CrFormatConfig>(DEFAULT_CR_FORMAT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!app) {
      setConfig(DEFAULT_CR_FORMAT)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/${app}/cr-format`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load CR format'))))
      .then((data: { config: CrFormatConfig }) => {
        if (!cancelled) setConfig(data.config ?? DEFAULT_CR_FORMAT)
      })
      .catch(() => {
        if (!cancelled) setConfig(DEFAULT_CR_FORMAT)
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
