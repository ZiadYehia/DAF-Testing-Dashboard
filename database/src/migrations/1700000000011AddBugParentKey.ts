import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds bugs.parentKey — present on the Bug entity but never created by an earlier
 * migration (the original DB got it via synchronize). Migration-only databases
 * (the standalone copies) were missing it, which broke every bug-list query.
 */
export class AddBugParentKey1700000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='parentKey' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs ADD parentKey VARCHAR(100) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='parentKey' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP COLUMN parentKey
    `)
  }
}
