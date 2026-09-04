import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ModuleManifest } from '@/lib/modules'
import { useFeatures } from '@/hooks/useFeatures'

export interface UseProjectModulesResult {
  /** App's module manifests, sorted by `order` ascending. */
  modules: ModuleManifest[]
  /** Resolves a project's module slug from its linked test case's feature; `null` if unlinked or unmapped. */
  moduleOf: (p: { linkedTestcase?: { feature: string } | null }) => string | null
  /** Display name for a module slug — falls back to the slug itself if unknown. */
  moduleName: (slug: string) => string
  /** Lucide icon name for a module slug, or `null` if unknown. */
  moduleIcon: (slug: string) => string | null
  /** `false` while loading, or if either source failed — callers should hide module UI. */
  available: boolean
}

/**
 * Derives which product module an automation project belongs to, from the module
 * of its linked test case's feature. Automations carry no module of their own
 * (see automation-hub/types.ts) — this is a read-only projection over the
 * dashboard's module registry.
 *
 * The lookups are memo-derived rather than ref-backed, so their identity changes
 * exactly once when the data lands: consumers can put them in a `useMemo`
 * dependency array and their filtered lists recompute on arrival.
 *
 * A role with `automation.view` but not `features.view` gets a 403 from the
 * features route — expected, and surfaced as `available: false` rather than an
 * error (see useFeatures).
 */
export function useProjectModules(app: string): UseProjectModulesResult {
  const { features, ok: featuresOk } = useFeatures(app)
  const [modules, setModules] = useState<ModuleManifest[]>([])
  const [modulesOk, setModulesOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    setModules([])
    setModulesOk(false)

    async function load() {
      try {
        const res = await fetch(`/api/${app}/modules`)
        if (cancelled || !res.ok) return
        const data = (await res.json()) as ModuleManifest[]
        if (cancelled) return
        setModules([...data].sort((a, b) => a.order - b.order))
        setModulesOk(true)
      } catch {
        // Network/JSON failure — leave the module UI hidden, nothing to log.
      }
    }

    load()
    return () => { cancelled = true }
  }, [app])

  // feature name -> module slug (null for features with no module assigned)
  const featureModule = useMemo(
    () => new Map(features.map((f) => [f.name, f.module])),
    [features],
  )
  const bySlug = useMemo(() => new Map(modules.map((m) => [m.slug, m])), [modules])

  const moduleOf = useCallback((p: { linkedTestcase?: { feature: string } | null }): string | null => {
    const feature = p.linkedTestcase?.feature
    if (!feature) return null
    return featureModule.get(feature) ?? null
  }, [featureModule])

  const moduleName = useCallback((slug: string) => bySlug.get(slug)?.name ?? slug, [bySlug])
  const moduleIcon = useCallback((slug: string) => bySlug.get(slug)?.icon ?? null, [bySlug])

  return {
    modules,
    moduleOf,
    moduleName,
    moduleIcon,
    available: modulesOk && featuresOk && modules.length > 0,
  }
}
