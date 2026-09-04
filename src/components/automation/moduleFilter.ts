/** Sentinel for the "no module" bucket. Safe as a module-slug stand-in because
 *  real slugs are /^[a-z0-9-]+$/ (slugIsValid, src/lib/modules.ts) — no underscore. */
export const NO_MODULE = '__none__'

export interface ModuleCounts {
  counts: Map<string, number>
  unassigned: number
}

/** Per-module project tallies plus the unassigned bucket. */
export function deriveModuleCounts<T>(
  projects: T[],
  moduleOf: (p: T) => string | null,
): ModuleCounts {
  const counts = new Map<string, number>()
  let unassigned = 0

  for (const project of projects) {
    const mod = moduleOf(project)
    if (mod === null) {
      unassigned += 1
      continue
    }
    counts.set(mod, (counts.get(mod) ?? 0) + 1)
  }

  return { counts, unassigned }
}

/** Tag tallies over a set of projects, alphabetical — feeds the tag popover's counts. */
export function deriveTagCounts<T>(
  projects: T[],
  tagsOf: (p: T) => string[] | undefined,
): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const project of projects) {
    for (const tag of tagsOf(project) ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Status tallies for the state segment. `all` is the input size. */
export function deriveStatusCounts<T>(
  projects: T[],
  statusOf: (p: T) => string,
): { all: number; pass: number; fail: number; never_run: number } {
  const out = { all: projects.length, pass: 0, fail: 0, never_run: 0 }
  for (const project of projects) {
    const status = statusOf(project)
    if (status === 'pass') out.pass += 1
    else if (status === 'fail') out.fail += 1
    else out.never_run += 1
  }
  return out
}

/**
 * Module membership, any-of. An empty selection is NOT a filter (everything
 * passes) — the "All" chip is the empty set, not a magic member.
 */
export function moduleMatches(selected: string[], slug: string | null): boolean {
  if (selected.length === 0) return true
  return selected.includes(slug ?? NO_MODULE)
}

/** Tag membership, any-of. Empty selection passes everything. */
export function tagsMatch(selected: string[], tags: string[] | undefined): boolean {
  if (selected.length === 0) return true
  const own = tags ?? []
  return selected.some((t) => own.includes(t))
}

/** Add/remove one key, preserving order of the rest. */
export function toggleIn(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
}

/**
 * Parse a persisted selection. Tolerates the single-string format written by
 * the earlier single-select filter, so an existing user's stored scope survives
 * the upgrade instead of silently resetting.
 */
export function readStoredList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string')
    if (typeof parsed === 'string' && parsed) return [parsed]
    return []
  } catch {
    // Not JSON — the legacy format stored the slug bare.
    return [raw]
  }
}

/** Drop selected keys that no longer exist in the available set. */
export function reconcileSelection(selected: string[], available: Set<string>): string[] {
  const kept = selected.filter((k) => available.has(k))
  return kept.length === selected.length ? selected : kept
}
