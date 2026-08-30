export const PERMISSION_GROUPS = {
  dashboard:      ['dashboard.view'],
  features:       ['features.view','features.create','features.edit','features.export','features.lifecycle','features.delete'],
  testcases:      ['testcases.generate','testcases.execute'],
  bugs:           ['bugs.view','bugs.create','bugs.edit','bugs.delete','bugs.report'],
  requirements:   ['requirements.view','requirements.edit'],
  knowledge:      ['knowledge.view','knowledge.edit'],
  automation:     ['automation.view','automation.run','automation.edit'],
  settings:       ['settings.view','settings.edit'],
  changerequests: ['changerequests.view','changerequests.create','changerequests.edit','changerequests.delete'],
  administration: ['admin.users.view','admin.users.create','admin.users.edit','admin.users.resetPassword','admin.users.retire'],
  settingsTabs: ['settings.tab.profile','settings.tab.credentials','settings.tab.ai','settings.tab.board','settings.tab.automation','settings.tab.defaults','settings.tab.branding'],
} as const

export type PermissionKey = (typeof PERMISSION_GROUPS)[keyof typeof PERMISSION_GROUPS][number]

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSION_GROUPS).flat()

export const APP_PERMISSIONS: PermissionKey[] = ALL_PERMISSIONS.filter((key) => !key.startsWith('admin.'))

export const VIEW_ONLY_SET: PermissionKey[] = APP_PERMISSIONS.filter((key) => key.endsWith('.view'))

export const LEGACY_TESTER_SET: PermissionKey[] = APP_PERMISSIONS.filter(
  (key) => key !== 'settings.edit' && key !== 'features.lifecycle' && key !== 'features.delete'
)

export const APP_ROLES = ['qa', 'developer', 'custom'] as const
export type AppRole = (typeof APP_ROLES)[number]

export const PRESETS: Record<'qa' | 'developer', PermissionKey[]> = {
  qa: APP_PERMISSIONS,
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
    'automation.run',
    'settings.view',
    'changerequests.view',
    'changerequests.create',
    'changerequests.edit',
  ],
}

export const ROLE_LABELS: Record<AppRole, { label: string; description: string }> = {
  qa: {
    label: 'QA',
    description: 'Full access: manage features, test cases, bugs, automation, and app settings.',
  },
  developer: {
    label: 'Developer',
    description: 'View everything; create, edit, and report bugs; replay automation. No test authoring/editing, test execution, or settings changes.',
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
  changerequests: 'Change Requests',
  administration: 'Administration',
  settingsTabs: 'Settings Tabs',
}

const LABEL_OVERRIDES: Partial<Record<PermissionKey, string>> = {
  'features.lifecycle': 'Change testing phase',
  'bugs.report': 'Report to Jira',
  'testcases.generate': 'Generate (AI)',
  'testcases.execute': 'Execute / record results',
  'features.export': 'Export',
  'admin.users.view': 'View users',
  'admin.users.create': 'Create users',
  'admin.users.edit': 'Edit users',
  'admin.users.resetPassword': 'Reset passwords',
  'admin.users.retire': 'Retire users',
  'settings.tab.profile': 'App Profile',
  'settings.tab.credentials': 'Credentials & Integrations',
  'settings.tab.ai': 'AI & Models',
  'settings.tab.board': 'Board',
  'settings.tab.automation': 'Automation',
  'settings.tab.defaults': 'Test Case & Bug Defaults',
  'settings.tab.branding': 'Branding / logo',
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

export interface RoleDefinition {
  name: string
  label: string
  description: string
  permissions: PermissionKey[]
  builtin?: boolean
}

// Built-in role definitions — the fallback/seed for the DB-editable role registry.
// 'custom' is NOT here; it is a sentinel role whose permissions are hand-picked
// per membership. qa omits branding so logo changes stay admin-only by default.
export const BUILTIN_ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: 'qa',
    label: ROLE_LABELS.qa.label,
    description: ROLE_LABELS.qa.description,
    permissions: APP_PERMISSIONS.filter((k) => k !== 'settings.tab.branding'),
    builtin: true,
  },
  {
    name: 'developer',
    label: ROLE_LABELS.developer.label,
    description: ROLE_LABELS.developer.description,
    permissions: [...PRESETS.developer, 'settings.tab.credentials', 'settings.tab.ai'],
    builtin: true,
  },
]
