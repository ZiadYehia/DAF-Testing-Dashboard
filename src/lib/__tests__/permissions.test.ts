import { describe, it, expect } from 'vitest'
import {
  resolvePermissions,
  filterPermissionKeys,
  permissionLabel,
  PRESETS,
  ALL_PERMISSIONS,
  VIEW_ONLY_SET,
  LEGACY_TESTER_SET,
} from '@/lib/permissions'

describe('resolvePermissions', () => {
  it("'qa' role resolves to the full permission set", () => {
    const result = resolvePermissions('qa', null)
    expect(result).toEqual(new Set(ALL_PERMISSIONS))
  })

  it("'developer' role resolves to the exact developer preset", () => {
    const result = resolvePermissions('developer', null)
    expect(result).toEqual(new Set(PRESETS.developer))
  })

  it("'custom' role with valid JSON array resolves to the filtered set", () => {
    const result = resolvePermissions('custom', '["bugs.view","bugs.create","not.a.real.key"]')
    expect(result).toEqual(new Set(['bugs.view', 'bugs.create']))
  })

  it("'custom' role with malformed JSON resolves to an empty set", () => {
    const result = resolvePermissions('custom', '{not valid json')
    expect(result).toEqual(new Set())
  })

  it("'custom' role with non-array JSON (e.g. \"{}\") resolves to an empty set", () => {
    const result = resolvePermissions('custom', '{}')
    expect(result).toEqual(new Set())
  })

  it("'custom' role with null custom permissions resolves to an empty set", () => {
    expect(resolvePermissions('custom', null)).toEqual(new Set())
  })

  it("'custom' role with undefined custom permissions resolves to an empty set", () => {
    expect(resolvePermissions('custom', undefined)).toEqual(new Set())
  })

  it('unknown role resolves to an empty set', () => {
    expect(resolvePermissions('nonexistent-role', '["bugs.view"]')).toEqual(new Set())
  })

  it('custom JSON with invalid keys drops the invalid entries', () => {
    const result = resolvePermissions('custom', '["dashboard.view","totally.bogus","features.edit"]')
    expect(result).toEqual(new Set(['dashboard.view', 'features.edit']))
  })
})

describe('filterPermissionKeys', () => {
  it('returns [] for a non-array input', () => {
    expect(filterPermissionKeys('not-an-array')).toEqual([])
    expect(filterPermissionKeys(null)).toEqual([])
    expect(filterPermissionKeys(undefined)).toEqual([])
    expect(filterPermissionKeys({ foo: 'bar' })).toEqual([])
  })

  it('keeps only valid permission-key strings from a mixed array', () => {
    const result = filterPermissionKeys(['bugs.view', 123, 'nonsense.key', 'features.edit', null, true])
    expect(result).toEqual(['bugs.view', 'features.edit'])
  })
})

describe('permissionLabel', () => {
  it('uses the override label for a key present in LABEL_OVERRIDES', () => {
    expect(permissionLabel('bugs.report')).toBe('Report to Jira')
  })

  it('falls back to default capitalization for a key without an override', () => {
    expect(permissionLabel('dashboard.view')).toBe('View')
  })
})

describe('permission set invariants', () => {
  it('every key in PRESETS.developer is present in ALL_PERMISSIONS', () => {
    for (const key of PRESETS.developer) {
      expect(ALL_PERMISSIONS).toContain(key)
    }
  })

  it('every key in VIEW_ONLY_SET ends with .view', () => {
    expect(VIEW_ONLY_SET.length).toBeGreaterThan(0)
    for (const key of VIEW_ONLY_SET) {
      expect(key.endsWith('.view')).toBe(true)
    }
  })

  it('LEGACY_TESTER_SET excludes settings.edit', () => {
    expect(LEGACY_TESTER_SET).not.toContain('settings.edit')
  })
})
