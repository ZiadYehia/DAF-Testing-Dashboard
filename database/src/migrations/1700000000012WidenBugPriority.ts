import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Widens bugs.priority from VARCHAR(10) to VARCHAR(50) to match the Bug entity.
 * The InitialSchema migration created it as VARCHAR(10), which cannot hold the
 * priority labels the app actually uses (e.g. "P1 – Critical" = 13 chars,
 * "P3 – Medium" = 11 chars) — inserting those threw a truncation error and made
 * it impossible to persist or backfill those bugs.
 */
export class WidenBugPriority1700000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE name = 'priority' AND object_id = OBJECT_ID('bugs') AND max_length < 50
      )
      ALTER TABLE bugs ALTER COLUMN priority VARCHAR(50) NOT NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Narrowing back to VARCHAR(10) would truncate existing data, so this is a no-op.
  }
}
