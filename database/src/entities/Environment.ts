import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm'

/**
 * A named target the automation can run against — production, a staging box, a colleague's
 * laptop behind an ngrok tunnel — together with the variables that define it.
 *
 * WHY THIS EXISTS
 *
 * Base URLs and credentials lived only in automation-hub/.env, so pointing the suite at a
 * different server meant hand-editing that file and remembering to put it back. When the
 * production host went down and the platform reappeared through two ngrok tunnels, there was
 * no way to switch without editing a gitignored file nobody else can see, and no way to tell
 * from the app which server a recorded run had actually hit.
 *
 * HOW IT TAKES EFFECT
 *
 * engine/runner.ts injects the active environment's variables into the Playwright child's
 * environment. automation-hub/lib/env.ts loads .env with "existing env vars win", so an
 * injected value overrides the file without either side needing to know about the other, and
 * .env keeps working untouched as the fallback for anything an environment does not define.
 *
 * SECRETS
 *
 * `variables` holds real API keys and passwords. The table is not a secret store — it is a
 * convenience for a test rig, readable by anyone with database access, and the UI shows the
 * values because a user switching environments needs to see what they are switching to.
 * Nothing here is written to `data/`, which is committed.
 */
@Entity('environments')
@Unique(['appSlug', 'name'])
@Index(['appSlug', 'isActive'])
export class Environment {
  @PrimaryGeneratedColumn()
  id!: number

  /** Which app this environment belongs to; environments are never shared between apps. */
  @Column({ type: 'varchar', length: 50 })
  appSlug!: string

  /** Display name, e.g. "Production (devsim)" or "ngrok relay". */
  @Column({ type: 'nvarchar', length: 120 })
  name!: string

  /** Optional note — what this target is, who runs it, when it expires. */
  @Column({ type: 'nvarchar', length: 500, default: '' })
  description!: string

  /**
   * KEY=VALUE pairs as a JSON object, e.g. {"EPTTS_MASAR_API_URL":"https://…"}.
   * Stored as text rather than a child table: these are read and written whole, never queried
   * by key, and a JSON blob keeps a switch to one round trip.
   */
  @Column({ type: 'nvarchar', length: 'max', default: '{}' })
  variables!: string

  /**
   * Exactly one environment per app should be active. Enforced in application code
   * (activateEnvironment clears the others in the same transaction) rather than by a
   * constraint, because SQL Server cannot express "at most one true per appSlug" without a
   * filtered unique index, which would then block the moment between clearing and setting.
   */
  @Column({ type: 'bit', default: false })
  isActive!: boolean

  @Column({ type: 'datetime2', default: () => 'SYSUTCDATETIME()' })
  createdAt!: Date

  @Column({ type: 'datetime2', nullable: true })
  updatedAt!: Date | null
}
