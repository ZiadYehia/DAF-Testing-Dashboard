import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Phase 1 of the DB-source-of-truth migration: additive-only features.lastAddition
 * column. Not yet read by runtime code.
 */
export class AddFeatureLastAddition1700000000025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='lastAddition' AND object_id=OBJECT_ID('features'))
      ALTER TABLE features ADD lastAddition NVARCHAR(MAX) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='lastAddition' AND object_id=OBJECT_ID('features'))
      ALTER TABLE features DROP COLUMN lastAddition
    `)
  }
}
