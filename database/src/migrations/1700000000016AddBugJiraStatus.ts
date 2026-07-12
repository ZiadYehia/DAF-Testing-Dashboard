import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds bugs.jiraStatus + bugs.jiraStatusSyncedAt — cached Jira workflow status
 * for the retest board, refreshed by syncJiraStatuses(). Both nullable: a bug
 * with no jiraKey (or not yet synced) has no cached status.
 */
export class AddBugJiraStatus1700000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='jiraStatus' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs ADD jiraStatus VARCHAR(100) NULL
    `)
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='jiraStatusSyncedAt' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs ADD jiraStatusSyncedAt DATETIME2 NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='jiraStatus' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP COLUMN jiraStatus
    `)
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='jiraStatusSyncedAt' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP COLUMN jiraStatusSyncedAt
    `)
  }
}
