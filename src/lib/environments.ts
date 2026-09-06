import { getDataSource } from '@/lib/db'
import { EnvironmentEntity, type IEnvironment } from './entities'

/**
 * Named run targets per app: a base URL set plus the credentials that go with it.
 *
 * The point is that switching where the automation runs should be one click and visible to
 * everyone, rather than an edit to a gitignored automation-hub/.env that only the person who
 * made it knows about.
 */

export interface EnvironmentSummary {
  id: number
  name: string
  description: string
  isActive: boolean
  /** Variable NAMES, for listings. Values come from getEnvironment. */
  keys: string[]
  createdAt: string
  updatedAt: string | null
}

export interface EnvironmentDetail extends EnvironmentSummary {
  variables: Record<string, string>
}

/** Parse the stored blob, tolerating anything that is not a JSON object. */
function parseVars(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) out[k] = String(v ?? '')
    return out
  } catch {
    return {}
  }
}

/**
 * Only KEY=VALUE shapes a process environment can actually carry.
 *
 * A variable named with a space or a dash cannot be set on process.env in any portable way,
 * and would fail silently at the point of use rather than here — so it is rejected on save,
 * where the user can still see what they typed.
 */
const VALID_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

export function validateVariables(vars: Record<string, unknown>): string[] {
  const problems: string[] = []
  for (const key of Object.keys(vars)) {
    if (!VALID_KEY.test(key)) {
      problems.push(`"${key}" is not a usable variable name — letters, digits and underscore only, not starting with a digit`)
    }
  }
  return problems
}

const toSummary = (e: IEnvironment): EnvironmentSummary => ({
  id: e.id,
  name: e.name,
  description: e.description ?? '',
  isActive: e.isActive,
  keys: Object.keys(parseVars(e.variables)).sort(),
  createdAt: e.createdAt?.toISOString?.() ?? String(e.createdAt),
  updatedAt: e.updatedAt ? e.updatedAt.toISOString() : null,
})

export async function listEnvironments(appSlug: string): Promise<EnvironmentSummary[]> {
  const ds = await getDataSource()
  const rows = await ds.getRepository(EnvironmentEntity).find({
    where: { appSlug },
    order: { isActive: 'DESC', name: 'ASC' },
  })
  return rows.map(toSummary)
}

export async function getEnvironment(appSlug: string, id: number): Promise<EnvironmentDetail | null> {
  const ds = await getDataSource()
  const row = await ds.getRepository(EnvironmentEntity).findOne({ where: { appSlug, id } })
  if (!row) return null
  return { ...toSummary(row), variables: parseVars(row.variables) }
}

export async function createEnvironment(
  appSlug: string,
  input: { name: string; description?: string; variables?: Record<string, string>; activate?: boolean },
): Promise<EnvironmentDetail> {
  const ds = await getDataSource()
  const repo = ds.getRepository(EnvironmentEntity)

  const name = input.name.trim()
  if (!name) throw new Error('An environment needs a name.')
  const clash = await repo.findOne({ where: { appSlug, name } })
  if (clash) throw new Error(`This app already has an environment called "${name}".`)

  const saved = await repo.save({
    appSlug,
    name,
    description: (input.description ?? '').trim(),
    variables: JSON.stringify(input.variables ?? {}),
    isActive: false,
    updatedAt: new Date(),
  })
  if (input.activate) await activateEnvironment(appSlug, saved.id)
  return (await getEnvironment(appSlug, saved.id))!
}

export async function updateEnvironment(
  appSlug: string,
  id: number,
  input: { name?: string; description?: string; variables?: Record<string, string> },
): Promise<EnvironmentDetail | null> {
  const ds = await getDataSource()
  const repo = ds.getRepository(EnvironmentEntity)
  const row = await repo.findOne({ where: { appSlug, id } })
  if (!row) return null

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new Error('An environment needs a name.')
    const clash = await repo.findOne({ where: { appSlug, name } })
    if (clash && clash.id !== id) throw new Error(`This app already has an environment called "${name}".`)
    row.name = name
  }
  if (input.description !== undefined) row.description = input.description.trim()
  if (input.variables !== undefined) row.variables = JSON.stringify(input.variables)
  row.updatedAt = new Date()
  await repo.save(row)
  return getEnvironment(appSlug, id)
}

export async function deleteEnvironment(appSlug: string, id: number): Promise<boolean> {
  const ds = await getDataSource()
  const repo = ds.getRepository(EnvironmentEntity)
  const row = await repo.findOne({ where: { appSlug, id } })
  if (!row) return false
  // Deleting the active one would leave the app with no target and the next run would
  // silently fall back to .env — which is exactly the invisible-switch problem this replaces.
  if (row.isActive) throw new Error('This environment is active. Switch to another one first.')
  await repo.remove(row)
  return true
}

/**
 * Make one environment active, clearing the rest.
 *
 * Both halves run in a transaction: a crash between them would leave the app with either two
 * active environments or none, and "none" silently reverts every run to .env.
 */
export async function activateEnvironment(appSlug: string, id: number): Promise<boolean> {
  const ds = await getDataSource()
  return ds.transaction(async (manager) => {
    const repo = manager.getRepository(EnvironmentEntity)
    const target = await repo.findOne({ where: { appSlug, id } })
    if (!target) return false
    await repo.update({ appSlug }, { isActive: false })
    await repo.update({ appSlug, id }, { isActive: true, updatedAt: new Date() })
    return true
  })
}

/**
 * The variables the active environment defines, for injection into a Playwright run.
 *
 * Returns {} when no environment is active, which leaves automation-hub/.env in charge —
 * the behaviour every existing project already had.
 */
export async function activeEnvironmentVars(appSlug: string): Promise<Record<string, string>> {
  try {
    const ds = await getDataSource()
    const row = await ds.getRepository(EnvironmentEntity).findOne({ where: { appSlug, isActive: true } })
    return row ? parseVars(row.variables) : {}
  } catch {
    // A run must not fail because the environments table is unreachable.
    return {}
  }
}

/** Name of the active environment, for labelling a run. */
export async function activeEnvironmentName(appSlug: string): Promise<string | null> {
  try {
    const ds = await getDataSource()
    const row = await ds.getRepository(EnvironmentEntity).findOne({ where: { appSlug, isActive: true } })
    return row?.name ?? null
  } catch {
    return null
  }
}
