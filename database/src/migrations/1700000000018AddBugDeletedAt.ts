import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds bugs.deletedAt — soft-delete marker set by softDeleteBug(). NULL means
 * the bug is not deleted; reads (listBugs, syncJiraStatuses) filter it out
 * once set, but the row and its markdown/attachments are kept for recovery.
 */
export class AddBugDeletedAt1700000000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='deletedAt' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs ADD deletedAt DATETIME2 NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='deletedAt' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP COLUMN deletedAt
    `)
  }
}
