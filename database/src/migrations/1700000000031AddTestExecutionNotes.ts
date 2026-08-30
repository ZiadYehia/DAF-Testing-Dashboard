import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Adds test_executions.notes — a per-execution free-text field for run-time
 * observations ("Executed live 2026-07-29…", "DEFECT (P1): …"). Sits beside
 * status and bugSlug as the third thing an execution row tracks; NULL means
 * no note has been recorded.
 */
export class AddTestExecutionNotes1700000000031 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE name='notes' AND object_id=OBJECT_ID('test_executions'))
      ALTER TABLE test_executions ADD notes NVARCHAR(MAX) NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE name='notes' AND object_id=OBJECT_ID('test_executions'))
      ALTER TABLE test_executions DROP COLUMN notes
    `)
  }
}
