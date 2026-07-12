export const PERMISSION_GROUPS = {
  dashboard:    ['dashboard.view'],
  features:     ['features.view','features.create','features.edit','features.export','features.lifecycle','features.delete'],
  testcases:    ['testcases.generate','testcases.execute'],
  bugs:         ['bugs.view','bugs.create','bugs.edit','bugs.delete','bugs.report'],
  requirements: ['requirements.view','requirements.edit'],
  knowledge:    ['knowledge.view','knowledge.edit'],
  automation:   ['automation.view','automation.run','automation.edit'],
  settings:     ['settings.view','settings.edit'],
} as const

export type PermissionKey = (typeof PERMISSION_GROUPS)[keyof typeof PERMISSION_GROUPS][number]

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSION_GROUPS).flat()

export const VIEW_ONLY_SET: PermissionKey[] = ALL_PERMISSIONS.filter((key) => key.endsWith('.view'))

export const LEGACY_TESTER_SET: PermissionKey[] = ALL_PERMISSIONS.filter(
  (key) => key !== 'settings.edit' && key !== 'features.lifecycle' && key !== 'features.delete'
)

export const APP_ROLES = ['qa', 'developer', 'custom'] as const
export type AppRole = (typeof APP_ROLES)[number]

export const PRESETS: Record<'qa' | 'developer', PermissionKey[]> = {
  qa: ALL_PERMISSIONS,
  developer: [
    'dashboard.view',
    'features.view',
    'bugs.view',
    'bugs.create',
    'bugs.edit',
    'bugs.report',
    'requirements.view',
    'knowledge.view',
    'automation.view',
    'settings.view',
  ],
}

export const ROLE_LABELS: Record<AppRole, { label: string; description: string }> = {
  qa: {
    label: 'QA',
    description: 'Full access: manage features, test cases, bugs, automation, and app settings.',
  },
  developer: {
    label: 'Developer',
    description: 'View everything; create, edit, and report bugs. No test execution or settings changes.',
  },
  custom: {
    label: 'Custom',
    description: 'Hand-picked permissions from the catalog below.',
  },
}

export const GROUP_LABELS: Record<keyof typeof PERMISSION_GROUPS, string> = {
  dashboard: 'Dashboard',
  features: 'Features',
  testcases: 'Test Cases',
  bugs: 'Bugs',
  requirements: 'Requirements',
  knowledge: 'Knowledge',
  automation: 'Automation',
  settings: 'Settings',
}

const LABEL_OVERRIDES: Partial<Record<PermissionKey, string>> = {
  'features.lifecycle': 'Change testing phase',
  'bugs.report': 'Report to Jira',
  'testcases.generate': 'Generate (AI)',
  'testcases.execute': 'Execute / record results',
  'features.export': 'Export',
}

export function permissionLabel(key: PermissionKey): string {
  const override = LABEL_OVERRIDES[key]
  if (override) return override
  const action = key.split('.')[1] ?? key
  return action.charAt(0).toUpperCase() + action.slice(1)
}

export function resolvePermissions(role: string, permissionsJson: string | null | undefined): Set<PermissionKey> {
  if (role === 'qa' || role === 'developer') {
    return new Set(PRESETS[role])
  }

  if (role === 'custom') {
    if (!permissionsJson) return new Set()
    try {
      const parsed = JSON.parse(permissionsJson)
      if (!Array.isArray(parsed)) return new Set()
      return new Set(filterPermissionKeys(parsed))
    } catch {
      return new Set()
    }
  }

  return new Set()
}

export function filterPermissionKeys(keys: unknown): PermissionKey[] {
  if (!Array.isArray(keys)) return []
  const valid = new Set<string>(ALL_PERMISSIONS)
  return keys.filter((key): key is PermissionKey => typeof key === 'string' && valid.has(key))
}
