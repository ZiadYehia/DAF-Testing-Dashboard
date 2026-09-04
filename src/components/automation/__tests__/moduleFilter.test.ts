import { describe, it, expect } from 'vitest'
import {
  NO_MODULE,
  deriveModuleCounts,
  deriveTagCounts,
  deriveStatusCounts,
  moduleMatches,
  tagsMatch,
  toggleIn,
  readStoredList,
  reconcileSelection,
} from '../moduleFilter'

interface Row {
  module: string | null
  tags?: string[]
  lastStatus?: string
}

const rows: Row[] = [
  { module: 'orders', tags: ['smoke', 'create'], lastStatus: 'pass' },
  { module: 'orders', tags: ['create'], lastStatus: 'fail' },
  { module: 'items', tags: ['smoke'], lastStatus: 'pass' },
  { module: null, lastStatus: 'never_run' },
]

const moduleOf = (r: Row) => r.module
const tagsOf = (r: Row) => r.tags
const statusOf = (r: Row) => r.lastStatus ?? 'never_run'

describe('deriveModuleCounts', () => {
  it('tallies each module and the unassigned bucket', () => {
    const { counts, unassigned } = deriveModuleCounts(rows, moduleOf)
    expect(counts.get('orders')).toBe(2)
    expect(counts.get('items')).toBe(1)
    expect(unassigned).toBe(1)
  })

  it('returns empty tallies for no projects', () => {
    const { counts, unassigned } = deriveModuleCounts([], moduleOf)
    expect(counts.size).toBe(0)
    expect(unassigned).toBe(0)
  })

  it('counts everything as unassigned when nothing carries a module', () => {
    const { counts, unassigned } = deriveModuleCounts([{ module: null }, { module: null }], moduleOf)
    expect(counts.size).toBe(0)
    expect(unassigned).toBe(2)
  })
})

describe('deriveTagCounts', () => {
  it('tallies tags alphabetically', () => {
    expect(deriveTagCounts(rows, tagsOf)).toEqual([
      { name: 'create', count: 2 },
      { name: 'smoke', count: 2 },
    ])
  })

  it('ignores projects with no tags', () => {
    expect(deriveTagCounts([{ module: null }], tagsOf)).toEqual([])
  })
})

describe('deriveStatusCounts', () => {
  it('splits pass/fail/never and reports the input size', () => {
    expect(deriveStatusCounts(rows, statusOf)).toEqual({ all: 4, pass: 2, fail: 1, never_run: 1 })
  })

  it('treats any unknown status as never run', () => {
    expect(deriveStatusCounts([{ module: null, lastStatus: 'weird' }], statusOf))
      .toEqual({ all: 1, pass: 0, fail: 0, never_run: 1 })
  })
})

describe('moduleMatches', () => {
  it('passes everything when nothing is selected', () => {
    expect(moduleMatches([], 'orders')).toBe(true)
    expect(moduleMatches([], null)).toBe(true)
  })

  it('matches any of the selected modules', () => {
    expect(moduleMatches(['orders', 'items'], 'items')).toBe(true)
    expect(moduleMatches(['orders'], 'items')).toBe(false)
  })

  it('maps a null module onto the unassigned sentinel', () => {
    expect(moduleMatches([NO_MODULE], null)).toBe(true)
    expect(moduleMatches(['orders'], null)).toBe(false)
  })
})

describe('tagsMatch', () => {
  it('passes everything when nothing is selected', () => {
    expect(tagsMatch([], ['smoke'])).toBe(true)
    expect(tagsMatch([], undefined)).toBe(true)
  })

  it('is any-of, not all-of', () => {
    expect(tagsMatch(['smoke', 'create'], ['create'])).toBe(true)
    expect(tagsMatch(['smoke'], ['create'])).toBe(false)
  })

  it('rejects a project with no tags once a tag is selected', () => {
    expect(tagsMatch(['smoke'], undefined)).toBe(false)
  })
})

describe('toggleIn', () => {
  it('adds a missing key and removes a present one', () => {
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('readStoredList', () => {
  it('reads a JSON array', () => {
    expect(readStoredList('["orders","items"]')).toEqual(['orders', 'items'])
  })

  it('migrates the legacy single-slug format', () => {
    expect(readStoredList('orders')).toEqual(['orders'])
    expect(readStoredList('"orders"')).toEqual(['orders'])
  })

  it('returns empty for absent or unusable values', () => {
    expect(readStoredList(null)).toEqual([])
    expect(readStoredList('')).toEqual([])
    expect(readStoredList('[1,2]')).toEqual([])
  })
})

describe('reconcileSelection', () => {
  it('drops keys that no longer exist', () => {
    expect(reconcileSelection(['orders', 'gone'], new Set(['orders']))).toEqual(['orders'])
  })

  it('returns the same array reference when nothing changed', () => {
    const selected = ['orders']
    expect(reconcileSelection(selected, new Set(['orders', 'items']))).toBe(selected)
  })
})
