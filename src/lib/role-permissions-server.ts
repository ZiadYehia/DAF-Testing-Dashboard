/**
 * Server-side persistence for the DB-editable app-role registry. Persisted as a
 * `settings` row (no schema change): global ROLE_DEFINITIONS : RoleDefinition[].
 * Kept separate from `permissions.ts` so typeorm never enters client bundles.
 */
import { getSetting, setSetting } from './settings'
import {
  BUILTIN_ROLE_DEFINITIONS,
  filterPermissionKeys,
  type RoleDefinition,
  type PermissionKey,
} from './permissions'

const NAME_RE = /^[a-z][a-z0-9_-]{0,19}$/

let cache: RoleDefinition[] | null = null

export function bustRoleCache(): void {
  cache = null
}

export async function getRoleDefinitions(): Promise<RoleDefinition[]> {
  if (cache) return cache

  const raw = await getSetting('global', 'ROLE_DEFINITIONS').catch(() => null)
  if (!raw) return BUILTIN_ROLE_DEFINITIONS

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return BUILTIN_ROLE_DEFINITIONS

    const sanitized: RoleDefinition[] = parsed.map((role) => ({
      name: String(role?.name ?? ''),
      label: String(role?.label ?? role?.name ?? ''),
      description: String(role?.description ?? ''),
      permissions: filterPermissionKeys(role?.permissions),
      ...(role?.builtin ? { builtin: true } : {}),
    }))

    cache = sanitized
    return sanitized
  } catch {
    return BUILTIN_ROLE_DEFINITIONS
  }
}

export async function saveRoleDefinitions(roles: RoleDefinition[]): Promise<void> {
  if (!Array.isArray(roles)) {
    throw Object.assign(new Error('roles must be an array'), { status: 400 })
  }

  const seen = new Set<string>()
  const sanitized: RoleDefinition[] = roles.map((role) => {
    const name = String(role?.name ?? '')
    if (!NAME_RE.test(name)) {
      throw Object.assign(
        new Error(`Invalid role name "${name}": must be a lowercase slug (letters, digits, "-", "_", starting with a letter, max 20 chars)`),
        { status: 400 }
      )
    }
    if (name === 'custom' || name === 'admin') {
      throw Object.assign(new Error(`Role name "${name}" is reserved`), { status: 400 })
    }
    if (seen.has(name)) {
      throw Object.assign(new Error(`Duplicate role name "${name}"`), { status: 400 })
    }
    seen.add(name)

    const label = typeof role?.label === 'string' && role.label.trim() ? role.label : name
    const description = typeof role?.description === 'string' ? role.description : ''
    const permissions: PermissionKey[] = filterPermissionKeys(role?.permissions)

    return {
      name,
      label,
      description,
      permissions,
      ...(role?.builtin ? { builtin: true } : {}),
    }
  })

  await setSetting('global', 'ROLE_DEFINITIONS', JSON.stringify(sanitized))
  cache = sanitized
}

export async function resolveAppPermissions(
  role: string,
  membershipPermissionsJson: string | null | undefined
): Promise<Set<PermissionKey>> {
  if (role === 'custom') {
    try {
      const parsed = JSON.parse(membershipPermissionsJson || '[]')
      return new Set(filterPermissionKeys(parsed))
    } catch {
      return new Set()
    }
  }

  const roles = await getRoleDefinitions()
  const def = roles.find((r) => r.name === role)
  return def ? new Set(def.permissions) : new Set()
}
