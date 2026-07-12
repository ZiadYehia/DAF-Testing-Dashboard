import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds bugs.jiraReporter — the Jira account id (Cloud) or username (Server/DC)
 * of the issue's reporter, cached by syncJiraStatuses(). Drives the retest
 * board's "Reported by me" filter. Nullable: unsynced or draft bugs have none.
 */
export class AddBugJiraReporter1700000000017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='jiraReporter' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs ADD jiraReporter VARCHAR(255) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='jiraReporter' AND object_id=OBJECT_ID('bugs'))
      ALTER TABLE bugs DROP COLUMN jiraReporter
    `)
  }
}
