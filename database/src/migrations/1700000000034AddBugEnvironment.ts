import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Records which environment a bug was found on.
 *
 * WHY
 *
 * Run history and execution status are already split per environment. Bugs were the remaining
 * leg: the same test suite run against the production tenant and against a relay tunnel produces
 * genuinely different defects — the relay reproduced some production bugs, contradicted others,
 * and surfaced several that only exist there. With nothing on the bug itself, a reader had to
 * infer the target from prose in the Environment section, and two reports of the same defect on
 * two servers were indistinguishable in any list.
 *
 * NULL means the bug was not attributed to a named environment — every bug filed before this
 * existed. Not backfilled: those were filed against production, but "were filed before we
 * tracked this" and "were verified against production" are different claims, and only the first
 * one is true of all of them.
 *
 * Deliberately NOT part of a uniqueness key. The same defect on two environments is two bug
 * files with distinct slugs (`<slug>-<environment>`), which the existing (appSlug, feature, slug)
 * identity already separates.
 */
export class AddBugEnvironment1700000000034 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='environment' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs ADD environment VARCHAR(100) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='environment' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP COLUMN environment
    `)
  }
}
